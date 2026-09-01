export type Tab = "today" | "check" | "desk" | "progress" | "learn";

export const TABS: Tab[] = ["today", "check", "desk", "progress", "learn"];

export const TAB_LABELS: Record<Tab, string> = {
  today: "Today",
  check: "Check",
  desk: "Desk",
  progress: "Progress",
  learn: "Learn",
};
