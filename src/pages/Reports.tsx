import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart3, 
  Download, 
  FileText, 
  TrendingUp, 
  Wallet, 
  PieChart, 
  Calendar,
  Loader2,
  DollarSign,
  Receipt,
  TrendingDown,
  Activity
} from 'lucide-react';
import { reportApi } from '@/lib/apiClient';
import { 
  ReportSummary, 
  SiteReport, 
  MDReport, 
  BankReport, 
  WeeklyComparison 
} from '@/lib/types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

const reportTypes = [
  {
    id: 'summary',
    name: 'Expense Summary',
    description: 'Comprehensive overview with charts and statistics',
    icon: BarChart3,
  },
  {
    id: 'weekly-comparison',
    name: 'Weekly Trend',
    description: 'Compare expenses over last 8 weeks',
    icon: TrendingUp,
  },
  {
    id: 'site-expenses',
    name: 'Site Expenses',
    description: 'Expense breakdown by construction site',
    icon: PieChart,
  },
  {
    id: 'md-expenses',
    name: 'Supervisor Expenses',
    description: 'Spending analysis per supervisor (MD)',
    icon: TrendingUp,
  },
  {
    id: 'bank-ledger',
    name: 'Bank Account Ledger',
    description: 'Transaction summary per bank account',
    icon: Wallet,
  },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [period, setPeriod] = useState('this-week');
  const [loading, setLoading] = useState(false);
  
  // Report data states
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [siteReport, setSiteReport] = useState<SiteReport | null>(null);
  const [mdReport, setMDReport] = useState<MDReport | null>(null);
  const [bankReport, setBankReport] = useState<BankReport | null>(null);
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null);

  // Fetch data when report or period changes
  useEffect(() => {
    if (selectedReport) {
      fetchReportData();
    }
  }, [selectedReport, period]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      switch (selectedReport) {
        case 'summary':
          const summaryData = await reportApi.getSummary(period);
          setSummary(summaryData);
          break;
        case 'site-expenses':
          const siteData = await reportApi.getBySite(period);
          setSiteReport(siteData);
          break;
        case 'md-expenses':
          const mdData = await reportApi.getByMD(period);
          setMDReport(mdData);
          break;
        case 'bank-ledger':
          const bankData = await reportApi.getByBank(period);
          setBankReport(bankData);
          break;
        case 'weekly-comparison':
          const weeklyData = await reportApi.getWeeklyComparison();
          setWeeklyComparison(weeklyData);
          break;
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const renderSummaryReport = () => {
    if (!summary) return null;

    const { overall, byStatus, byPaymentMethod, dailyTrend, topCategories } = summary;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Expenses"
            value={formatCurrency(Number(overall.total_amount))}
            icon={DollarSign}
            description={`${overall.total_count} transactions`}
          />
          <StatCard
            title="Average Amount"
            value={formatCurrency(Number(overall.avg_amount))}
            icon={Activity}
            description="Per transaction"
          />
          <StatCard
            title="Highest Expense"
            value={formatCurrency(Number(overall.max_amount))}
            icon={TrendingUp}
          />
          <StatCard
            title="Lowest Expense"
            value={formatCurrency(Number(overall.min_amount))}
            icon={TrendingDown}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expenses by Status */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Expenses by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={byStatus}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.status}: ${formatCurrency(entry.total)}`}
                >
                  {byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          {/* Expenses by Payment Method */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byPaymentMethod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="payment_method" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="total" fill="#3b82f6" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Trend */}
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Daily Expense Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: any) => formatCurrency(Number(value))}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Amount" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Categories */}
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Top 5 Categories by Spending</h3>
          <div className="space-y-4">
            {topCategories.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{category.category}</span>
                    <span className="text-sm text-muted-foreground">{category.count} transactions</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary rounded-full h-2" 
                      style={{ 
                        width: `${(Number(category.total) / Number(topCategories[0].total)) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                <span className="ml-4 font-semibold">{formatCurrency(Number(category.total))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderWeeklyComparison = () => {
    if (!weeklyComparison) return null;

    return (
      <div className="space-y-6">
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">8-Week Expense Trend</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={weeklyComparison.weeks}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Weekly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Week</th>
                  <th className="text-right p-3">Transactions</th>
                  <th className="text-right p-3">Total Amount</th>
                  <th className="text-right p-3">Average</th>
                </tr>
              </thead>
              <tbody>
                {weeklyComparison.weeks.map((week, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3">{week.week}</td>
                    <td className="text-right p-3">{week.count}</td>
                    <td className="text-right p-3 font-semibold">{formatCurrency(Number(week.total))}</td>
                    <td className="text-right p-3">{formatCurrency(Number(week.total) / Number(week.count || 1))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSiteReport = () => {
    if (!siteReport) return null;

    const chartData = siteReport.sites.map(site => ({
      name: site.name,
      total: Number(site.total_spent),
    }));

    return (
      <div className="space-y-6">
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Total Expenses by Site</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Bar dataKey="total" fill="#3b82f6" name="Total Spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Site Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Site</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-right p-3">Expenses</th>
                  <th className="text-right p-3">Cash</th>
                  <th className="text-right p-3">Bank</th>
                  <th className="text-right p-3">Cheque</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {siteReport.sites.map((site) => (
                  <tr key={site.id} className="border-b">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{site.name}</div>
                        {site.location && <div className="text-sm text-muted-foreground">{site.location}</div>}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{site.code || '-'}</td>
                    <td className="text-right p-3">{site.expense_count}</td>
                    <td className="text-right p-3">{formatCurrency(Number(site.cash_spent))}</td>
                    <td className="text-right p-3">{formatCurrency(Number(site.bank_spent))}</td>
                    <td className="text-right p-3">{formatCurrency(Number(site.cheque_spent))}</td>
                    <td className="text-right p-3 font-semibold">{formatCurrency(Number(site.total_spent))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMDReport = () => {
    if (!mdReport) return null;

    const chartData = mdReport.supervisors.map(supervisor => ({
      name: supervisor.name,
      total: Number(supervisor.total_spent),
    }));

    return (
      <div className="space-y-6">
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Expenses by Supervisor</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Bar dataKey="total" fill="#10b981" name="Total Spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Supervisor Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Transactions</th>
                  <th className="text-right p-3">Total Spent</th>
                  <th className="text-right p-3">Average</th>
                </tr>
              </thead>
              <tbody>
                {mdReport.supervisors.map((supervisor) => (
                  <tr key={supervisor.id} className="border-b">
                    <td className="p-3 font-medium">{supervisor.name}</td>
                    <td className="p-3 text-muted-foreground">{supervisor.phone || '-'}</td>
                    <td className="text-right p-3">{supervisor.expense_count}</td>
                    <td className="text-right p-3 font-semibold">{formatCurrency(Number(supervisor.total_spent))}</td>
                    <td className="text-right p-3">{formatCurrency(Number(supervisor.avg_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderBankReport = () => {
    if (!bankReport) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankReport.banks.map((bank) => (
            <div key={bank.id} className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{bank.name}</h3>
                  <p className="text-sm text-muted-foreground">{bank.account_number}</p>
                </div>
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="font-semibold">{formatCurrency(Number(bank.current_balance))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-medium">{bank.transaction_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Spent</span>
                  <span className="font-semibold text-red-600">{formatCurrency(Number(bank.total_spent))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Bank Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bankReport.banks}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="total_spent" fill="#ef4444" name="Total Spent" />
              <Bar dataKey="current_balance" fill="#10b981" name="Current Balance" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="stat-card flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!selectedReport) {
      return (
        <div className="stat-card text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Select a Report Type
          </h3>
          <p className="text-muted-foreground">
            Choose from the report options above to generate financial insights.
          </p>
        </div>
      );
    }

    switch (selectedReport) {
      case 'summary':
        return renderSummaryReport();
      case 'weekly-comparison':
        return renderWeeklyComparison();
      case 'site-expenses':
        return renderSiteReport();
      case 'md-expenses':
        return renderMDReport();
      case 'bank-ledger':
        return renderBankReport();
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Reports" description="Generate and export financial reports">
      {/* Period Selector */}
      {selectedReport && selectedReport !== 'weekly-comparison' && (
        <div className="flex items-center gap-4 mb-8">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`stat-card text-left transition-all hover:shadow-lg ${
              selectedReport === report.id ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <report.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{report.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {report.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Report Content */}
      {renderReportContent()}
    </DashboardLayout>
  );
}
