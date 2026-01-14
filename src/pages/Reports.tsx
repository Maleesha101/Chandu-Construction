import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, Download, FileText, TrendingUp, Wallet, PieChart, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ReportTable,
  SummaryCard,
  StatusBadge,
  SimpleBarChart,
  LoadingSkeleton,
} from '@/components/ui/report-components';

const reportTypes = [
  {
    id: 'weekly-summary',
    name: 'Weekly Summary',
    description: 'Overview of weekly expenses by site and MD',
    icon: BarChart3,
  },
  {
    id: 'bank-ledger',
    name: 'Bank Account Ledger',
    description: 'Detailed transaction history per bank account',
    icon: Wallet,
  },
  {
    id: 'site-expenses',
    name: 'Site Expenses',
    description: 'Expense breakdown by construction site',
    icon: PieChart,
  },
  {
    id: 'md-expenses',
    name: 'MD Expenses',
    description: 'Spending analysis per managing director',
    icon: TrendingUp,
  },
  {
    id: 'wd-report',
    name: 'WD Status Report',
    description: 'All WD pending, approved, and rejected items',
    icon: FileText,
  },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [period, setPeriod] = useState('this-week');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { toast } = useToast();

  // Calculate date range based on period
  useEffect(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (period) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date();
        break;
      case 'this-week':
        const firstDay = now.getDate() - now.getDay();
        start = new Date(now.setDate(firstDay));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'last-week':
        const lastWeekEnd = new Date(now.setDate(now.getDate() - now.getDay() - 1));
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        start = lastWeekStart;
        end = lastWeekEnd;
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    }

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  }, [period]);

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || !selectedReport) return;

    const interval = setInterval(() => {
      fetchReportData(selectedReport);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedReport, dateRange]);

  // Fetch report when selection or date changes
  useEffect(() => {
    if (selectedReport && dateRange.start && dateRange.end) {
      fetchReportData(selectedReport);
    }
  }, [selectedReport, dateRange]);

  const fetchReportData = async (reportType: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/${reportType}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }
      
      const data = await response.json();
      setReportData(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csvContent = '';
    const reportName = reportTypes.find((r) => r.id === selectedReport)?.name || 'Report';

    // Add header
    csvContent += `${reportName}\n`;
    csvContent += `Period: ${dateRange.start} to ${dateRange.end}\n\n`;

    // Convert data to CSV based on report type
    if (selectedReport === 'weekly-summary' && reportData.data) {
      csvContent += 'Site Name,Site Code,MD Name,Total Transactions,Cash Expenses,Bank Expenses,Total Amount,Pending,Approved,Rejected\n';
      reportData.data.forEach((row: any) => {
        csvContent += `${row.site_name || ''},${row.site_code || ''},${row.md_name || ''},${row.total_transactions},${row.cash_expenses},${row.bank_expenses},${row.total_amount},${row.pending_count},${row.approved_count},${row.rejected_count}\n`;
      });
    } else if (selectedReport === 'bank-ledger' && reportData.transactions) {
      csvContent += 'Date,WD Number,Item Name,Amount,Status,Site,MD,Bank,Entered By\n';
      reportData.transactions.forEach((row: any) => {
        csvContent += `${row.entry_date},${row.wd_number || ''},${row.item_name},${row.amount},${row.status},${row.site_name || ''},${row.md_name || ''},${row.bank_name || ''},${row.entered_by}\n`;
      });
    } else if (selectedReport === 'site-expenses' && reportData.sites) {
      csvContent += 'Site Name,Site Code,Location,Total Transactions,Cash Expenses,Bank Expenses,Total Expenses,Pending Items,Approved Items\n';
      reportData.sites.forEach((row: any) => {
        csvContent += `${row.site_name},${row.site_code || ''},${row.location || ''},${row.total_transactions},${row.cash_expenses},${row.bank_expenses},${row.total_expenses},${row.pending_items},${row.approved_items}\n`;
      });
    } else if (selectedReport === 'md-expenses' && reportData.managing_directors) {
      csvContent += 'MD Name,Email,Phone,Total Transactions,Cash Expenses,Bank Expenses,Total Expenses,Pending Items,Approved Items\n';
      reportData.managing_directors.forEach((row: any) => {
        csvContent += `${row.md_name},${row.md_email || ''},${row.md_phone || ''},${row.total_transactions},${row.cash_expenses},${row.bank_expenses},${row.total_expenses},${row.pending_items},${row.approved_items}\n`;
      });
    } else if (selectedReport === 'wd-report' && reportData.records) {
      csvContent += 'WD Number,Date,Item Name,Amount,Payment Method,Status,Site,MD,Bank,Entered By\n';
      reportData.records.forEach((row: any) => {
        csvContent += `${row.wd_number || ''},${row.entry_date},${row.item_name},${row.amount},${row.payment_method},${row.status},${row.site_name || ''},${row.md_name || ''},${row.bank_name || ''},${row.entered_by}\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportName.replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderReportContent = () => {
    if (loading) return <LoadingSkeleton />;
    if (!reportData) return null;

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
      }).format(value);

    switch (selectedReport) {
      case 'weekly-summary':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Transactions"
                value={reportData.totals?.total_transactions || 0}
                icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              />
              <SummaryCard
                title="Cash Expenses"
                value={formatCurrency(reportData.totals?.cash_expenses || 0)}
                icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
              />
              <SummaryCard
                title="Bank Expenses"
                value={formatCurrency(reportData.totals?.bank_expenses || 0)}
                icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
              />
              <SummaryCard
                title="Total Amount"
                value={formatCurrency(reportData.totals?.total_amount || 0)}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
            <ReportTable
              columns={[
                { key: 'site_name', label: 'Site Name' },
                { key: 'site_code', label: 'Site Code' },
                { key: 'md_name', label: 'MD Name' },
                { key: 'total_transactions', label: 'Transactions', align: 'right' },
                { key: 'cash_expenses', label: 'Cash', align: 'right' },
                { key: 'bank_expenses', label: 'Bank', align: 'right' },
                { key: 'total_amount', label: 'Total', align: 'right' },
              ]}
              data={reportData.data || []}
              totals={reportData.totals}
            />
          </div>
        );

      case 'bank-ledger':
        return (
          <div className="space-y-6">
            {reportData.bank_summary && reportData.bank_summary.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reportData.bank_summary.map((bank: any) => (
                  <SummaryCard
                    key={bank.id}
                    title={bank.name}
                    value={formatCurrency(bank.current_balance || 0)}
                    subtitle={`${bank.transaction_count || 0} transactions • ${formatCurrency(bank.total_debits || 0)} debits`}
                    icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                  />
                ))}
              </div>
            )}
            <ReportTable
              columns={[
                { key: 'entry_date', label: 'Date' },
                { key: 'wd_number', label: 'WD #' },
                { key: 'item_name', label: 'Item' },
                { key: 'amount', label: 'Amount', align: 'right' },
                {
                  key: 'status',
                  label: 'Status',
                  format: (status) => <StatusBadge status={status} />,
                },
                { key: 'site_name', label: 'Site' },
                { key: 'bank_name', label: 'Bank' },
              ]}
              data={reportData.transactions || []}
            />
          </div>
        );

      case 'site-expenses':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="stat-card">
                <h3 className="text-lg font-semibold mb-4">Top Sites by Expense</h3>
                <SimpleBarChart
                  data={(reportData.sites || [])
                    .slice(0, 10)
                    .map((site: any) => ({
                      label: site.site_name,
                      value: parseFloat(site.total_expenses || 0),
                      color: '#3b82f6',
                    }))}
                />
              </div>
              <div className="stat-card">
                <h3 className="text-lg font-semibold mb-4">Site Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <SummaryCard
                    title="Total Sites"
                    value={reportData.sites?.length || 0}
                  />
                  <SummaryCard
                    title="Total Expenses"
                    value={formatCurrency(
                      reportData.sites?.reduce(
                        (sum: number, s: any) => sum + parseFloat(s.total_expenses || 0),
                        0
                      ) || 0
                    )}
                  />
                </div>
              </div>
            </div>
            <ReportTable
              columns={[
                { key: 'site_name', label: 'Site Name' },
                { key: 'site_code', label: 'Code' },
                { key: 'location', label: 'Location' },
                { key: 'total_transactions', label: 'Transactions', align: 'right' },
                { key: 'cash_expenses', label: 'Cash', align: 'right' },
                { key: 'bank_expenses', label: 'Bank', align: 'right' },
                { key: 'total_expenses', label: 'Total', align: 'right' },
              ]}
              data={reportData.sites || []}
            />
          </div>
        );

      case 'md-expenses':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="stat-card">
                <h3 className="text-lg font-semibold mb-4">MD Expense Distribution</h3>
                <SimpleBarChart
                  data={(reportData.managing_directors || []).map((md: any) => ({
                    label: md.md_name,
                    value: parseFloat(md.total_expenses || 0),
                    color: '#8b5cf6',
                  }))}
                />
              </div>
              <div className="stat-card">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <SummaryCard
                    title="Total MDs"
                    value={reportData.managing_directors?.length || 0}
                  />
                  <SummaryCard
                    title="Total Expenses"
                    value={formatCurrency(
                      reportData.managing_directors?.reduce(
                        (sum: number, md: any) => sum + parseFloat(md.total_expenses || 0),
                        0
                      ) || 0
                    )}
                  />
                </div>
              </div>
            </div>
            <ReportTable
              columns={[
                { key: 'md_name', label: 'MD Name' },
                { key: 'md_email', label: 'Email' },
                { key: 'total_transactions', label: 'Transactions', align: 'right' },
                { key: 'cash_expenses', label: 'Cash', align: 'right' },
                { key: 'bank_expenses', label: 'Bank', align: 'right' },
                { key: 'total_expenses', label: 'Total', align: 'right' },
              ]}
              data={reportData.managing_directors || []}
            />
          </div>
        );

      case 'wd-report':
        return (
          <div className="space-y-6">
            {reportData.summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {reportData.summary.map((item: any) => (
                  <SummaryCard
                    key={item.status}
                    title={item.status.toUpperCase()}
                    value={item.count}
                    subtitle={formatCurrency(item.total_amount || 0)}
                  />
                ))}
              </div>
            )}
            <ReportTable
              columns={[
                { key: 'wd_number', label: 'WD #' },
                { key: 'entry_date', label: 'Date' },
                { key: 'item_name', label: 'Item' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'payment_method', label: 'Method' },
                {
                  key: 'status',
                  label: 'Status',
                  format: (status) => <StatusBadge status={status} />,
                },
                { key: 'site_name', label: 'Site' },
                { key: 'md_name', label: 'MD' },
              ]}
              data={reportData.records || []}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Reports" description="Generate and export financial reports">
      {/* Period Selector */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
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
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {selectedReport && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchReportData(selectedReport)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>
        )}
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`stat-card text-left transition-all ${
              selectedReport === report.id
                ? 'ring-2 ring-primary border-primary'
                : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
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

      {/* Report Preview Area */}
      {selectedReport ? (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {reportTypes.find((r) => r.id === selectedReport)?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Period: {dateRange.start} to {dateRange.end}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportToCSV}
                disabled={!reportData || loading}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {renderReportContent()}
        </div>
      ) : (
        <div className="stat-card text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Select a Report Type
          </h3>
          <p className="text-muted-foreground">
            Choose from the report options above to generate financial insights.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
