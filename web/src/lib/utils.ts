import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNowStrict } from "date-fns";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Up-to-two-letter initials for avatar fallbacks. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Clock time, e.g. "14:32". */
export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH:mm");
}

/** Conversation-list timestamp: time today, "Yesterday", weekday, else date. */
export function formatListTimestamp(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  return format(d, "dd/MM/yy");
}

/** Day divider label inside a conversation. */
export function formatDayLabel(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMMM");
}

/** "last seen 5m ago" style relative label. */
export function formatLastSeen(date: string | Date): string {
  return `last seen ${formatDistanceToNowStrict(new Date(date), { addSuffix: true })}`;
}

/** Group an ordered message list by calendar day for day-divider rendering. */
export function groupByDay<T extends { createdAt: string }>(items: T[]): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = [];
  for (const item of items) {
    const day = new Date(item.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** Human file size, e.g. "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
