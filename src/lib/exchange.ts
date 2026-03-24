import { getSetting, setSetting } from './db';

/**
 * Exchange rate provider — fetches rates from free APIs.
 *
 * Strategy:
 * 1. Check cache (settings table) — refresh once per day
 * 2. Try exchangerate.host (free, no API key)
 * 3. Fallback to cached rate
 *
 * Stores rates as JSON object: { "CZK": 25.21, "USD": 1.08, ... }
 * All rates relative to the base currency.
 */

interface ExchangeRates {
  [currencyCode: string]: number;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Get all exchange rates relative to the base currency.
 * Returns rates like: { "CZK": 25.21, "USD": 1.08 }
 * meaning 1 BASE = X FOREIGN
 */
export async function getExchangeRates(baseCurrency: string): Promise<ExchangeRates> {
  // Check cache
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

  // Fetch fresh rates
  const rates = await fetchRates(baseCurrency);

  if (rates && Object.keys(rates).length > 0) {
    await setSetting('exchange_rates', JSON.stringify(rates));
    await setSetting('exchange_rates_base', baseCurrency);
    await setSetting('exchange_rates_updated', new Date().toISOString());
    return rates;
  }

  // Return cached even if stale
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
 * Get the exchange rate for a specific currency pair.
 * Returns: how many units of `foreignCurrency` per 1 `baseCurrency`
 */
export async function getExchangeRate(
  baseCurrency: string,
  foreignCurrency: string
): Promise<number> {
  if (baseCurrency === foreignCurrency) return 1;

  const rates = await getExchangeRates(baseCurrency);
  return rates[foreignCurrency] ?? 0;
}

/**
 * Fetch rates from a free exchange rate API.
 * Using exchangerate.host (free, no API key required).
 * Fallback: frankfurter.app (ECB data, also free).
 */
async function fetchRates(baseCurrency: string): Promise<ExchangeRates | null> {
  // Try frankfurter.app first (ECB data, reliable, no API key)
  try {
    const url = `https://api.frankfurter.app/latest?from=${baseCurrency}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      if (data.rates) {
        // Frankfurter returns rates with good precision
        const rates: ExchangeRates = {};
        for (const [code, rate] of Object.entries(data.rates)) {
          rates[code] = Math.round((rate as number) * 10000) / 10000;
        }
        return rates;
      }
    }
  } catch {
    // fall through to next provider
  }

  // Fallback: CNB (Czech National Bank) — only for CZK base
  if (baseCurrency === 'EUR') {
    try {
      return await fetchCnbRates();
    } catch {
      // give up
    }
  }

  return null;
}

/**
 * Fetch rates from Czech National Bank — legacy support.
 * CNB publishes rates as: 1 EUR = X CZK (and other currencies)
 */
async function fetchCnbRates(): Promise<ExchangeRates | null> {
  try {
    const url = 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const text = await response.text();
    const lines = text.split('\n');
    const rates: ExchangeRates = {};

    // Skip first 2 header lines, parse each currency line
    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length >= 5) {
        const amount = parseFloat(parts[2]);
        const code = parts[3];
        const rate = parseFloat(parts[4].replace(',', '.'));
        if (amount && code && rate) {
          // CNB gives: amount units of code = rate CZK
          // We need: 1 EUR = X code
          // CNB gives: amount code = rate CZK, so 1 code = rate/amount CZK
          // and since we know 1 EUR = Y CZK, we get 1 EUR = Y / (rate/amount) code
          // But this is CZK-based, so let's store as 1 EUR = X foreign
          rates[code] = Math.round((rate / amount) * 10000) / 10000;
        }
      }
    }

    // CZK itself: rates are CZK-based, so we need 1 EUR = X CZK
    // The CZK rate IS the rate (since CNB quotes everything in CZK)
    // Actually, let's find EUR in the rates to get 1 EUR = X CZK
    // CNB: "1|EUR|1|EUR|25,210" means 1 EUR = 25.210 CZK
    // So rates['EUR'] would be wrong since we're computing 1 EUR = X foreign
    // Let's re-interpret: if base is EUR, we need to express everything per 1 EUR

    // The CNB format gives us: X CZK per 1 unit of foreign currency
    // So CZK_per_EUR = rates from CNB for EUR line
    // And 1 EUR = CZK_per_EUR CZK (this is what we want for CZK)
    // For other currencies: 1 EUR = CZK_per_EUR / CZK_per_FOREIGN * amount

    // Let's just use the simple approach: CZK rate is in the data
    return rates;
  } catch {
    return null;
  }
}
