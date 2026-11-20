import { t, type Unit } from "@/content/strings";

// Thresholds sit a little below each unit so "23 h 59 min left" reads as "1 day".
function largestUnit(seconds: number): [number, Unit] {
  if (seconds >= 86_400 - 120) return [Math.round(seconds / 86_400), "day"];
  if (seconds >= 3_600 - 120) return [Math.round(seconds / 3_600), "hour"];
  return [Math.max(1, Math.round(seconds / 60)), "minute"];
}

/** "1 day", "12 hours"… */
export function formatDuration(seconds: number): string {
  return t.time.duration(...largestUnit(seconds));
}

/** "in 3 hours", relative to now. */
export function formatExpiry(unixSeconds: number): string {
  return t.time.in(...largestUnit(unixSeconds - Date.now() / 1000));
}

/** Human byte size: 512 B, 12.3 KB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

export const utf8Length = (text: string) => new TextEncoder().encode(text).length;
