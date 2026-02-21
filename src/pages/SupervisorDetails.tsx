import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { expenseApi, userApi, ledgerApi } from '@/lib/apiClient';
import { ExpenseRecord } from '@/lib/types';
import { ArrowLeft, Loader2, Receipt, Banknote, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface UserDetails {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

export default function SupervisorDetails() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerBalance, setLedgerBalance] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      if (!userId) {
        navigate('/users');
        return;
      }

      try {
        const [allUsers, allExpenses, cashBalance] = await Promise.all([
          userApi.getAll(),
          expenseApi.getAll(),
          ledgerApi.getUserCashBalance(userId),
        ]);

        const foundUser = allUsers.find((u: UserDetails) => u.id === userId);
        if (!foundUser) {
          toast.error('User not found');
          navigate('/users');
          return;
        }

        setUser(foundUser);
        
        // Set ledger balance (actual cash account balance)
        setLedgerBalance(cashBalance.balance || 0);

        console.log('All expenses:', allExpenses.length);
        console.log('Looking for expenses where from_person_name ===', foundUser.full_name);
        console.log('Sample expense:', allExpenses[0]);
        console.log('Ledger cash balance:', cashBalance);

        // Filter expenses where this user is the "from_person" (transaction made by)
        const userExpenses = allExpenses.filter(
          (expense: ExpenseRecord) => {
            const fromPersonName = expense.from_person_name;
            console.log('Expense from_person_name:', fromPersonName, 'matches:', fromPersonName === foundUser.full_name);
            return fromPersonName === foundUser.full_name;
          }
        );
        
        console.log('Filtered expenses:', userExpenses.length);
        // Only show cash expenses, exclude bank transfers
        setExpenses(userExpenses.filter((e: ExpenseRecord) => e.payment_method === 'cash'));
      } catch (error) {
        console.error('Error fetching supervisor details:', error);
        toast.error('Failed to load supervisor details');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const approvedExpenses = expenses.filter((e) =>
    e.payment_method === 'cash' && ['approved', 'wd_approved'].includes(e.status)
  );
  
  const totalSpent = approvedExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const pendingAmount = expenses
    .filter((e) => e.payment_method === 'cash' && ['pending', 'wd_pending'].includes(e.status))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <DashboardLayout
      title={user.full_name}
      description="View supervisor's transaction history and spending"
    >
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/users')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
      </div>

      {/* User Info Card */}
      <div className="stat-card mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {user.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{user.full_name}</h2>
            <p className="text-muted-foreground">{user.email}</p>
            {user.phone && (
              <p className="text-sm text-muted-foreground">📞 {user.phone}</p>
            )}
          </div>
          <div className="ml-auto">
            <Badge className="bg-emerald-100 text-emerald-800">
              Supervisor
            </Badge>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card !bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <Receipt className="h-4 w-4" />
              <span className="text-sm font-medium">Total Spent</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(totalSpent)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {approvedExpenses.length} approved transaction{approvedExpenses.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="stat-card !bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Banknote className="h-4 w-4" />
              <span className="text-sm font-medium">Petty Cash Balance</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">
              {formatCurrency(ledgerBalance)}
            </div>
            <div className="text-xs text-amber-600 mt-1">
              Current ledger balance
            </div>
          </div>

          <div className="stat-card !bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 text-orange-700 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="text-xs text-orange-600 mt-1">
              {expenses.filter((e) => e.payment_method === 'cash' && ['pending', 'wd_pending'].includes(e.status)).length} pending
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="stat-card !p-0 overflow-hidden">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold">Transaction History</h3>
          <p className="text-sm text-muted-foreground">
            All expenses made by {user.full_name}
          </p>
        </div>
        
        {expenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No petty cash transactions yet
            </h3>
            <p className="text-muted-foreground">
              There are no petty cash expense records for this supervisor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="data-table-row">
                    <TableCell className="font-medium">
                      {format(new Date(expense.entry_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {expense.site_name || '-'}
                    </TableCell>
                    <TableCell>{expense.to_name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expense.purpose}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={expense.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
