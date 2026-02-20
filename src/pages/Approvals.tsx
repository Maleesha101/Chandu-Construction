import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { ExpenseRecord } from '@/lib/types';
import { expenseApi } from '@/lib/apiClient';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  FileText,
  Loader2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Approvals() {
  const { user, isRole } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Dialog state
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [dialogAction, setDialogAction] = useState<'reject' | 'wd' | null>(null);
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    fetchPendingExpenses();
  }, []);

  const fetchPendingExpenses = async () => {
    try {
      const data = await expenseApi.getAll({ status: 'pending' });
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expense: ExpenseRecord) => {
    if (!user) return;
    setActionLoading(expense.id);

    try {
      // Update expense status via API
      await expenseApi.updateStatus(expense.id, 'approved');

      toast.success('Expense approved successfully');
      setExpenses(expenses.filter((e) => e.id !== expense.id));
    } catch (error) {
      console.error('Error approving expense:', error);
      toast.error('Failed to approve expense');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!user || !selectedExpense) return;
    setActionLoading(selectedExpense.id);

    try {
      // Update expense status via API
      await expenseApi.updateStatus(selectedExpense.id, 'rejected', actionNote);

      toast.success('Expense rejected');
      setExpenses(expenses.filter((e) => e.id !== selectedExpense.id));
      setSelectedExpense(null);
      setDialogAction(null);
      setActionNote('');
    } catch (error) {
      console.error('Error rejecting expense:', error);
      toast.error('Failed to reject expense');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWD = async () => {
    if (!user || !selectedExpense) return;
    setActionLoading(selectedExpense.id);

    try {
      // Update expense status to wd_pending via API
      await expenseApi.updateStatus(selectedExpense.id, 'wd_pending', actionNote);

      toast.success('Expense sent to QS for review');
      setExpenses(expenses.filter((e) => e.id !== selectedExpense.id));
      closeDialog();
    } catch (error) {
      console.error('Error sending to WD:', error);
      toast.error('Failed to send to QS');
    } finally {
      setActionLoading(null);
    }
  };

  const openDialog = (expense: ExpenseRecord, action: 'reject' | 'wd') => {
    setSelectedExpense(expense);
    setDialogAction(action);
    setActionNote('');
  };

  const closeDialog = () => {
    setSelectedExpense(null);
    setDialogAction(null);
    setActionNote('');
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      expense.to_name.toLowerCase().includes(search) ||
      expense.purpose.toLowerCase().includes(search)
    );
  });

  if (!isRole('boss')) {
    return (
      <DashboardLayout title="Approvals">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pending Approvals" description="Review and approve expense records">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pending expenses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="stat-card text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No pending approvals</h3>
          <p className="text-muted-foreground">All caught up! Check back later for new requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="stat-card !p-0 overflow-hidden animate-fade-in"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{expense.to_name}</h3>
                        <p className="text-sm text-muted-foreground">{expense.purpose}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <span>Site: {(expense as any).site_name || '-'}</span>
                      <span>MD: {(expense as any).md_name || '-'}</span>
                      <span>Bank: {(expense as any).bank_name || 'Cash'}</span>
                      <span>Date: {format(new Date(expense.entry_date), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">
                        {formatCurrency(Number(expense.amount))}
                      </p>
                      <StatusBadge status={expense.status} />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(expense)}
                        disabled={actionLoading === expense.id}
                      >
                        {actionLoading === expense.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
                        onClick={() => openDialog(expense, 'wd')}
                        disabled={actionLoading === expense.id}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        WD
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => openDialog(expense, 'reject')}
                        disabled={actionLoading === expense.id}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!dialogAction} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'reject' ? 'Reject Expense' : 'Send to QS (WD)'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'reject'
                ? 'Please provide a reason for rejecting this expense.'
                : 'This will send the expense to the QS department for review. Please provide a reason.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="py-4 border-y border-border">
              <p className="font-medium">{selectedExpense.to_name}</p>
              <p className="text-sm text-muted-foreground">{selectedExpense.purpose}</p>
              <p className="text-lg font-semibold mt-2">
                {formatCurrency(Number(selectedExpense.amount))}
              </p>
            </div>
          )}

          <Textarea
            placeholder={
              dialogAction === 'reject'
                ? 'Reason for rejection...'
                : 'Reason for WD request...'
            }
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            rows={3}
          />

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'reject' ? 'destructive' : 'default'}
              onClick={dialogAction === 'reject' ? handleReject : handleWD}
              disabled={!actionNote.trim() || actionLoading === selectedExpense?.id}
            >
              {actionLoading === selectedExpense?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {dialogAction === 'reject' ? 'Reject' : 'Send to QS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
