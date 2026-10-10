const poundFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

export function formatPoundPrice(value: string | number) {
  const price = Number(value);
  return Number.isFinite(price) ? poundFormatter.format(price) : String(value);
}
