import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BankAccount, ManagingDirector, Site } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Upload } from 'lucide-react';
import { z } from 'zod';

const expenseSchema = z.object({
  to_name: z.string().min(1, 'Recipient name is required').max(200),
  purpose: z.string().min(1, 'Purpose is required').max(500),
  amount: z.number().positive('Amount must be positive'),
  site_id: z.string().min(1, 'Site is required'),
  from_bank_account_id: z.string().optional(),
  md_id: z.string().optional(),
  payment_method: z.string().default('cash'),
  reference: z.string().optional(),
});

export default function NewExpense() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [managingDirectors, setManagingDirectors] = useState<ManagingDirector[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  
  const [formData, setFormData] = useState({
    to_name: '',
    purpose: '',
    amount: '',
    site_id: '',
    from_bank_account_id: '',
    md_id: '',
    payment_method: 'cash',
    reference: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [banksRes, mdsRes, sitesRes] = await Promise.all([
          supabase.from('bank_accounts').select('*').eq('active', true),
          supabase.from('managing_directors').select('*').eq('active', true),
          supabase.from('sites').select('*').eq('active', true),
        ]);

        if (banksRes.data) setBankAccounts(banksRes.data as BankAccount[]);
        if (mdsRes.data) setManagingDirectors(mdsRes.data as ManagingDirector[]);
        if (sitesRes.data) setSites(sitesRes.data as Site[]);
      } catch (error) {
        console.error('Error fetching form data:', error);
        toast.error('Failed to load form data');
      } finally {
        setFetchingData(false);
      }
    }

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validatedData = expenseSchema.parse({
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        from_bank_account_id: formData.from_bank_account_id || undefined,
        md_id: formData.md_id || undefined,
        reference: formData.reference || undefined,
      });

      const { error } = await supabase.from('expense_records').insert([{
        to_name: validatedData.to_name,
        purpose: validatedData.purpose,
        amount: validatedData.amount,
        site_id: validatedData.site_id,
        from_bank_account_id: validatedData.from_bank_account_id || null,
        md_id: validatedData.md_id || null,
        payment_method: validatedData.payment_method,
        reference: validatedData.reference || null,
        entered_by_user_id: user?.id,
        entry_date: new Date().toISOString().split('T')[0],
        status: 'pending' as const,
      }]);

      if (error) throw error;

      toast.success('Expense record created successfully');
      navigate('/expenses');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Error creating expense:', error);
        toast.error('Failed to create expense record');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="New Expense" description="Create a new expense record">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/expenses')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="stat-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="to_name">Recipient Name *</Label>
              <Input
                id="to_name"
                placeholder="Worker name or supplier"
                value={formData.to_name}
                onChange={(e) => setFormData({ ...formData, to_name: e.target.value })}
                className={errors.to_name ? 'border-destructive' : ''}
              />
              {errors.to_name && (
                <p className="text-xs text-destructive">{errors.to_name}</p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (LKR) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
            </div>

            {/* Site */}
            <div className="space-y-2">
              <Label htmlFor="site_id">Site *</Label>
              <Select
                value={formData.site_id}
                onValueChange={(value) => setFormData({ ...formData, site_id: value })}
              >
                <SelectTrigger className={errors.site_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} {site.code && `(${site.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.site_id && (
                <p className="text-xs text-destructive">{errors.site_id}</p>
              )}
            </div>

            {/* Bank Account */}
            <div className="space-y-2">
              <Label htmlFor="from_bank_account_id">From Bank Account</Label>
              <Select
                value={formData.from_bank_account_id}
                onValueChange={(value) => setFormData({ ...formData, from_bank_account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name} - {bank.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Managing Director */}
            <div className="space-y-2">
              <Label htmlFor="md_id">Managing Director</Label>
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
                      {md.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose of Payment *</Label>
            <Textarea
              id="purpose"
              placeholder="Describe the purpose of this expense..."
              rows={3}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className={errors.purpose ? 'border-destructive' : ''}
            />
            {errors.purpose && (
              <p className="text-xs text-destructive">{errors.purpose}</p>
            )}
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">Reference / Invoice Number</Label>
            <Input
              id="reference"
              placeholder="Optional reference number"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            />
          </div>

          {/* Attachments - Placeholder */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag & drop bills or receipts here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Expense
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
