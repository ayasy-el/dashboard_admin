export const parseMonth = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }
  return value;
};

export const monthToDateUtc = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

export const addMonthsUtc = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
};

export const formatMonthUtc = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
};

export const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

export const toSqlTimestamp = (date: Date) => date.toISOString();

export const toSqlDate = (date: Date) => date.toISOString().slice(0, 10);
