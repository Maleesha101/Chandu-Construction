import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { expenseApi, siteApi } from '@/lib/apiClient';
import { ExpenseRecord, Site } from '@/lib/types';
import { Plus, Search, Filter, Eye, Receipt, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Expenses() {
  const { isRole, userRole } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const sitesData = await siteApi.getAll(true);
        setSites(sitesData);

        const params: any = {};
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
        if (siteFilter !== 'all') {
          params.site_id = siteFilter;
        }

        const expensesData = await expenseApi.getAll(params);
        setExpenses(expensesData);
      } catch (error) {
        console.error('Error fetching expenses:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [statusFilter, siteFilter]);

  const filteredExpenses = expenses.filter((expense) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      expense.to_name.toLowerCase().includes(search) ||
      expense.purpose.toLowerCase().includes(search) ||
      expense.reference?.toLowerCase().includes(search)
    );
  });

  const handleDeleteClick = (expense: ExpenseRecord) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;

    setDeleting(true);
    try {
      await expenseApi.delete(expenseToDelete.id);
      toast.success('Expense record deleted successfully');
      // Refresh the expenses list
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (siteFilter !== 'all') params.site_id = siteFilter;
      const expensesData = await expenseApi.getAll(params);
      setExpenses(expensesData);
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast.error(error.message || 'Failed to delete expense record');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleEditClick = (expenseId: string) => {
    navigate(`/expenses/edit/${expenseId}`);
  };

  return (
    <DashboardLayout title="Expense Records" description="View and manage all expense entries">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient, purpose, or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="wd_pending">WD Pending</SelectItem>
              <SelectItem value="wd_approved">WD Approved</SelectItem>
              <SelectItem value="wd_rejected">WD Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isRole(['boss', 'admin']) && (
            <Button asChild className="gap-2">
              <Link to="/expenses/new">
                <Plus className="h-4 w-4" />
                New Expense
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="stat-card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading expenses...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No expenses found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' || siteFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first expense record'}
            </p>
            {isRole(['boss', 'admin']) && (
              <Button asChild>
                <Link to="/expenses/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Expense
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id} className="data-table-row">
                  <TableCell className="font-medium">
                    {format(new Date(expense.entry_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{expense.to_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {expense.purpose}
                  </TableCell>
                  <TableCell>{(expense as any).sites?.name || '-'}</TableCell>
                  <TableCell>{(expense as any).bank_accounts?.name || 'Cash'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(expense.amount))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={expense.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRole(['boss']) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(expense.id)}
                            title="Edit expense"
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(expense)}
                            title="Delete expense"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary Footer */}
      {filteredExpenses.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>Showing {filteredExpenses.length} expense records</p>
          <p>
            Total:{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(
                filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
              )}
            </span>
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense record:
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Date:</strong> {expenseToDelete && format(new Date(expenseToDelete.entry_date), 'MMM d, yyyy')}</p>
                <p><strong>Recipient:</strong> {expenseToDelete?.to_name}</p>
                <p><strong>Amount:</strong> {expenseToDelete && formatCurrency(Number(expenseToDelete.amount))}</p>
                <p><strong>Purpose:</strong> {expenseToDelete?.purpose}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
