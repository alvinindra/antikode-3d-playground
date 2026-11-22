export type DaylightMode = 'auto' | 'day' | 'night';

export function isLocalDay(now = new Date()) {
  const hour = now.getHours();
  return hour >= 6 && hour < 16;
}
