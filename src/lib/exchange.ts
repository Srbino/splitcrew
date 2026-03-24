import { getSetting, setSetting } from './db';
import { query, queryOne, execute } from './db';

/**
 * Exchange rate provider — fetches from Frankfurter API (ECB data).
 *
 * Two layers:
 * 1. **Daily archive** (`exchange_rates_daily` table) — stores rates per date
 *    for accurate historical expense conversion. The Frankfurter API supports
 *    historical lookups: /2024-06-15?from=EUR
 * 2. **Live cache** (settings table) — latest rates refreshed once per day
 *    for the UI (settlement conversions, rate display).
 *
 * When creating an expense, we look up the rate for that expense's date.
 * This ensures all conversions are historically accurate.
 */

interface ExchangeRates {
  [currencyCode: string]: number;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

// ── Public API ──

/**
 * Get the exchange rate for a specific currency on a specific date.
 * This is the primary function for expense creation/editing.
 *
 * Returns: how many units of `foreignCurrency` per 1 `baseCurrency`
 * e.g. getExchangeRateForDate('EUR', 'CZK', '2026-06-15') → 25.21
 */
export async function getExchangeRateForDate(
  baseCurrency: string,
  foreignCurrency: string,
  date: string,
): Promise<number> {
  if (baseCurrency === foreignCurrency) return 1;

  // Try date-specific rate first
  const rates = await getDailyRates(baseCurrency, date);
  if (rates[foreignCurrency]) return rates[foreignCurrency];

  // Fallback: use live/cached rates (latest available)
  console.warn(`[exchange] No daily rate for ${foreignCurrency} on ${date}, falling back to live rates`);
  const liveRates = await getExchangeRates(baseCurrency);
  return liveRates[foreignCurrency] ?? 0;
}

/**
 * Get all exchange rates relative to the base currency (latest/cached).
 * Used for UI display, settlement conversions, etc.
 */
export async function getExchangeRates(baseCurrency: string): Promise<ExchangeRates> {
  // Check live cache in settings
  const cachedRatesJson = await getSetting('exchange_rates', '');
  const cachedBase = await getSetting('exchange_rates_base', '');
  const cachedAt = await getSetting('exchange_rates_updated', '');

  if (cachedRatesJson && cachedBase === baseCurrency && cachedAt) {
    const cachedTime = new Date(cachedAt).getTime();
    if (Date.now() - cachedTime < CACHE_DURATION_MS) {
      try {
        return JSON.parse(cachedRatesJson);
      } catch {
        // corrupted cache, refetch
      }
    }
  }

  // Fetch fresh rates for today
  const today = new Date().toISOString().slice(0, 10);
  const rates = await getDailyRates(baseCurrency, today);

  if (Object.keys(rates).length > 0) {
    await setSetting('exchange_rates', JSON.stringify(rates));
    await setSetting('exchange_rates_base', baseCurrency);
    await setSetting('exchange_rates_updated', new Date().toISOString());
    return rates;
  }

  // Return stale cache if fresh fetch failed
  if (cachedRatesJson && cachedBase === baseCurrency) {
    try {
      return JSON.parse(cachedRatesJson);
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Get the exchange rate for a specific currency pair (latest).
 * Convenience wrapper for backwards compatibility.
 */
export async function getExchangeRate(
  baseCurrency: string,
  foreignCurrency: string,
): Promise<number> {
  if (baseCurrency === foreignCurrency) return 1;
  const rates = await getExchangeRates(baseCurrency);
  return rates[foreignCurrency] ?? 0;
}

/**
 * Ensure today's exchange rates exist in the daily archive.
 * Called on every page load — lightweight check (DB query only).
 * If missing or older than 12 hours, fetches from API.
 */
export async function ensureTodayRates(baseCurrency: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  try {
    const cached = await queryOne<{ fetched_at: string }>(
      'SELECT fetched_at FROM exchange_rates_daily WHERE rate_date = $1 AND base_currency = $2',
      [today, baseCurrency]
    );

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < TWELVE_HOURS) return; // Fresh enough
    }

    // Fetch and store today's rates
    await getDailyRates(baseCurrency, today);
  } catch {
    // Non-critical — don't break page load if rate fetch fails
  }
}

/**
 * Sync exchange rates for a date range (e.g. the trip period).
 * Call this to pre-populate the daily archive.
 * Frankfurter supports date ranges: /2026-06-01..2026-06-15?from=EUR
 */
export async function syncRatesForRange(
  baseCurrency: string,
  fromDate: string,
  toDate: string,
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  // Fetch the full range from Frankfurter (returns all dates at once)
  try {
    const url = `https://api.frankfurter.app/${fromDate}..${toDate}?from=${baseCurrency}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (response.ok) {
      const data = await response.json();
      // data.rates is { "2026-06-01": { "CZK": 25.21, ... }, "2026-06-02": { ... } }
      if (data.rates && typeof data.rates === 'object') {
        for (const [dateStr, dayRates] of Object.entries(data.rates)) {
          try {
            const rounded = roundRates(dayRates as Record<string, number>);
            await upsertDailyRates(dateStr, baseCurrency, rounded);
            synced++;
          } catch {
            errors++;
          }
        }
      }
    }
  } catch {
    errors++;
  }

  return { synced, errors };
}

// ── Internal: Daily Rate Archive ──

/**
 * Get rates for a specific date. Checks DB first, then fetches from API.
 * Stores the result in the daily archive for future lookups.
 */
async function getDailyRates(baseCurrency: string, date: string): Promise<ExchangeRates> {
  // 1. Check the daily archive
  const cached = await queryOne<{ rates: string }>(
    'SELECT rates FROM exchange_rates_daily WHERE rate_date = $1 AND base_currency = $2',
    [date, baseCurrency]
  );

  if (cached) {
    try {
      return JSON.parse(cached.rates);
    } catch {
      // corrupted, refetch
    }
  }

  // 2. Fetch from Frankfurter API for this specific date
  console.log(`[exchange] Fetching ${baseCurrency} rates for ${date}...`);
  const rates = await fetchRatesForDate(baseCurrency, date);

  if (rates && Object.keys(rates).length > 0) {
    // Store in the daily archive
    await upsertDailyRates(date, baseCurrency, rates);
    return rates;
  }
  console.log(`[exchange] API failed for ${date}, trying DB fallbacks...`);

  // 3. Fallback: try the closest available date (before OR after target date)
  const fallbackBefore = await queryOne<{ rates: string; rate_date: string }>(
    `SELECT rates, rate_date FROM exchange_rates_daily
     WHERE base_currency = $1 AND rate_date <= $2
     ORDER BY rate_date DESC LIMIT 1`,
    [baseCurrency, date]
  );

  if (fallbackBefore) {
    console.log(`[exchange] Using earlier cached rate from ${fallbackBefore.rate_date}`);
    try {
      return JSON.parse(fallbackBefore.rates);
    } catch { /* corrupted */ }
  }

  // 3b. No older rates — try closest newer rate (e.g., today's cached rate)
  const fallbackAfter = await queryOne<{ rates: string; rate_date: string }>(
    `SELECT rates, rate_date FROM exchange_rates_daily
     WHERE base_currency = $1 AND rate_date >= $2
     ORDER BY rate_date ASC LIMIT 1`,
    [baseCurrency, date]
  );

  if (fallbackAfter) {
    console.log(`[exchange] Using newer cached rate from ${fallbackAfter.rate_date}`);
    try {
      return JSON.parse(fallbackAfter.rates);
    } catch { /* corrupted */ }
  }

  // 4. Last resort: try fetching latest from API
  console.log(`[exchange] No DB fallback, fetching latest from API...`);
  const latest = await fetchRatesForDate(baseCurrency, 'latest');
  if (latest && Object.keys(latest).length > 0) {
    await upsertDailyRates(date, baseCurrency, latest);
    return latest;
  }

  return {};
}

/**
 * Insert or update daily rates in the archive.
 */
async function upsertDailyRates(
  date: string,
  baseCurrency: string,
  rates: ExchangeRates,
): Promise<void> {
  await execute(
    `INSERT INTO exchange_rates_daily (rate_date, base_currency, rates, fetched_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (rate_date, base_currency) DO UPDATE
     SET rates = EXCLUDED.rates, fetched_at = EXCLUDED.fetched_at`,
    [date, baseCurrency, JSON.stringify(rates)]
  );
}

// ── Internal: API Fetching ──

/**
 * Fetch rates from Frankfurter API for a specific date or 'latest'.
 * Frankfurter uses ECB data — free, no API key, reliable.
 * Supports: /latest, /2026-06-15, /2026-06-01..2026-06-15
 */
async function fetchRatesForDate(
  baseCurrency: string,
  date: string, // 'latest' or 'YYYY-MM-DD'
): Promise<ExchangeRates | null> {
  try {
    const url = `https://api.frankfurter.app/${date}?from=${baseCurrency}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (response.ok) {
      const data = await response.json();
      if (data.rates) {
        return roundRates(data.rates);
      }
    }
  } catch {
    // fall through
  }

  // Fallback: CNB for EUR base
  if (baseCurrency === 'EUR' && date !== 'latest') {
    try {
      return await fetchCnbRates();
    } catch {
      // give up
    }
  }

  return null;
}

/**
 * Round all rates to 4 decimal places for consistency.
 */
function roundRates(rates: Record<string, number>): ExchangeRates {
  const result: ExchangeRates = {};
  for (const [code, rate] of Object.entries(rates)) {
    result[code] = Math.round(rate * 10000) / 10000;
  }
  return result;
}

/**
 * Fetch rates from Czech National Bank (fallback for EUR base).
 */
async function fetchCnbRates(): Promise<ExchangeRates | null> {
  try {
    const url = 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const text = await response.text();
    const lines = text.split('\n');
    const rates: ExchangeRates = {};

    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length >= 5) {
        const amount = parseFloat(parts[2]);
        const code = parts[3];
        const rate = parseFloat(parts[4].replace(',', '.'));
        if (amount && code && rate) {
          rates[code] = Math.round((rate / amount) * 10000) / 10000;
        }
      }
    }

    return rates;
  } catch {
    return null;
  }
}
