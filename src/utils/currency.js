export function parseCentsInput(digitString) {
  if (!digitString) return 0;
  return Math.floor(parseInt(digitString, 10)) || 0;
}

export function formatCents(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  const c = Math.floor(cents);
  const dollars = Math.floor(c / 100);
  const pennies = Math.abs(c % 100).toString().padStart(2, '0');
  return `$${dollars.toLocaleString('en-US')}.${pennies}`;
}

export function formatCentsShort(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  const c = Math.floor(cents);
  const dollars = Math.floor(c / 100);
  const pennies = Math.abs(c % 100);
  if (pennies === 0) return `$${dollars.toLocaleString('en-US')}`;
  return `$${dollars.toLocaleString('en-US')}.${pennies.toString().padStart(2, '0')}`;
}

export function parseBillInput(decimalString) {
  if (!decimalString) return 0;
  const parsed = parseFloat(decimalString);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
