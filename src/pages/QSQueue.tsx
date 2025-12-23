import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
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
    FileText,
    Loader2,
    AlertCircle,
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

export default function QSQueue() {
  const { user, isRole } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);
  const [qsNotes, setQsNotes] = useState('');

  useEffect(() => {
    fetchWDPendingExpenses();
  }, []);

  const fetchWDPendingExpenses = async () => {
    try {
      const data = await expenseApi.getAll({ status: 'wd_pending' });
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching WD expenses:', error);
      toast.error('Failed to load QS queue');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!user || !selectedExpense || !dialogAction) return;
    setActionLoading(selectedExpense.id);

    try {
      const newStatus = dialogAction === 'approve' ? 'wd_approved' : 'wd_rejected';

      // Update expense status via API
      await expenseApi.updateStatus(selectedExpense.id, newStatus, qsNotes);

      toast.success(
        dialogAction === 'approve'
          ? 'WD request approved'
          : 'WD request rejected'
      );
      setExpenses(expenses.filter((e) => e.id !== selectedExpense.id));
      closeDialog();
    } catch (error) {
      console.error('Error processing WD:', error);
      toast.error('Failed to process request');
    } finally {
      setActionLoading(null);
    }
  };

  const openDialog = (expense: ExpenseRecord, action: 'approve' | 'reject') => {
    setSelectedExpense(expense);
    setDialogAction(action);
    setQsNotes('');
  };

  const closeDialog = () => {
    setSelectedExpense(null);
    setDialogAction(null);
    setQsNotes('');
  };

  if (!isRole(['qs', 'boss'])) {
    return (
      <DashboardLayout title="QS Queue">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="QS Review Queue" description="Review WD-marked expense requests">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No WD requests</h3>
          <p className="text-muted-foreground">No items currently require QS review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="stat-card !p-0 overflow-hidden animate-fade-in border-l-4 border-l-blue-500"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{expense.to_name}</h3>
                        <p className="text-sm text-muted-foreground">{expense.purpose}</p>
                      </div>
                    </div>

                    {expense.wd_reason && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">WD Reason:</p>
                        <p className="text-sm text-blue-700">{expense.wd_reason}</p>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <span>Site: {(expense as any).site_name || '-'}</span>
                      <span>MD: {(expense as any).md_name || '-'}</span>
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
                        onClick={() => openDialog(expense, 'approve')}
                        disabled={actionLoading === expense.id}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
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

      {/* QS Action Dialog */}
      <Dialog open={!!dialogAction} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? 'Approve WD Request' : 'Reject WD Request'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve'
                ? 'Add any notes for this approval.'
                : 'Please provide a reason for rejecting this WD request.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="py-4 border-y border-border">
              <p className="font-medium">{selectedExpense.to_name}</p>
              <p className="text-sm text-muted-foreground">{selectedExpense.purpose}</p>
              <p className="text-lg font-semibold mt-2">
                {formatCurrency(Number(selectedExpense.amount))}
              </p>
              {selectedExpense.wd_reason && (
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-medium">WD Reason:</span> {selectedExpense.wd_reason}
                </p>
              )}
            </div>
          )}

          <Textarea
            placeholder="QS notes..."
            value={qsNotes}
            onChange={(e) => setQsNotes(e.target.value)}
            rows={3}
          />

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={actionLoading === selectedExpense?.id}
            >
              {actionLoading === selectedExpense?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {dialogAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
