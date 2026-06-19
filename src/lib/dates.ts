export function localDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

export function formatShortDate(dateIso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}
