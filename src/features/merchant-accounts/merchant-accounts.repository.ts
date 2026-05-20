export type MerchantAccountSummary = {
  id: number;
  email: string;
  username: string | null;
  isActive: boolean;
  merchantCount: number;
  sampleMerchantName: string | null;
};

export type MerchantAccountMerchant = {
  merchantKey: string;
  keywordCode: string;
  merchantName: string;
  uniqMerchant: string;
  branchName: string | null;
  categoryName: string | null;
  ownerUserId: number | null;
  ownerEmail: string | null;
  ownerUsername: string | null;
  ownerIsActive: boolean;
  canonicalMerchantKey: string | null;
  canonicalMerchantName: string | null;
};

export type MerchantAccountDetail = MerchantAccountSummary & {
  merchants: MerchantAccountMerchant[];
};

export type MerchantAccountsDashboardData = {
  accounts: MerchantAccountSummary[];
  selectedAccount: MerchantAccountDetail | null;
  merchantPool: MerchantAccountMerchant[];
  summary: {
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    linkedAccounts: number;
    unlinkedAccounts: number;
    totalMerchants: number;
    unconnectedMerchants: number;
  };
};

export interface MerchantAccountsRepository {
  getDashboardData(selectedAccountId?: number | null): Promise<MerchantAccountsDashboardData>;
}
