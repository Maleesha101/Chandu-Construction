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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { bankApi, siteApi, expenseApi, userApi } from '@/lib/apiClient';
import { BankAccount, ManagingDirector, Site } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import { z } from 'zod';

const expenseSchema = z.object({
  transaction_date: z.string().min(1, 'Transaction date is required'),
  from_person: z.string().min(1, 'From person is required'),
  beneficiary: z.string().min(1, 'Beneficiary is required'),
  purpose: z.string().min(1, 'Purpose is required').max(500),
  amount: z.number().positive('Amount must be positive'),
  site_id: z.string().min(1, 'Site is required'),
  payment_source: z.enum(['petty_cash', 'bank_account'], {
    errorMap: () => ({ message: 'Payment source is required' })
  }),
  from_bank_account_id: z.string().optional(),
  reference: z.string().optional(),
});

export default function NewExpense() {
  const navigate = useNavigate();
  const { user, isRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [managingDirectors, setManagingDirectors] = useState<ManagingDirector[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string }>>([]);
  const [beneficiaries, setBeneficiaries] = useState<string[]>(['Supplier', 'Contractor', 'Worker', 'Vendor']);
  
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    from_person: '',
    beneficiary: '',
    purpose: '',
    amount: '',
    site_id: '',
    payment_source: '' as 'petty_cash' | 'bank_account' | '',
    from_bank_account_id: '',
    reference: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dialog states for adding new beneficiaries
  const [showAddBeneficiaryDialog, setShowAddBeneficiaryDialog] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [banks, sitesData, supervisorsData] = await Promise.all([
          bankApi.getAll(),
          siteApi.getAll(true),
          userApi.getSupervisors(),
        ]);

        setBankAccounts(banks);
        setSites(sitesData);
        setSupervisors(supervisorsData);
      } catch (error) {
        console.error('Error fetching form data:', error);
        toast.error('Failed to load form data');
      } finally {
        setFetchingData(false);
      }
    }

    fetchData();
  }, []);

  const handleAddBeneficiary = () => {
    if (newBeneficiary.trim()) {
      setBeneficiaries([...beneficiaries, newBeneficiary.trim()]);
      setFormData({ ...formData, beneficiary: newBeneficiary.trim() });
      setNewBeneficiary('');
      setShowAddBeneficiaryDialog(false);
      toast.success('Beneficiary added successfully');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validatedData = expenseSchema.parse({
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        from_bank_account_id: formData.payment_source === 'bank_account' ? formData.from_bank_account_id : undefined,
        reference: formData.reference || undefined,
      });

      // Prepare the payload with approval status
      await expenseApi.create({
        to_name: validatedData.beneficiary,
        purpose: validatedData.purpose,
        amount: validatedData.amount,
        site_id: validatedData.site_id,
        from_bank_account_id: validatedData.payment_source === 'bank_account' ? validatedData.from_bank_account_id : null,
        md_id: null,
        payment_method: validatedData.payment_source === 'petty_cash' ? 'cash' : 'bank_transfer',
        reference: validatedData.reference || null,
        entry_date: validatedData.transaction_date,
        // status is automatically set to 'pending' in the backend
        // Additional fields that may need to be stored in backend
        // from_person: validatedData.from_person,
      });

      toast.success('Expense submitted for approval successfully');
      // Navigate to dashboard to see the submission
      navigate('/');
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
            {/* Transaction Date */}
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Transaction Date *</Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className={errors.transaction_date ? 'border-destructive' : ''}
                disabled={loading}
              />
              {errors.transaction_date && (
                <p className="text-xs text-destructive">{errors.transaction_date}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Entered by: {user?.full_name || user?.email || 'Current User'}
              </p>
            </div>

            {/* From Person */}
            <div className="space-y-2">
              <Label htmlFor="from_person">From (Transaction Made By) *</Label>
              <Select
                value={formData.from_person}
                onValueChange={(value) => setFormData({ ...formData, from_person: value })}
                disabled={loading}
              >
                <SelectTrigger className={errors.from_person ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.full_name}>
                      {supervisor.full_name}
                    </SelectItem>
                  ))}
                  {supervisors.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No supervisors available
                    </div>
                  )}
                </SelectContent>
              </Select>
              {errors.from_person && (
                <p className="text-xs text-destructive">{errors.from_person}</p>
              )}
            </div>

            {/* Payment Source */}
            <div className="space-y-2">
              <Label htmlFor="payment_source">Payment Source *</Label>
              <Select
                value={formData.payment_source}
                onValueChange={(value: 'petty_cash' | 'bank_account') => 
                  setFormData({ ...formData, payment_source: value, from_bank_account_id: '' })
                }
                disabled={loading}
              >
                <SelectTrigger className={errors.payment_source ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select payment source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petty_cash">Petty Cash (Ledger)</SelectItem>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                </SelectContent>
              </Select>
              {errors.payment_source && (
                <p className="text-xs text-destructive">{errors.payment_source}</p>
              )}
            </div>

            {/* Bank Account - Conditional */}
            {formData.payment_source === 'bank_account' && (
              <div className="space-y-2">
                <Label htmlFor="from_bank_account_id">Bank Account *</Label>
                <Select
                  value={formData.from_bank_account_id}
                  onValueChange={(value) => setFormData({ ...formData, from_bank_account_id: value })}
                  disabled={loading}
                >
                  <SelectTrigger className={errors.from_bank_account_id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name} - {bank.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.from_bank_account_id && (
                  <p className="text-xs text-destructive">{errors.from_bank_account_id}</p>
                )}
              </div>
            )}

            {/* Beneficiary */}
            <div className="space-y-2">
              <Label htmlFor="beneficiary">Beneficiary (To) *</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.beneficiary}
                  onValueChange={(value) => setFormData({ ...formData, beneficiary: value })}
                  disabled={loading}
                >
                  <SelectTrigger className={errors.beneficiary ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select beneficiary" />
                  </SelectTrigger>
                  <SelectContent>
                    {beneficiaries.map((beneficiary) => (
                      <SelectItem key={beneficiary} value={beneficiary}>
                        {beneficiary}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddBeneficiaryDialog(true)}
                  title="Add new beneficiary"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.beneficiary && (
                <p className="text-xs text-destructive">{errors.beneficiary}</p>
              )}
            </div>

            {/* Site */}
            <div className="space-y-2">
              <Label htmlFor="site_id">Site *</Label>
              <Select
                value={formData.site_id}
                onValueChange={(value) => setFormData({ ...formData, site_id: value })}
                disabled={loading}
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
                disabled={loading}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
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
              disabled={loading}
            />
            {errors.purpose && (
              <p className="text-xs text-destructive">{errors.purpose}</p>
            )}
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

      {/* Add Beneficiary Dialog */}
      <Dialog open={showAddBeneficiaryDialog} onOpenChange={setShowAddBeneficiaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Beneficiary</DialogTitle>
            <DialogDescription>
              Add a new beneficiary to receive payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_beneficiary">Beneficiary Name</Label>
              <Input
                id="new_beneficiary"
                placeholder="Enter beneficiary name"
                value={newBeneficiary}
                onChange={(e) => setNewBeneficiary(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBeneficiary()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddBeneficiaryDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddBeneficiary}>
              Add Beneficiary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
