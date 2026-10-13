// Inches, millimetres and fractions, the way a drill index labels them. No page code, so the tests run it in Node.

export const MM = 25.4; // millimetres in an inch, exactly
export const inToMm = x => x * MM;
export const mmToIn = x => x / MM;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// A length in inches as the nearest fraction over `den` (64ths unless asked): { whole, num, den }.
export function toFrac(inches, den = 64) {
  const n = Math.round(inches * den);
  const whole = Math.floor(n / den);
  let num = n - whole * den, d = den;
  if (num) { const g = gcd(num, d); num /= g; d /= g; }
  return { whole, num, den: d };
}

// Is this length an exact fraction over `den`? (to a hair, so 0.109375 counts as 7/64)
export const isFrac = (inches, den = 64) => Math.abs(inches * den - Math.round(inches * den)) < 1e-6;

// 7/64, 1-1/2, 1 (no inch mark).
export function fracText(inches, den = 64) {
  const { whole, num, den: d } = toFrac(inches, den);
  if (!num) return String(whole);
  return whole ? `${whole}-${num}/${d}` : `${num}/${d}`;
}

// The same as markup: 1<span class="sp">-</span><span class="fr">1/2</span>. Big type sets the fraction as a real
// one and hides the dash (1½); running text leaves it as 1-1/2. The font's fraction feature only touches the
// span, so a whole number in front stays full size.
export function fracHTML(inches, den = 64) {
  const { whole, num, den: d } = toFrac(inches, den);
  if (!num) return String(whole);
  const fr = `<span class="fr">${num}/${d}</span>`;
  return whole ? `${whole}<span class="sp">-</span>${fr}` : fr;
}

// A number to so many places, halves rounded up the way charts round them. toFixed alone prints 1/8″ as
// 3.17 mm, because 3.175 is kept as 3.17499…; the nudge puts it back over the half.
export function fixed(x, places) {
  const f = 10 ** places;
  return (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-7) / f).toFixed(places);
}

// Decimal inches the way drill charts print them: 0.1094, 0.201, 0.25.
export function decIn(inches, places = 4) {
  let s = fixed(inches, places);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s; // the leading zero stays: 0.1094
}

// Millimetres: 2.5, 2.78, 3.18, 35 (two places at most, no trailing zeros).
export function mmText(mm, places = 2) {
  let s = fixed(mm, places);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// How far one size is from another, in the units that make sense for the job:
// thousandths for inch work (0.0035″), hundredths of a millimetre for metric (0.05 mm).
export function offText(diffMm, metric) {
  const a = Math.abs(diffMm);
  if (metric) {
    const s = a < 0.1 ? fixed(a, 2) : mmText(a, 2);
    return `${s} mm`;
  }
  const inch = mmToIn(a);
  const s = inch < 0.001 ? fixed(inch, 4) : decIn(inch, 4);
  return `${s}″`;
}

// Small enough to call the same size.
export const SAME_MM = 0.006;

// How far a bit is from the size wanted: exact, 0.0035″ big, 0.05 mm small.
export function offWords(diffMm, metric) {
  if (Math.abs(diffMm) < SAME_MM) return 'exact';
  return `${offText(diffMm, metric)} ${diffMm > 0 ? 'big' : 'small'}`;
}
