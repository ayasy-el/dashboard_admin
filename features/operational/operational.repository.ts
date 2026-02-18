export type MonthRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

export type OperationalFilters = {
  categories: string[];
  branches: string[];
};

export type OperationalFilterOptions = {
  categories: string[];
  branches: string[];
};

export type OperationalRawData = {
  successCurrent: number;
  failedCurrent: number;
  successPrevious: number;
  failedPrevious: number;
  dailySuccess: { date: string; value: number }[];
  dailyFailed: { date: string; value: number }[];
  topMerchants: {
    merchant: string;
    keyword: string;
    totalTransactions: number;
    uniqMerchant: string;
    uniqRedeemer: number;
  }[];
  expiredRules: {
    merchant: string;
    keyword: string;
    startPeriod: string;
    endPeriod: string;
  }[];
  categoryMetrics: {
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
  }[];
  branchClusterMetrics: {
    branch: string;
    cluster: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
  }[];
};

export type OperationalRepository = {
  getOperationalRawData(params: MonthRange & OperationalFilters): Promise<OperationalRawData>;
  getOperationalFilterOptions(): Promise<OperationalFilterOptions>;
};
