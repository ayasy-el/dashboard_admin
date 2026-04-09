export type MerchantDirectoryMonthRange = {
  start: Date;
  end: Date;
};

export type MerchantDirectoryItem = {
  keyword: string;
  merchant: string;
  uniqMerchant: string;
  category: string;
  branch: string;
  cluster: string;
  region: string;
  pointRedeem: number;
  ruleStatus: string;
  startPeriod: string | null;
  endPeriod: string | null;
  redeem: number;
  uniqueRedeemer: number;
  totalPoint: number;
  lastTransactionAt: string | null;
};

export type MerchantDirectoryRawData = {
  summary: {
    totalKeywords: number;
    totalUniqueMerchants: number;
    activeKeywords: number;
    productiveKeywords: number;
    totalTransactions: number;
    totalPoint: number;
  };
  merchants: MerchantDirectoryItem[];
};

export type MerchantDirectoryRepository = {
  getMerchantDirectoryRawData(params: MerchantDirectoryMonthRange): Promise<MerchantDirectoryRawData>;
};
