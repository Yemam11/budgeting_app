const CA_PROVINCES = new Set([
  'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU',
]);

const LEADING_NOISE = /^(opos|pos purchase|pos|mb-|opos\s|sq \*|sp \*|tst\*|tst \*|paypal \*|pp\*|pp \*|dn\*)\s*/i;

export function normalizeMerchant(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();

  s = s.replace(LEADING_NOISE, '');

  s = s.replace(/#\w+/g, ' ');

  s = s.replace(/\b\d{3,}\b/g, ' ');

  const tokens = s.split(/[\s,]+/).filter(Boolean);
  const cleaned: string[] = [];
  for (const tok of tokens) {
    const upper = tok.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length === 2 && CA_PROVINCES.has(upper)) continue;
    cleaned.push(tok);
  }

  s = cleaned.join(' ');

  s = s.replace(/[^\w\s.&']/g, ' ');

  s = s.replace(/\s+/g, ' ').trim().toLowerCase();

  const words = s.split(' ');
  if (words.length > 4) {
    s = words.slice(0, 4).join(' ');
  }

  return s;
}

export function makeDedupeKey(parts: {
  bank: string;
  date: string;
  amount: number;
  rawDesc: string;
}): string {
  return [
    parts.bank,
    parts.date,
    parts.amount.toFixed(2),
    parts.rawDesc.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|');
}
