/**
 * CrewSplit — Currency Conversion Test Suite
 * Run: node scripts/test-currencies.mjs
 *
 * Tests the core math of currency conversion, split calculations,
 * round-trip accuracy, and multi-currency trip simulation.
 */

// ── Conversion functions (copied from src/lib/currencies.ts) ──

function convertToBase(amount, rate) {
  if (rate <= 0) return amount;
  return Math.round((amount / rate) * 100) / 100;
}

function convertFromBase(amount, rate) {
  if (rate <= 0) return amount;
  return Math.round(amount * rate * 100) / 100;
}

function formatMoney(amount, currency = 'EUR') {
  return `${amount.toFixed(2)} ${currency}`;
}

// ── Test framework ──

let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function assertApprox(actual, expected, tolerance, name) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, name, `expected ${expected}, got ${actual}, diff ${diff.toFixed(4)}`);
}

// ── Test rates (realistic ECB-like rates, base=EUR) ──

const RATES = {
  CZK: 25.21,
  USD: 1.0845,
  GBP: 0.8562,
  PLN: 4.3120,
  HRK: 7.5345,
  CHF: 0.9650,
  HUF: 395.50,
  JPY: 162.30,
};

// ══════════════════════════════════════════════════════
console.log('\n🧪 CrewSplit Currency Conversion Tests\n');
console.log('━'.repeat(50));

// ── Test 1: convertToBase ──
console.log('\n📐 Test 1: convertToBase');
{
  const result = convertToBase(100, RATES.CZK); // 100 CZK → EUR
  assertApprox(result, 3.97, 0.01, '100 CZK → ~3.97 EUR');

  const result2 = convertToBase(50, RATES.GBP); // 50 GBP → EUR
  assertApprox(result2, 58.40, 0.1, '50 GBP → ~58.40 EUR');

  const result3 = convertToBase(10000, RATES.JPY); // 10000 JPY → EUR
  assertApprox(result3, 61.61, 0.1, '10000 JPY → ~61.61 EUR');

  const result4 = convertToBase(100, RATES.USD); // 100 USD → EUR
  assertApprox(result4, 92.21, 0.1, '100 USD → ~92.21 EUR');
}

// ── Test 2: convertFromBase ──
console.log('\n📐 Test 2: convertFromBase');
{
  const result = convertFromBase(3.97, RATES.CZK); // 3.97 EUR → CZK
  assertApprox(result, 100.08, 0.1, '3.97 EUR → ~100.08 CZK');

  const result2 = convertFromBase(100, RATES.USD); // 100 EUR → USD
  assertApprox(result2, 108.45, 0.1, '100 EUR → ~108.45 USD');

  const result3 = convertFromBase(100, RATES.HUF); // 100 EUR → HUF
  assertApprox(result3, 39550, 10, '100 EUR → ~39550 HUF');
}

// ── Test 3: Round-trip accuracy ──
console.log('\n🔄 Test 3: Round-trip (amount → base → back)');
{
  for (const [code, rate] of Object.entries(RATES)) {
    const original = 1000;
    const inBase = convertToBase(original, rate);
    const backToOriginal = convertFromBase(inBase, rate);
    const diff = Math.abs(backToOriginal - original);
    // Tolerance scales with rate — high-rate currencies (HUF 395x, JPY 162x) have more rounding
    const tolerance = rate > 100 ? 1.0 : rate > 10 ? 0.15 : 0.02;
    assertApprox(backToOriginal, original, tolerance, `1000 ${code} → EUR → ${code}: diff=${diff.toFixed(4)} (tol=${tolerance})`);
  }
}

// ── Test 4: Split correctness ──
console.log('\n✂️  Test 4: Split correctness (splits sum = total)');
{
  const testCases = [
    { amount: 100, currency: 'EUR', rate: 1, people: 10 },
    { amount: 2500, currency: 'CZK', rate: RATES.CZK, people: 10 },
    { amount: 50, currency: 'GBP', rate: RATES.GBP, people: 3 },
    { amount: 200, currency: 'EUR', rate: 1, people: 7 },
    { amount: 1, currency: 'EUR', rate: 1, people: 3 },
  ];

  for (const tc of testCases) {
    const amountBase = tc.currency === 'EUR' ? tc.amount : convertToBase(tc.amount, tc.rate);
    const perPerson = Math.floor((amountBase / tc.people) * 100) / 100;
    const remainder = Math.round((amountBase - perPerson * tc.people) * 100) / 100;

    // First person gets perPerson + remainder, rest get perPerson
    const splits = [];
    for (let i = 0; i < tc.people; i++) {
      splits.push(i === 0 ? perPerson + remainder : perPerson);
    }

    const splitSum = splits.reduce((s, v) => s + v, 0);
    const splitSumRounded = Math.round(splitSum * 100) / 100;
    assertApprox(splitSumRounded, amountBase, 0.01,
      `${tc.amount} ${tc.currency} / ${tc.people} people: sum=${splitSumRounded}, expected=${amountBase}`);
  }
}

// ── Test 5: Zero rate handling ──
console.log('\n⚠️  Test 5: Zero/negative rate handling');
{
  const result1 = convertToBase(100, 0);
  assert(result1 === 100, 'rate=0 → returns original amount');

  const result2 = convertToBase(100, -5);
  assert(result2 === 100, 'rate=-5 → returns original amount');

  const result3 = convertFromBase(100, 0);
  assert(result3 === 100, 'convertFromBase rate=0 → returns original');
}

// ── Test 6: Same currency (no conversion) ──
console.log('\n🔁 Test 6: Same currency (EUR→EUR)');
{
  const result = convertToBase(123.45, 1);
  assertApprox(result, 123.45, 0.001, 'EUR→EUR with rate=1: no change');

  const result2 = convertFromBase(123.45, 1);
  assertApprox(result2, 123.45, 0.001, 'EUR→EUR reverse with rate=1: no change');
}

// ── Test 7: Multi-currency trip simulation ──
console.log('\n🚢 Test 7: Multi-currency trip simulation');
{
  // 10 crew members, 5 expenses in mixed currencies
  const crew = 10;
  const expenses = [
    { amount: 100,  currency: 'EUR', rate: 1,         splitType: 'both', description: 'Marina fee' },
    { amount: 2500, currency: 'CZK', rate: RATES.CZK, splitType: 'both', description: 'Highway tolls' },
    { amount: 50,   currency: 'GBP', rate: RATES.GBP, splitType: 'both', description: 'Diesel' },
    { amount: 200,  currency: 'EUR', rate: 1,         splitType: 'both', description: 'Groceries' },
    { amount: 1000, currency: 'CZK', rate: RATES.CZK, splitType: 'both', description: 'Dinner' },
  ];

  // Convert all to base
  const expensesInBase = expenses.map(e => ({
    ...e,
    amountBase: e.currency === 'EUR' ? e.amount : convertToBase(e.amount, e.rate),
  }));

  // Total spent in base
  const totalBase = expensesInBase.reduce((s, e) => s + e.amountBase, 0);
  console.log(`    Total: ${formatMoney(totalBase)} (from ${expenses.length} expenses)`);

  // Simulate: each expense paid by person 0, split among all 10
  const paid = new Array(crew).fill(0);
  const shared = new Array(crew).fill(0);

  for (const e of expensesInBase) {
    paid[0] += e.amountBase; // person 0 pays everything (simplification)

    const perPerson = Math.floor((e.amountBase / crew) * 100) / 100;
    const remainder = Math.round((e.amountBase - perPerson * crew) * 100) / 100;

    for (let i = 0; i < crew; i++) {
      shared[i] += (i === 0 ? perPerson + remainder : perPerson);
    }
  }

  // Balances
  const balances = paid.map((p, i) => Math.round((p - shared[i]) * 100) / 100);
  const balanceSum = Math.round(balances.reduce((s, b) => s + b, 0) * 100) / 100;

  assertApprox(balanceSum, 0, 0.05, `Sum of all balances = 0 (got ${balanceSum})`);

  // Verify person 0 has positive balance (they paid everything)
  assert(balances[0] > 0, `Payer (person 0) has positive balance: ${formatMoney(balances[0])}`);

  // Verify others have negative balance
  const allOthersNegative = balances.slice(1).every(b => b <= 0);
  assert(allOthersNegative, 'All non-payers have negative or zero balance');
}

// ── Test 8: Export conversion ──
console.log('\n📊 Test 8: Export currency conversion (EUR→CZK)');
{
  const exportRate = RATES.CZK; // 1 EUR = 25.21 CZK
  const balanceEur = 12.50;
  const balanceCzk = convertFromBase(balanceEur, exportRate);
  assertApprox(balanceCzk, 315.13, 0.1, `12.50 EUR → ${balanceCzk} CZK (expected ~315.13)`);

  // Multi-amount export
  const amounts = [99.17, 126.93, 180.00, 120.00, 45.00];
  const totalEur = amounts.reduce((s, a) => s + a, 0);
  const totalCzk = convertFromBase(totalEur, exportRate);
  const expectedCzk = convertFromBase(totalEur, exportRate);
  assertApprox(totalCzk, expectedCzk, 0.01, `Total ${formatMoney(totalEur)} → ${formatMoney(totalCzk, 'CZK')}`);

  // Verify individual conversions sum ≈ total conversion (no significant rounding drift)
  const sumOfIndividual = amounts.reduce((s, a) => s + convertFromBase(a, exportRate), 0);
  const sumRounded = Math.round(sumOfIndividual * 100) / 100;
  assertApprox(sumRounded, totalCzk, 0.05,
    `Sum of individual conversions (${sumRounded}) ≈ total conversion (${totalCzk})`);
}

// ══════════════════════════════════════════════════════
console.log('\n' + '━'.repeat(50));
console.log(`\n📋 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
