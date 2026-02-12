import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useEffect, useState } from "react";

// Mock data for demonstration
const mockData = {
  burningPoin: 360100000,
  totalMerchant: 190,
  merchantPerMonth: [
    { month: "Jan", redeem: 45000000, uniqueRedeem: 38000000 },
    { month: "Feb", redeem: 48000000, uniqueRedeem: 42000000 },
    { month: "Mar", redeem: 52000000, uniqueRedeem: 45000000 },
    { month: "Apr", redeem: 49000000, uniqueRedeem: 43000000 },
    { month: "May", redeem: 55000000, uniqueRedeem: 48000000 },
    { month: "Jun", redeem: 58000000, uniqueRedeem: 51000000 },
    { month: "Jul", redeem: 62000000, uniqueRedeem: 54000000 },
    { month: "Aug", redeem: 60000000, uniqueRedeem: 52000000 },
    { month: "Sep", redeem: 65000000, uniqueRedeem: 57000000 },
    { month: "Oct", redeem: 68000000, uniqueRedeem: 60000000 },
    { month: "Nov", redeem: 70000000, uniqueRedeem: 62000000 },
    { month: "Dec", redeem: 72000000, uniqueRedeem: 64000000 },
  ],
  merchantCategories: [
    { name: "Health & Beauty", value: 42.3 },
    { name: "Food", value: 15.5 },
    { name: "Dining", value: 12.1 },
    { name: "Entertainment", value: 8.7 },
    { name: "Travel", value: 6.2 },
    { name: "Shop", value: 5.8 },
    { name: "Sport and Education", value: 4.1 },
    { name: "Lifestyle", value: 3.2 },
    { name: "Program", value: 2.1 },
  ],
  topMerchants: [
    { name: "Prodia Sidoarjo", redeem: 12500000, uniqueRedeem: 12000000 },
    { name: "Nakamura Jember", redeem: 11800000, uniqueRedeem: 11500000 },
    { name: "Beautiff Clinic", redeem: 10500000, uniqueRedeem: 10200000 },
    { name: "Laboratorium Klinik", redeem: 9800000, uniqueRedeem: 9500000 },
    { name: "Aromatherapy Family", redeem: 9200000, uniqueRedeem: 8800000 },
  ],
  regionRedeem: [
    { region: "Surabaya", redeem: 45000000, percentage: 25 },
    { region: "Malang", redeem: 38000000, percentage: 21 },
    { region: "Jember", redeem: 32000000, percentage: 18 },
    { region: "Madiun", redeem: 28000000, percentage: 16 },
    { region: "Kediri", redeem: 25000000, percentage: 14 },
    { region: "Sidoarjo", redeem: 22000000, percentage: 6 },
  ],
  expiredMerchants: [
    { name: "Merchant A", expiry: "15 Mar 2026" },
    { name: "Merchant B", expiry: "22 Mar 2026" },
  ],
  merchantStats: [
    { type: "Active", value: 156, percentage: 82.1 },
    { type: "Productive", value: 112, percentage: 58.9 },
    { type: "Not Active", value: 34, percentage: 17.9 },
  ]
};

export default function EnhancedDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("2026");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedMerchant, setSelectedMerchant] = useState("all");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Colors for charts
  const COLORS = ['#FF0000', '#FF6B00', '#FF8C00', '#FFA500', '#FFB300', '#FFBF00', '#FFCC00', '#FFD700', '#FFE400'];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Header with filters */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
                <div className="flex items-center gap-4">
                  {currentDate && (
                    <Badge variant="secondary" className="text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(currentDate, "d MMM yyyy", { locale: id })}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor="period" className="text-xs">PERIOD</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger id="period" className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2024">2024</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="category" className="text-xs">CATEGORY</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger id="category" className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="health">Health & Beauty</SelectItem>
                          <SelectItem value="food">Food</SelectItem>
                          <SelectItem value="dining">Dining</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="branch" className="text-xs">BRANCH</Label>
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger id="branch" className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="surabaya">Surabaya</SelectItem>
                          <SelectItem value="malang">Malang</SelectItem>
                          <SelectItem value="jember">Jember</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="merchant" className="text-xs">MERCHANT</Label>
                      <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                        <SelectTrigger id="merchant" className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="prodia">Prodia</SelectItem>
                          <SelectItem value="nakamura">Nakamura</SelectItem>
                          <SelectItem value="beautiff">Beautiff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button size="sm" className="h-8">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update
                  </Button>
                </div>
              </div>

              {/* Top Metrics */}
              <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6">
                <Card className="bg-white shadow-md">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">Burning Poin</div>
                    <div className="text-3xl font-bold text-red-600">
                      {mockData.burningPoin.toLocaleString('id-ID')}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white shadow-md">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">Total Merchant</div>
                    <div className="text-3xl font-bold text-red-600">
                      {mockData.totalMerchant}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 gap-6 px-4 lg:grid-cols-5 lg:px-6">
                {/* Left Column (40%) */}
                <div className="lg:col-span-2">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Merchant per Month Chart */}
                    <Card className="bg-white shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Merchant per Month</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockData.merchantPerMonth}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="redeem" name="REDEEM" fill="#FF0000" />
                              <Bar dataKey="uniqueRedeem" name="UNIQUE REDEEM" fill="#FF6B00" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Merchant Categories Pie Chart */}
                    <Card className="bg-white shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Merchant Categories</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={mockData.merchantCategories}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {mockData.merchantCategories.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Right Column (60%) */}
                <div className="lg:col-span-3">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Top Merchant Redeem Table */}
                    <Card className="bg-white shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Top Merchant Redeem</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="pb-2 text-left text-sm font-medium">Merchant Name</th>
                                <th className="pb-2 text-right text-sm font-medium">Redeem</th>
                                <th className="pb-2 text-right text-sm font-medium">Unique Redeem</th>
                                <th className="pb-2 text-right text-sm font-medium">% Share</th>
                                <th className="pb-2 text-right text-sm font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mockData.topMerchants.map((merchant, index) => (
                                <tr key={index} className="border-b">
                                  <td className="py-2 text-sm">{merchant.name}</td>
                                  <td className="py-2 text-right text-sm">{merchant.redeem.toLocaleString('id-ID')}</td>
                                  <td className="py-2 text-right text-sm">{merchant.uniqueRedeem.toLocaleString('id-ID')}</td>
                                  <td className="py-2 text-right text-sm">{((merchant.redeem / mockData.burningPoin) * 100).toFixed(2)}%</td>
                                  <td className="py-2 text-right text-sm">
                                    <Button variant="ghost" size="sm">View</Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* POIN Redeem Region Jatim Table */}
                    <Card className="bg-white shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">POIN Redeem Region Jatim</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="pb-2 text-left text-sm font-medium">Region</th>
                                <th className="pb-2 text-right text-sm font-medium">Redeem</th>
                                <th className="pb-2 text-right text-sm font-medium">Share</th>
                                <th className="pb-2 text-right text-sm font-medium">Indicator</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mockData.regionRedeem.map((region, index) => (
                                <tr key={index} className="border-b">
                                  <td className="py-2 text-sm">{region.region}</td>
                                  <td className="py-2 text-right text-sm">{region.redeem.toLocaleString('id-ID')}</td>
                                  <td className="py-2 text-right text-sm">{region.percentage}%</td>
                                  <td className="py-2 text-right text-sm">
                                    <div className="flex items-center justify-end">
                                      <div className="ml-2 h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                                        <div 
                                          className="h-full bg-red-500" 
                                          style={{ width: `${region.percentage}%` }}
                                        ></div>
                                      </div>
                                      <span className="ml-2 text-xs">{region.percentage}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Merchant Expired Table */}
                    <Card className="bg-white shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Merchant Expired</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="pb-2 text-left text-sm font-medium">Merchant Name</th>
                                <th className="pb-2 text-right text-sm font-medium">Expiry Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mockData.expiredMerchants.map((merchant, index) => (
                                <tr key={index} className="border-b">
                                  <td className="py-2 text-sm">{merchant.name}</td>
                                  <td className="py-2 text-right text-sm">{merchant.expiry}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Bottom Section - 3x3 Grid with 6 Cards */}
              <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3 lg:px-6">
                <Card className="bg-white shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Merchant Active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">156</div>
                    <div className="text-sm text-muted-foreground">82.1% of total</div>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Merchant Productive</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">112</div>
                    <div className="text-sm text-muted-foreground">58.9% of total</div>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Merchant Not Active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">34</div>
                    <div className="text-sm text-muted-foreground">17.9% of total</div>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md md:col-span-2 lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Active Merchants Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 overflow-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-2 text-left text-sm font-medium">Merchant</th>
                            <th className="pb-2 text-right text-sm font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b"><td className="py-1 text-sm">Prodia Sidoarjo</td><td className="py-1 text-right text-sm"><Badge variant="default">Active</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Nakamura Jember</td><td className="py-1 text-right text-sm"><Badge variant="default">Active</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Beautiff Clinic</td><td className="py-1 text-right text-sm"><Badge variant="default">Active</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Laboratorium Klinik</td><td className="py-1 text-right text-sm"><Badge variant="default">Active</Badge></td></tr>
                          <tr><td className="py-1 text-sm">Aromatherapy Family</td><td className="py-1 text-right text-sm"><Badge variant="default">Active</Badge></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md md:col-span-2 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Productive Merchants Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 overflow-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-2 text-left text-sm font-medium">Merchant</th>
                            <th className="pb-2 text-right text-sm font-medium">Transactions</th>
                            <th className="pb-2 text-right text-sm font-medium">Redeem Value</th>
                            <th className="pb-2 text-right text-sm font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b"><td className="py-1 text-sm">Prodia Sidoarjo</td><td className="py-1 text-right text-sm">1,250</td><td className="py-1 text-right text-sm">12.5M</td><td className="py-1 text-right text-sm"><Badge variant="default">Productive</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Nakamura Jember</td><td className="py-1 text-right text-sm">1,180</td><td className="py-1 text-right text-sm">11.8M</td><td className="py-1 text-right text-sm"><Badge variant="default">Productive</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Beautiff Clinic</td><td className="py-1 text-right text-sm">1,050</td><td className="py-1 text-right text-sm">10.5M</td><td className="py-1 text-right text-sm"><Badge variant="default">Productive</Badge></td></tr>
                          <tr className="border-b"><td className="py-1 text-sm">Laboratorium Klinik</td><td className="py-1 text-right text-sm">980</td><td className="py-1 text-right text-sm">9.8M</td><td className="py-1 text-right text-sm"><Badge variant="default">Productive</Badge></td></tr>
                          <tr><td className="py-1 text-sm">Aromatherapy Family</td><td className="py-1 text-right text-sm">920</td><td className="py-1 text-right text-sm">9.2M</td><td className="py-1 text-right text-sm"><Badge variant="default">Productive</Badge></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}