/**
 * Czech "QR Platba" (SPAYD — Short Payment Descriptor) helpers.
 *
 * Lets the crew pay each other by scanning a QR code in any Czech banking app.
 * A user stores their account either as a Czech account number
 * (`[prefix-]number/bankcode`, e.g. `19-123456789/0800`) or as an IBAN; we
 * convert to IBAN for the SPAYD `ACC` field. The amount is in CZK (the crew
 * settles in CZK at the trip rate), CC:CZK.
 *
 * SPAYD spec: https://qr-platba.cz/pro-vyvojare/specifikace-formatu/
 */

export interface CzechAccount {
  prefix: string; // 0–6 digits (may be empty)
  number: string; // 2–10 digits
  bankCode: string; // 4 digits
}

/** Strip diacritics + disallowed chars so the SPAYD MSG is bank-safe ASCII. */
export function sanitizeSpaydText(text: string, maxLen = 35): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[*]/g, ' ') // '*' is the SPAYD field separator
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Parse `[prefix-]number/bankcode` (spaces allowed). Returns null if not that shape. */
export function parseCzechAccount(input: string): CzechAccount | null {
  const cleaned = input.replace(/\s+/g, '');
  const m = cleaned.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return null;
  return { prefix: m[1] ?? '', number: m[2], bankCode: m[3] };
}

/** ISO 7064 mod-97 over a numeric string, processed in chunks (no overflow). */
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + (numeric.charCodeAt(i) - 48)) % 97;
  }
  return remainder;
}

/** Build a Czech IBAN from a domestic account number. */
export function czAccountToIban(acc: CzechAccount): string {
  const bban =
    acc.bankCode +
    acc.prefix.padStart(6, '0') +
    acc.number.padStart(10, '0'); // 4 + 6 + 10 = 20 digits
  // Move "CZ00" to the end, C=12, Z=35 → "1235", check digits as "00".
  const check = 98 - mod97(bban + '123500');
  return 'CZ' + String(check).padStart(2, '0') + bban;
}

/** Normalize an IBAN string (uppercase, no spaces). */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Validate any IBAN by its mod-97 checksum. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban) || iban.length < 15 || iban.length > 34) {
    return false;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

/**
 * Convert a stored account string (Czech account number OR IBAN) to a valid
 * IBAN, or null if it can't be parsed/validated.
 */
export function toIban(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  // Already an IBAN?
  const maybeIban = normalizeIban(trimmed);
  if (/^[A-Z]{2}\d{2}/.test(maybeIban)) {
    return isValidIban(maybeIban) ? maybeIban : null;
  }

  const acc = parseCzechAccount(trimmed);
  if (!acc) return null;
  const iban = czAccountToIban(acc);
  return isValidIban(iban) ? iban : null;
}

/** True if a stored account string is usable for a QR payment. */
export function isPayableAccount(stored: string | null | undefined): boolean {
  return toIban(stored) !== null;
}

export interface SpaydOptions {
  iban: string;
  amount: number; // in CZK
  message?: string;
  variableSymbol?: string;
}

/** Build the SPAYD payload string that a QR code will encode. */
export function buildSpayd({ iban, amount, message, variableSymbol }: SpaydOptions): string {
  const parts = [
    'SPD',
    '1.0',
    `ACC:${normalizeIban(iban)}`,
    `AM:${amount.toFixed(2)}`,
    'CC:CZK',
  ];
  if (message) parts.push(`MSG:${sanitizeSpaydText(message, 60)}`);
  if (variableSymbol) parts.push(`X-VS:${variableSymbol.replace(/\D/g, '').slice(0, 10)}`);
  return parts.join('*');
}

/**
 * Convenience: build the SPAYD string for paying `amountCzk` to a person whose
 * stored account is `account`. Returns null if the account isn't payable.
 */
export function spaydForPayment(
  account: string | null | undefined,
  amountCzk: number,
  message?: string,
): string | null {
  const iban = toIban(account);
  if (!iban) return null;
  return buildSpayd({ iban, amount: amountCzk, message });
}
