export type MonthRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
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
};

export type OperationalRepository = {
  getOperationalRawData(params: MonthRange): Promise<OperationalRawData>;
};
