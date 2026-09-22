// This app always displays times in a fixed UTC+3 ("Helsinki") offset,
// regardless of the viewer's own machine timezone, so replay times read
// consistently for everyone. The backend stores/serves true UTC.
const HELSINKI_OFFSET_SECONDS = 3 * 3600;

/** Epoch seconds (true UTC) shifted by the fixed Helsinki offset -- feed
 * this to lightweight-charts, which formats time labels using UTC getters,
 * so the axis reads as Helsinki wall-clock time. */
export function toChartTime(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000) + HELSINKI_OFFSET_SECONDS;
}

/** Formats an ISO timestamp as "YYYY-MM-DD HH:mm:ss" in the fixed Helsinki offset. */
export function formatHelsinki(iso: string): string {
  const shifted = new Date(Date.parse(iso) + HELSINKI_OFFSET_SECONDS * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

export function formatDurationMinutes(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}
