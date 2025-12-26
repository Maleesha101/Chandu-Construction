import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ExpenseRecord, DashboardStats, BankAccount } from '@/lib/types';
import { expenseApi, bankApi } from '@/lib/apiClient';
import { Wallet, Clock, AlertCircle, TrendingUp, ArrowRight, Plus, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const { userRole, isRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalBankBalance: 0,
    pendingCount: 0,
    wdPendingCount: 0,
    weeklySpend: 0,
    approvedThisWeek: 0,
    rejectedThisWeek: 0,
  });
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch bank accounts
        const banks = await bankApi.getAll();
        if (banks) {
          setBankAccounts(banks);
          const totalBalance = banks.reduce((sum, bank) => sum + Number(bank.balance), 0);
          setStats((prev) => ({ ...prev, totalBankBalance: totalBalance }));
        }

        // Fetch all expenses to calculate stats
        const allExpenses = await expenseApi.getAll();
        
        // Count pending expenses
        const pendingCount = allExpenses.filter((exp: any) => exp.status === 'pending').length;
        const wdPendingCount = allExpenses.filter((exp: any) => exp.status === 'wd_pending').length;

        // Get recent expenses (first 5)
        const recentExpenses = allExpenses.slice(0, 5);
        setRecentExpenses(recentExpenses);

        // Calculate weekly spend
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weeklySpend = allExpenses
          .filter((exp: any) => {
            const expDate = new Date(exp.created_at);
            return (
              (exp.status === 'approved' || exp.status === 'wd_approved') &&
              expDate >= weekStart
            );
          })
          .reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);

        setStats((prev) => ({
          ...prev,
          pendingCount,
          wdPendingCount,
          weeklySpend,
        }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const getRoleDashboardTitle = () => {
    switch (userRole) {
      case 'boss':
        return 'Owner Dashboard';
      case 'admin':
        return 'Office Dashboard';
      case 'qs':
        return 'QS Dashboard';
      case 'md':
        return 'Director Dashboard';
      default:
        return 'Dashboard';
    }
  };

  // Debug: Log user role
  console.log('Current userRole:', userRole);
  console.log('isRole boss/admin check:', isRole(['boss', 'admin']));

  return (
    <DashboardLayout title={getRoleDashboardTitle()} description="Overview of your construction finance operations">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        {isRole(['boss', 'admin']) && (
          <Button asChild className="gap-2">
            <Link to="/expenses/new">
              <Plus className="h-4 w-4" />
              New Expense
            </Link>
          </Button>
        )}
    
        <Button asChild variant="outline" className="gap-2">
          <Link to="/reports">
            <TrendingUp className="h-4 w-4" />
            View Reports
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Bank Balance"
          value={formatCurrency(stats.totalBankBalance)}
          icon={Wallet}
          description={`Across ${bankAccounts.length} accounts`}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingCount}
          icon={Clock}
          description="Awaiting review"
          iconClassName="bg-amber-100"
        />
        <StatCard
          title="WD Pending"
          value={stats.wdPendingCount}
          icon={AlertCircle}
          description="QS review required"
          iconClassName="bg-blue-100"
        />
        <StatCard
          title="Weekly Spend"
          value={formatCurrency(stats.weeklySpend)}
          icon={TrendingUp}
          description="This week approved"
          iconClassName="bg-emerald-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Accounts */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Bank Accounts</h2>
            {isRole('boss') && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/settings/banks">Manage</Link>
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {bankAccounts.length === 0 ? (
              <div className="stat-card text-center py-8">
                <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bank accounts configured</p>
              </div>
            ) : (
              bankAccounts.map((bank) => (
                <div key={bank.id} className="stat-card !py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{bank.name}</p>
                      <p className="text-xs text-muted-foreground">{bank.bank_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(Number(bank.balance))}
                      </p>
                      <p className="text-xs text-muted-foreground">{bank.currency}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Expenses</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/expenses">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="stat-card !p-0 overflow-hidden">
            {recentExpenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No expenses recorded yet</p>
                {isRole(['boss', 'admin']) && (
                  <Button asChild variant="link" className="mt-2">
                    <Link to="/expenses/new">Create your first expense</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground truncate">
                            {expense.to_name}
                          </p>
                          <StatusBadge status={expense.status} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {expense.purpose}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{(expense as any).site_name || 'No site'}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(expense.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-foreground">
                          {formatCurrency(Number(expense.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(expense as any).bank_name || 'Cash'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
