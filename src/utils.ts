export function getDaysBetween(start: string, end: string) {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
}

export function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
