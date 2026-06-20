export function localDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

export function localWeekStartKey(date = new Date()) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + mondayOffset);

  return localDateKey(weekStart);
}

export function formatShortDate(dateIso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}
