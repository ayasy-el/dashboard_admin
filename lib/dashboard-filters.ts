export type DashboardFilterSelection = {
  months: string[];
  categories: string[];
  branches: string[];
  merchants: string[];
};

export const buildFilterSearchParams = (filters: DashboardFilterSelection) => {
  const params = new URLSearchParams();
  filters.months.forEach((month) => params.append("month", month));
  filters.categories.forEach((category) => params.append("category", category));
  filters.branches.forEach((branch) => params.append("branch", branch));
  filters.merchants.forEach((merchant) => params.append("merchant", merchant));
  return params;
};
