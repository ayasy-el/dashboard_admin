import type { MerchantAccountsRepository } from "@/features/merchant-accounts/merchant-accounts.repository";

export async function getMerchantAccountsDashboard(
  repository: MerchantAccountsRepository,
  selectedAccountId?: number | null,
) {
  return repository.getDashboardData(selectedAccountId);
}
