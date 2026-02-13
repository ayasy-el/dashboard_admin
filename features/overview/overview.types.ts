export type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  previousMonthLabel: string;
  cards: {
    totalPoinPelanggan: number;
    totalTransaksi: number;
    totalPoin: number;
    totalRedeemer: number;
    previous: {
      totalPoinPelanggan: number;
      totalTransaksi: number;
      totalPoin: number;
      totalRedeemer: number;
    };
  };
  dailyPoints: { date: string; value: number }[];
  dailyTransactions: { date: string; value: number }[];
  dailyRedeemer: { date: string; value: number }[];
  monthlyTransactions: { month: string; value: number }[];
  categoryBreakdown: { name: string; value: number; percent: number }[];
  branchTable: {
    branches: {
      id: number;
      name: string;
      totalMerchant: number;
      uniqueMerchant: number;
      totalPoint: number;
      totalTransaksi: number;
      uniqueRedeemer: number;
      merchantAktif: number;
      merchantProduktif: number;
      children: {
        id: number;
        name: string;
        totalMerchant: number;
        uniqueMerchant: number;
        totalPoint: number;
        totalTransaksi: number;
        uniqueRedeemer: number;
        merchantAktif: number;
        merchantProduktif: number;
      }[];
    }[];
  };
  categoryTable: {
    id: number;
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
  }[];
  notActiveMerchants: {
    branch: string;
    merchant: string;
    keyword: string;
  }[];
  merchantPerMonth: {
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
  expiredMerchants: {
    branch: string;
    merchant: string;
    keyword: string;
  }[];
};
