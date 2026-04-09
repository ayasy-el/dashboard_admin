export const DASHBOARD_FILTER_COOKIE_NAME = "dashboard_filters";
export const DASHBOARD_FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type DashboardFilterCookieState = {
  month: string | null;
  categories: string[];
  branches: string[];
};

const EMPTY_FILTERS: DashboardFilterCookieState = {
  month: null,
  categories: [],
  branches: [],
};

const normalizeArray = (values: unknown) => {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
};

export const parseDashboardFilterCookie = (rawValue: string | undefined | null): DashboardFilterCookieState => {
  if (!rawValue) return EMPTY_FILTERS;

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<DashboardFilterCookieState>;

    return {
      month: typeof parsed.month === "string" && parsed.month.trim() ? parsed.month.trim() : null,
      categories: normalizeArray(parsed.categories),
      branches: normalizeArray(parsed.branches),
    };
  } catch {
    return EMPTY_FILTERS;
  }
};

export const serializeDashboardFilterCookie = (value: DashboardFilterCookieState) =>
  encodeURIComponent(
    JSON.stringify({
      month: value.month,
      categories: normalizeArray(value.categories),
      branches: normalizeArray(value.branches),
    }),
  );
