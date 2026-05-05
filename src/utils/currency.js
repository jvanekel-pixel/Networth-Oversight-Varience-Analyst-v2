export function parseCentsInput(digitString) {
  if (!digitString) return 0;
  return Math.floor(parseInt(digitString, 10)) || 0;
}

export function formatCents(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  const c = Math.trunc(cents);
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100);
  const pennies = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${dollars.toLocaleString('en-US')}.${pennies}`;
}

export function formatCentsShort(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  const c = Math.trunc(cents);
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100);
  const pennies = abs % 100;
  if (pennies === 0) return `${sign}$${dollars.toLocaleString('en-US')}`;
  return `${sign}$${dollars.toLocaleString('en-US')}.${pennies.toString().padStart(2, '0')}`;
}

export function formatCentsWholeFloor(cents) {
  if (cents === null || cents === undefined) return '$0';
  const c = Math.trunc(Number(cents));
  if (!Number.isFinite(c)) return '$0';
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100);
  return `${sign}$${dollars.toLocaleString('en-US')}`;
}

export function formatCentsInputValue(cents) {
  if (cents === null || cents === undefined) return '';
  const c = Math.trunc(Number(cents));
  if (!Number.isFinite(c)) return '';
  return (c / 100).toFixed(2);
}

export function parseBillInput(decimalString) {
  if (!decimalString) return 0;
  const parsed = parseFloat(decimalString);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
