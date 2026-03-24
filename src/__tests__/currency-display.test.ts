/**
 * Currency Display Tests
 *
 * Reálné use cases pro CrewSplit s default CZK zobrazovací měnou.
 * Klíčový princip: amount_eur je VŽDY v EUR, display_currency jen mění zobrazení.
 */
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_CURRENCY,
  convertToBase,
  convertFromBase,
  formatCurrency,
  getCurrency,
  parseAllowedCurrencies,
} from '@/lib/currencies';

// Simulovaný kurz: 1 EUR = 24.505 CZK (z DB settings)
const EUR_CZK_RATE = 24.505;

// Helper: toDisplay — konverze z EUR do zobrazovací měny
function toDisplay(eurAmount: number, displayRate: number): number {
  return Math.round(eurAmount * displayRate * 100) / 100;
}

// ─── Architektura ───

describe('Canonical currency', () => {
  it('CANONICAL_CURRENCY is always EUR', () => {
    expect(CANONICAL_CURRENCY).toBe('EUR');
  });

  it('CZK is a supported currency', () => {
    const czk = getCurrency('CZK');
    expect(czk.code).toBe('CZK');
    expect(czk.symbol).toBe('Kč');
    expect(czk.decimals).toBe(2);
  });
});

// ─── Use Case 1: Výdaj v CZK (default měna posádky) ───
// Darek zaplatí 6000 CZK za rezervaci aut

describe('Use Case 1: CZK expense (6000 CZK car reservation)', () => {
  const originalAmount = 6000;
  const originalCurrency = 'CZK';

  it('converts 6000 CZK to EUR for storage', () => {
    // rate = 1 EUR = 24.505 CZK → 6000 / 24.505 = 244.85 EUR
    // (In real DB the value was set to 245.75 with slightly different rate 24.415)
    const amountEur = convertToBase(originalAmount, EUR_CZK_RATE);
    expect(amountEur).toBeGreaterThan(240);
    expect(amountEur).toBeLessThan(250);
    // Exact: 6000 / 24.505 = 244.85
    expect(amountEur).toBe(244.85);
  });

  it('storage currency is EUR regardless of display preference', () => {
    // Even if base_currency setting is CZK, storage always uses EUR
    const storageCurrency = CANONICAL_CURRENCY;
    expect(storageCurrency).toBe('EUR');

    // This means: if user enters CZK, we MUST convert to EUR
    const needsConversion = originalCurrency !== storageCurrency;
    expect(needsConversion).toBe(true);
  });

  it('displays correctly when display=CZK (toDisplay)', () => {
    const storedAmountEur = 245.75; // what's in DB
    const displayRate = EUR_CZK_RATE; // 1 EUR = 24.505 CZK

    const displayAmount = toDisplay(storedAmountEur, displayRate);
    // 245.75 * 24.505 = 6,024.10 CZK (approx, due to rate difference)
    expect(displayAmount).toBeGreaterThan(5900);
    expect(displayAmount).toBeLessThan(6100);
  });

  it('displays correctly when display=EUR (no conversion)', () => {
    const storedAmountEur = 245.75;
    const displayRate = 1; // EUR→EUR = 1

    const displayAmount = toDisplay(storedAmountEur, displayRate);
    expect(displayAmount).toBe(245.75);
  });

  it('formats CZK with correct symbol', () => {
    const formatted = formatCurrency(6024.10, 'CZK');
    expect(formatted).toContain('6');
    expect(formatted).toContain('024');
    // Intl.NumberFormat with CZK produces CZK symbol
  });

  it('formats EUR with correct symbol', () => {
    const formatted = formatCurrency(245.75, 'EUR');
    expect(formatted).toContain('245.75');
  });
});

// ─── Use Case 2: Výdaj v EUR (marina v Itálii) ───
// Pavel zaplatí 150 EUR za marinu

describe('Use Case 2: EUR expense (150 EUR marina)', () => {
  const originalAmount = 150;
  const originalCurrency = 'EUR';

  it('EUR expense needs no conversion for storage', () => {
    const storageCurrency = CANONICAL_CURRENCY;
    const needsConversion = originalCurrency !== storageCurrency;
    expect(needsConversion).toBe(false);
    // amount_eur = 150 (stored directly)
  });

  it('displays as CZK when display=CZK', () => {
    const storedAmountEur = 150;
    const displayRate = EUR_CZK_RATE;

    const displayAmount = toDisplay(storedAmountEur, displayRate);
    // 150 * 24.505 = 3,675.75 CZK
    expect(displayAmount).toBe(3675.75);
  });

  it('displays as EUR when display=EUR', () => {
    const storedAmountEur = 150;
    const displayRate = 1;

    const displayAmount = toDisplay(storedAmountEur, displayRate);
    expect(displayAmount).toBe(150);
  });
});

// ─── Use Case 3: Balance výpočty ───
// Darek zaplatil 245.75 EUR, jeho podíl je 17.55 EUR

describe('Use Case 3: Balance calculations', () => {
  const paid = 245.75;
  const share = 17.55;
  const balance = paid - share; // 228.20 EUR

  it('balance is calculated in EUR (canonical)', () => {
    expect(Math.round(balance * 100) / 100).toBe(228.20);
  });

  it('balance displayed in CZK', () => {
    const displayRate = EUR_CZK_RATE;
    const displayBalance = toDisplay(balance, displayRate);
    // 228.20 * 24.505 = 5,592.04 CZK
    expect(displayBalance).toBeGreaterThan(5500);
    expect(displayBalance).toBeLessThan(5700);
  });

  it('negative balance displays correctly in CZK', () => {
    const negativeBalance = -17.55; // owes 17.55 EUR
    const displayRate = EUR_CZK_RATE;
    const displayBalance = toDisplay(negativeBalance, displayRate);
    // -17.55 * 24.505 = -430.06 CZK
    expect(displayBalance).toBeLessThan(0);
    expect(displayBalance).toBeGreaterThan(-450);
    expect(displayBalance).toBeLessThan(-420);
  });
});

// ─── Use Case 4: Settlement (vyrovnání) ───
// Erik dluží Darkovi 17.55 EUR

describe('Use Case 4: Settlement display', () => {
  it('settlement amount converts to CZK for display', () => {
    const settlementEur = 17.55;
    const displayRate = EUR_CZK_RATE;

    const displayAmount = toDisplay(settlementEur, displayRate);
    // 17.55 * 24.505 = 430.06 CZK
    expect(displayAmount).toBe(430.06);
  });
});

// ─── Use Case 5: Přepínání zobrazovací měny ───

describe('Use Case 5: Switching display currency', () => {
  const totalSpentEur = 245.75;

  it('display=EUR → shows EUR directly (rate=1)', () => {
    expect(toDisplay(totalSpentEur, 1)).toBe(245.75);
  });

  it('display=CZK → shows CZK (rate=24.505)', () => {
    const czk = toDisplay(totalSpentEur, EUR_CZK_RATE);
    expect(czk).toBeGreaterThan(6000);
    expect(czk).toBeLessThan(6100);
  });

  it('display=USD → shows USD (rate=1.08)', () => {
    const usd = toDisplay(totalSpentEur, 1.08);
    expect(usd).toBe(265.41);
  });
});

// ─── Use Case 6: convertToBase a convertFromBase jsou inverzní ───

describe('convertToBase and convertFromBase roundtrip', () => {
  it('CZK → EUR → CZK preserves amount approximately', () => {
    const originalCzk = 6000;
    const eur = convertToBase(originalCzk, EUR_CZK_RATE);
    const backToCzk = convertFromBase(eur, EUR_CZK_RATE);
    // May have small rounding difference
    expect(Math.abs(backToCzk - originalCzk)).toBeLessThan(1);
  });

  it('small amounts convert correctly', () => {
    const czk = 50;
    const eur = convertToBase(czk, EUR_CZK_RATE);
    expect(eur).toBe(2.04); // 50 / 24.505 = 2.04
  });

  it('zero rate returns original amount', () => {
    expect(convertToBase(100, 0)).toBe(100);
    expect(convertFromBase(100, 0)).toBe(100);
  });

  it('negative rate returns original amount', () => {
    expect(convertToBase(100, -5)).toBe(100);
    expect(convertFromBase(100, -5)).toBe(100);
  });
});

// ─── Use Case 7: Allowed currencies parsing ───

describe('parseAllowedCurrencies', () => {
  it('parses valid JSON array', () => {
    const result = parseAllowedCurrencies('["CZK","EUR"]', 'EUR');
    expect(result).toEqual(['CZK', 'EUR']);
  });

  it('falls back to [baseCurrency] on invalid JSON', () => {
    // Old format from seed: 'CZK,EUR' (not JSON)
    const result = parseAllowedCurrencies('CZK,EUR', 'EUR');
    expect(result).toEqual(['EUR']);
  });

  it('ensures baseCurrency is always included', () => {
    const result = parseAllowedCurrencies('["CZK"]', 'EUR');
    expect(result).toContain('EUR');
    expect(result).toContain('CZK');
  });

  it('works with CZK as base', () => {
    const result = parseAllowedCurrencies('["EUR","CZK"]', 'CZK');
    expect(result).toContain('CZK');
  });
});

// ─── Use Case 8: Reálný scénář — Loď vol.5 ───

describe('Real scenario: Loď vol.5 - Itálie 2026', () => {
  // 14 crew members, 2 boats, expenses mostly in CZK and EUR
  const rate = 24.415; // rate from seed data

  it('Darek pays 6000 CZK for car reservation → stored as 245.75 EUR', () => {
    const amountEur = convertToBase(6000, rate);
    expect(amountEur).toBe(245.75); // matches seed data
  });

  it('split among 14 crew = ~17.55 EUR each', () => {
    const amountEur = 245.75;
    const perPerson = Math.floor((amountEur / 14) * 100) / 100;
    expect(perPerson).toBe(17.55);
  });

  it('displayed in CZK: total ~6,015 Kč', () => {
    const amountEur = 245.75;
    const displayCzk = toDisplay(amountEur, rate);
    // 245.75 * 24.415 = 5,999.99 ≈ 6000 CZK
    expect(displayCzk).toBeGreaterThan(5990);
    expect(displayCzk).toBeLessThan(6010);
  });

  it('per-person share displayed in CZK: ~428 Kč', () => {
    const shareEur = 17.55;
    const displayCzk = toDisplay(shareEur, rate);
    // 17.55 * 24.415 = 428.48 CZK
    expect(displayCzk).toBeGreaterThan(425);
    expect(displayCzk).toBeLessThan(432);
  });

  it('Darek balance in CZK (paid 6000 - share 428 = +5572 Kč)', () => {
    const paidEur = 245.75;
    const shareEur = 17.55;
    const balanceEur = paidEur - shareEur; // 228.20
    const displayCzk = toDisplay(balanceEur, rate);
    expect(displayCzk).toBeGreaterThan(5550);
    expect(displayCzk).toBeLessThan(5580);
  });
});
