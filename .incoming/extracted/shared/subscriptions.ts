export function getNextMonthlyRenewal(startedAt: Date) {
  const renewal = new Date(startedAt);
  const day = renewal.getDate();
  renewal.setDate(1);
  renewal.setMonth(renewal.getMonth() + 1);
  const lastDayOfMonth = new Date(renewal.getFullYear(), renewal.getMonth() + 1, 0).getDate();
  renewal.setDate(Math.min(day, lastDayOfMonth));
  return renewal;
}
