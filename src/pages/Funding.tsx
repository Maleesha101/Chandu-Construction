import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BankAccount, ManagingDirector, FundingTransaction } from '@/lib/types';
import { toast } from 'sonner';
import { Plus, Wallet, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Funding() {
  const { user, isRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [managingDirectors, setManagingDirectors] = useState<ManagingDirector[]>([]);
  const [fundingHistory, setFundingHistory] = useState<FundingTransaction[]>([]);
  
  const [formData, setFormData] = useState({
    bank_account_id: '',
    md_id: '',
    amount: '',
    note: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [banksRes, mdsRes, fundingRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('active', true),
        supabase.from('managing_directors').select('*').eq('active', true),
        supabase
          .from('funding_transactions')
          .select(`
            *,
            bank_accounts:bank_account_id(name, bank_name),
            managing_directors:md_id(name)
          `)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (banksRes.data) setBankAccounts(banksRes.data as BankAccount[]);
      if (mdsRes.data) setManagingDirectors(mdsRes.data as ManagingDirector[]);
      if (fundingRes.data) setFundingHistory(fundingRes.data as unknown as FundingTransaction[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Create funding transaction
      const { error } = await supabase.from('funding_transactions').insert({
        bank_account_id: formData.bank_account_id,
        md_id: formData.md_id || null,
        amount,
        note: formData.note || null,
        created_by: user.id,
        funding_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      // Update bank balance (decrease)
      const bank = bankAccounts.find(b => b.id === formData.bank_account_id);
      if (bank) {
        await supabase
          .from('bank_accounts')
          .update({ balance: Number(bank.balance) - amount })
          .eq('id', formData.bank_account_id);
      }

      // Update MD float (increase)
      if (formData.md_id) {
        const md = managingDirectors.find(m => m.id === formData.md_id);
        if (md) {
          await supabase
            .from('managing_directors')
            .update({ float_balance: Number(md.float_balance) + amount })
            .eq('id', formData.md_id);
        }
      }

      toast.success('Funding transaction created successfully');
      setDialogOpen(false);
      setFormData({ bank_account_id: '', md_id: '', amount: '', note: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating funding:', error);
      toast.error('Failed to create funding transaction');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isRole('boss')) {
    return (
      <DashboardLayout title="Funding">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Weekly Funding" description="Manage fund disbursements to managing directors">
      {/* Bank Accounts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {bankAccounts.map((bank) => (
          <div key={bank.id} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{bank.name}</p>
                  <p className="text-xs text-muted-foreground">{bank.bank_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(Number(bank.balance))}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Funding Button */}
      <div className="mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Funding
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Funding Transaction</DialogTitle>
              <DialogDescription>
                Transfer funds from a bank account to a managing director.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>From Bank Account *</Label>
                <Select
                  value={formData.bank_account_id}
                  onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name} - {formatCurrency(Number(bank.balance))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To Managing Director</Label>
                <Select
                  value={formData.md_id}
                  onValueChange={(value) => setFormData({ ...formData, md_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select MD (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {managingDirectors.map((md) => (
                      <SelectItem key={md.id} value={md.id}>
                        {md.name} - Float: {formatCurrency(Number(md.float_balance))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount (LKR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  placeholder="Optional note..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!formData.bank_account_id || !formData.amount || submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Funding
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Funding History */}
      <div className="stat-card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Recent Funding Transactions</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          </div>
        ) : fundingHistory.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No funding transactions yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>From Bank</TableHead>
                <TableHead>To MD</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fundingHistory.map((funding) => (
                <TableRow key={funding.id} className="data-table-row">
                  <TableCell>
                    {format(new Date(funding.funding_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      {(funding as any).bank_accounts?.name || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {(funding as any).managing_directors?.name || 'General'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(funding.amount))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {funding.note || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
}
