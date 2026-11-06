/** Format an epoch-ms timestamp as a short relative time ("2h", "5d", "3w"). */
export function relativeTime(ts: number): string {
  const now = Date.now();
  if (ts <= 0 || now - ts < 0) return 'unknown';
  const seconds = Math.round((now - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}

/** Format the remaining time until an expiry timestamp ("<1 min", "5 min"). */
export function expiryLabel(expiresAt: number): string {
  const minutes = Math.ceil((expiresAt - Date.now()) / 60000);
  if (minutes < 1) return '<1 min';
  return `${minutes} min`;
}

/** Format a remaining duration in milliseconds as "m:ss". */
export function countdownLabel(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Format a Date as human-readable relative time with decaying precision.
 *  "2h ago" → "Wednesday" → "23 Oct" → "23 Oct 2025" */
export function humanRelativeTime(date: Date, now: number = Date.now()): string {
  const ts = date.getTime();
  if (ts <= 0 || now - ts < 0) return 'unknown';
  const diffMs = now - ts;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 2) return 'yesterday';
  if (diffDays < 7) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayMonth = `${date.getDate()} ${months[date.getMonth()]}`;
  return date.getFullYear() === new Date(now).getFullYear() ? dayMonth : `${dayMonth} ${date.getFullYear()}`;
}

/** Format a Date as a full local date and time for tooltips. */
export function fullTimestamp(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}
