export function timeAgo(timestamp) {
  if (!timestamp) return 'never';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getLastFridayOfMonth(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  const dow = lastDay.getDay();
  const diff = (dow >= 5) ? dow - 5 : dow + 2;
  lastDay.setDate(lastDay.getDate() - diff);
  return lastDay;
}

export function addMonthsClamped(timestamp, deltaMonths = 1) {
  const source = new Date(timestamp);
  const targetMonth = source.getMonth() + deltaMonths;
  const lastDay = new Date(source.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(
    source.getFullYear(),
    targetMonth,
    Math.min(source.getDate(), lastDay),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  ).getTime();
}

export function getPartnerDepositDate(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  const dow = lastDay.getDay();
  if (dow === 0) lastDay.setDate(lastDay.getDate() - 2);
  else if (dow === 6) lastDay.setDate(lastDay.getDate() - 1);
  return lastDay;
}

export function getCurrentWeekStart(timestamp = Date.now()) {
  const now = new Date(timestamp);
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return sunday.getTime();
}

export function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const a = new Date(ts1);
  const b = new Date(ts2);
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
