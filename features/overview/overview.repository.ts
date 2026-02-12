export type MonthRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

export type OverviewRawData = {
  summary: {
    totalTransaksi: number;
    totalPoint: number;
    totalRedeemer: number;
  };
  previousSummary: {
    totalTransaksi: number;
    totalPoint: number;
    totalRedeemer: number;
  };
  dailyPoints: { date: string; value: number }[];
  dailyTransactions: { date: string; value: number }[];
  dailyRedeemer: { date: string; value: number }[];
  monthlyTransactionsRaw: { month: string; value: number }[];
  categoryRaw: { name: string; value: number }[];
  branchClusterRows: {
    branch: string;
    cluster: string;
    total_merchant: number;
    unique_merchant: number;
    total_point: number;
    total_transaksi: number;
    unique_redeemer: number;
    merchant_aktif: number;
  }[];
  produktifRows: {
    branch: string;
    cluster: string;
    merchant_productif: number;
  }[];
  categoryTableRaw: {
    name: string;
    total_merchant: number;
    unique_merchant: number;
    total_point: number;
    total_transaksi: number;
    unique_redeemer: number;
    merchant_aktif: number;
  }[];
  categoryProduktifRaw: {
    category: string;
    merchant_productif: number;
  }[];
  notActiveMerchantRaw: {
    branch: string;
    merchant: string;
    keyword: string;
  }[];
  merchantPerMonthRaw: {
    category: string;
    branch: string;
    merchant: string;
    keyword: string;
    startPeriod: string;
    endPeriod: string;
    point: number;
    redeem: number;
    uniqueRedeem: number;
  }[];
  clusterPointCurrent: number;
  clusterPointPrevious: number;
};

export type OverviewRepository = {
  getOverviewRawData(params: MonthRange): Promise<OverviewRawData>;
};
