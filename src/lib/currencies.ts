/** The canonical storage currency. All amount_eur values are always stored in this currency. */
export const CANONICAL_CURRENCY = 'EUR';

/** Supported currencies with metadata */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Decimal places (2 for most, 0 for JPY/KRW) */
  decimals: number;
  /** Flag emoji for visual display */
  flag: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  EUR: { code: 'EUR', name: 'Euro',                    symbol: '€',   decimals: 2, flag: '🇪🇺' },
  USD: { code: 'USD', name: 'US Dollar',               symbol: '$',   decimals: 2, flag: '🇺🇸' },
  GBP: { code: 'GBP', name: 'British Pound',           symbol: '£',   decimals: 2, flag: '🇬🇧' },
  CZK: { code: 'CZK', name: 'Czech Koruna',            symbol: 'Kč',  decimals: 2, flag: '🇨🇿' },
  PLN: { code: 'PLN', name: 'Polish Zloty',             symbol: 'zł',  decimals: 2, flag: '🇵🇱' },
  HUF: { code: 'HUF', name: 'Hungarian Forint',         symbol: 'Ft',  decimals: 0, flag: '🇭🇺' },
  CHF: { code: 'CHF', name: 'Swiss Franc',              symbol: 'Fr',  decimals: 2, flag: '🇨🇭' },
  SEK: { code: 'SEK', name: 'Swedish Krona',            symbol: 'kr',  decimals: 2, flag: '🇸🇪' },
  NOK: { code: 'NOK', name: 'Norwegian Krone',          symbol: 'kr',  decimals: 2, flag: '🇳🇴' },
  DKK: { code: 'DKK', name: 'Danish Krone',             symbol: 'kr',  decimals: 2, flag: '🇩🇰' },
  HRK: { code: 'HRK', name: 'Croatian Kuna',            symbol: 'kn',  decimals: 2, flag: '🇭🇷' },
  TRY: { code: 'TRY', name: 'Turkish Lira',             symbol: '₺',   decimals: 2, flag: '🇹🇷' },
  JPY: { code: 'JPY', name: 'Japanese Yen',             symbol: '¥',   decimals: 0, flag: '🇯🇵' },
  AUD: { code: 'AUD', name: 'Australian Dollar',        symbol: 'A$',  decimals: 2, flag: '🇦🇺' },
  CAD: { code: 'CAD', name: 'Canadian Dollar',          symbol: 'C$',  decimals: 2, flag: '🇨🇦' },
  NZD: { code: 'NZD', name: 'New Zealand Dollar',       symbol: 'NZ$', decimals: 2, flag: '🇳🇿' },
  THB: { code: 'THB', name: 'Thai Baht',                symbol: '฿',   decimals: 2, flag: '🇹🇭' },
  BRL: { code: 'BRL', name: 'Brazilian Real',           symbol: 'R$',  decimals: 2, flag: '🇧🇷' },
  MXN: { code: 'MXN', name: 'Mexican Peso',             symbol: 'Mex$',decimals: 2, flag: '🇲🇽' },
  ZAR: { code: 'ZAR', name: 'South African Rand',       symbol: 'R',   decimals: 2, flag: '🇿🇦' },
  INR: { code: 'INR', name: 'Indian Rupee',             symbol: '₹',   decimals: 2, flag: '🇮🇳' },
  KRW: { code: 'KRW', name: 'South Korean Won',         symbol: '₩',   decimals: 0, flag: '🇰🇷' },
  RON: { code: 'RON', name: 'Romanian Leu',             symbol: 'lei', decimals: 2, flag: '🇷🇴' },
  BGN: { code: 'BGN', name: 'Bulgarian Lev',            symbol: 'лв',  decimals: 2, flag: '🇧🇬' },
  ISK: { code: 'ISK', name: 'Icelandic Króna',          symbol: 'kr',  decimals: 0, flag: '🇮🇸' },
  RSD: { code: 'RSD', name: 'Serbian Dinar',            symbol: 'din', decimals: 2, flag: '🇷🇸' },
  BAM: { code: 'BAM', name: 'Bosnia-Herz. Mark',        symbol: 'KM',  decimals: 2, flag: '🇧🇦' },
};

/** All currency codes sorted alphabetically */
export const CURRENCY_CODES = Object.keys(CURRENCIES).sort();

/**
 * Parse allowed currencies from settings JSON string.
 * Returns array of currency codes, ensuring base_currency is always included.
 */
export function parseAllowedCurrencies(json: string, baseCurrency: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const codes = parsed.filter((c: unknown) => typeof c === 'string' && CURRENCIES[c as string]);
      if (!codes.includes(baseCurrency)) codes.unshift(baseCurrency);
      return codes;
    }
  } catch {
    // invalid JSON
  }
  return [baseCurrency];
}

/** Get currency info, fallback to generic */
export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES[code] ?? {
    code,
    name: code,
    symbol: code,
    decimals: 2,
    flag: '🏳️',
  };
}

/** Format an amount with currency symbol */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale = 'en-US'
): string {
  const info = getCurrency(currencyCode);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(amount);
}

/**
 * Convert amount from one currency to the base currency using provided rate.
 * Rate is: 1 base_currency = X foreign_currency (e.g., 1 EUR = 25.21 CZK)
 */
export function convertToBase(amount: number, rate: number): number {
  if (rate <= 0) return amount;
  return Math.round((amount / rate) * 100) / 100;
}

/**
 * Convert amount from base currency to foreign currency using provided rate.
 */
export function convertFromBase(amount: number, rate: number): number {
  if (rate <= 0) return amount;
  return Math.round(amount * rate * 100) / 100;
}
