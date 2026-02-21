import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, Download, FileText, TrendingUp, Wallet, PieChart, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const reportTypes = [
  {
    id: 'ledger',
    name: 'Ledger Accounts',
    description: 'Double-entry bookkeeping and account balances',
    icon: BookOpen,
    link: '/ledger',
  },
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
  const navigate = useNavigate();

  const handleReportClick = (report: typeof reportTypes[0]) => {
    if (report.link) {
      navigate(report.link);
    } else {
      setSelectedReport(report.id);
    }
  };

  return (
    <DashboardLayout title="Reports" description="Generate and export financial reports">
      {/* Period Selector */}
      <div className="flex items-center gap-4 mb-8">
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
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => handleReportClick(report)}
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {reportTypes.find((r) => r.id === selectedReport)?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Period: {period.replace('-', ' ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-12 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Report Preview
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Report generation coming soon. Select a report type and period to generate
              detailed financial analytics.
            </p>
          </div>
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
