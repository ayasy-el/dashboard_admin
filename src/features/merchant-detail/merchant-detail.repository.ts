export type MerchantDetailMonthRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

export type MerchantDetailSummary = {
  totalTransactions: number;
  uniqueRedeemer: number;
  totalPoint: number;
};

export type MerchantDetailRawData = {
  identity: {
    keyword: string;
    merchant: string;
    uniqMerchant: string;
    category: string;
    branch: string;
    cluster: string;
    region: string;
  } | null;
  currentSummary: MerchantDetailSummary;
  previousSummary: MerchantDetailSummary;
  monthlyPerformance: {
    month: string;
    redeem: number;
    uniqueRedeem: number;
  }[];
  keywordComposition: {
    keyword: string;
    redeem: number;
  }[];
  dailyTrend: {
    date: string;
    redeem: number;
    uniqueRedeemer: number;
    totalPoint: number;
  }[];
  ruleStatuses: {
    keyword: string;
    status: string;
    startPeriod: string;
    endPeriod: string;
    daysLeft: number;
  }[];
  transactions: {
    transactionAt: string;
    keyword: string;
    status: string;
    qty: number;
    totalPoint: number;
    branch: string;
  }[];
};

export type MerchantDetailRepository = {
  getMerchantDetailRawData(
    keyword: string,
    params: MerchantDetailMonthRange,
  ): Promise<MerchantDetailRawData>;
};
