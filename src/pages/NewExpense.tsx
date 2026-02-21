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
import { bankApi, siteApi, expenseApi, userApi, mdApi } from '@/lib/apiClient';
import { BankAccount, ManagingDirector, Site } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Trash2, Settings } from 'lucide-react';
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
  const [transactionUsers, setTransactionUsers] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  const [beneficiaries, setBeneficiaries] = useState<ManagingDirector[]>([]);
  const [supervisorUsers, setSupervisorUsers] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  
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
  
  // Dialog state for adding new supervisor
  const [showAddSupervisorDialog, setShowAddSupervisorDialog] = useState(false);
  const [addingSupervisor, setAddingSupervisor] = useState(false);
  const [newSupervisorData, setNewSupervisorData] = useState({
    full_name: '',
    email: '',                                                                                                                                              
    password: '',
    phone: '',
    role: 'md' as 'admin' | 'md' | 'worker',
  });

  // Dialog state for adding new beneficiary
  const [showAddBeneficiaryDialog, setShowAddBeneficiaryDialog] = useState(false);
  const [addingBeneficiary, setAddingBeneficiary] = useState(false);
  const [newBeneficiaryData, setNewBeneficiaryData] = useState({
    name: '',                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
    phone: '',
  });

  // Dialog state for managing beneficiaries
  const [showManageBeneficiariesDialog, setShowManageBeneficiariesDialog] = useState(false);
  const [deletingBeneficiary, setDeletingBeneficiary] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [banks, sitesData, usersData, mdsData, supervisorUsersData] = await Promise.all([
          bankApi.getAll(),
          siteApi.getAll(true),
          userApi.getTransactionUsers(),
          mdApi.getAll(),
          userApi.getSupervisors(),
        ]);

        setBankAccounts(banks);
        setSites(sitesData);
        setTransactionUsers(usersData);
        setBeneficiaries(mdsData);
        setSupervisorUsers(supervisorUsersData);
      } catch (error) {
        console.error('Error fetching form data:', error);
        toast.error('Failed to load form data');
      } finally {
        setFetchingData(false);
      }
    }

    fetchData();
  }, []);

  const fetchSupervisors = async () => {
    try {
      const usersData = await userApi.getTransactionUsers();
      setTransactionUsers(usersData);
    } catch (error) {
      console.error('Error fetching transaction users:', error);
    }
  };

  const fetchBeneficiaries = async () => {
    try {
      const [mdsData, supervisorUsersData] = await Promise.all([
        mdApi.getAll(),
        userApi.getSupervisors(),
      ]);
      setBeneficiaries(mdsData);
      setSupervisorUsers(supervisorUsersData);
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
    }
  };

  const handleDeleteBeneficiary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this beneficiary?')) {
      return;
    }

    setDeletingBeneficiary(id);
    try {
      await mdApi.delete(id);
      toast.success('Beneficiary deleted successfully');
      await fetchBeneficiaries();
    } catch (error: any) {
      console.error('Error deleting beneficiary:', error);
      toast.error(error.message || 'Failed to delete beneficiary');
    } finally {
      setDeletingBeneficiary(null);
    }
  };

  const handleAddSupervisor = async () => {
    if (!newSupervisorData.full_name.trim() || !newSupervisorData.password.trim()) {
      toast.error('Please fill in all required fields (Name and Password)');
      return;
    }
    if (newSupervisorData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setAddingSupervisor(true);
    try {
      await userApi.createUser({
        email: newSupervisorData.email.trim() || `${newSupervisorData.full_name.trim().replace(/\s+/g, '_').toLowerCase()}@temp.local`,
        password: newSupervisorData.password,
        full_name: newSupervisorData.full_name.trim(),
        phone: newSupervisorData.phone.trim() || undefined,
        role: newSupervisorData.role,
      });

      toast.success('User added successfully');
      setShowAddSupervisorDialog(false);
      setNewSupervisorData({ full_name: '', email: '', password: '', phone: '', role: 'md' });
      
      // Refresh supervisors list
      await fetchSupervisors();
      
      // Auto-select the newly added supervisor
      setFormData({ ...formData, from_person: newSupervisorData.full_name.trim() });
    } catch (error: any) {
      console.error('Error adding supervisor:', error);
      toast.error(error.message || 'Failed to add supervisor');
    } finally {
      setAddingSupervisor(false);
    }
  };

  const handleAddBeneficiary = async () => {
    if (!newBeneficiaryData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setAddingBeneficiary(true);
    try {
      const newSupervisor = await mdApi.create({
        name: newBeneficiaryData.name.trim(),
        contact: newBeneficiaryData.phone.trim() || undefined,
      });

      toast.success('Beneficiary added successfully');
      setShowAddBeneficiaryDialog(false);
      setNewBeneficiaryData({ name: '', phone: '' });
      
      // Refresh beneficiaries list
      await fetchBeneficiaries();
      
      // Auto-select the newly added beneficiary
      setFormData({ ...formData, beneficiary: newBeneficiaryData.name.trim() });
    } catch (error: any) {
      console.error('Error adding beneficiary:', error);
      toast.error(error.message || 'Failed to add beneficiary');
    } finally {
      setAddingBeneficiary(false);
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
        from_person_name: validatedData.from_person,
        // status is automatically set to 'pending' in the backend
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
              <div className="flex gap-2">
                <Select
                  value={formData.from_person}
                  onValueChange={(value) => setFormData({ ...formData, from_person: value })}
                  disabled={loading}
                >
                  <SelectTrigger className={errors.from_person ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionUsers.map((user) => (
                      <SelectItem key={user.id} value={user.full_name}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                    {transactionUsers.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No users available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {isRole(['boss', 'admin']) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAddSupervisorDialog(true)}
                    title="Add new user"
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
              <Label htmlFor="beneficiary">Expense Category / Beneficiary (To) *</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.beneficiary}
                  onValueChange={(value) => setFormData({ ...formData, beneficiary: value })}
                  disabled={loading}
                >
                  <SelectTrigger className={errors.beneficiary ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select expense category or beneficiary" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Expense Categories */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                       Expense Categories
                    </div>
                    <SelectItem value="Machine">Machine</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    
                    {/* Beneficiaries from managing_directors table */}
                    {beneficiaries.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                           Payment to Supervisors
                        </div>
                        {beneficiaries.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.name}>
                            {supervisor.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    {/* Supervisor users from users table */}
                    {supervisorUsers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                           User Accounts
                        </div>
                        {supervisorUsers.map((user) => (
                          <SelectItem key={user.id} value={user.full_name}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    {beneficiaries.length === 0 && supervisorUsers.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No supervisors available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {isRole(['boss', 'admin']) && (
                  <>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowManageBeneficiariesDialog(true)}
                      title="Manage beneficiaries"
                      disabled={loading}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </>
                )}
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
                  {sites.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No sites available. Please add sites first.
                    </div>
                  ) : (
                    sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} {site.code && `(${site.code})`}
                      </SelectItem>
                    ))
                  )}
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
              Add a new supervisor/beneficiary to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="beneficiary_name">Name *</Label>
              <Input
                id="beneficiary_name"
                placeholder="Enter name"
                value={newBeneficiaryData.name}
                onChange={(e) => setNewBeneficiaryData({ ...newBeneficiaryData, name: e.target.value })}
                disabled={addingBeneficiary}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="beneficiary_phone">Phone Number</Label>
              <Input
                id="beneficiary_phone"
                placeholder="Enter phone number"
                value={newBeneficiaryData.phone}
                onChange={(e) => setNewBeneficiaryData({ ...newBeneficiaryData, phone: e.target.value })}
                disabled={addingBeneficiary}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowAddBeneficiaryDialog(false);
                setNewBeneficiaryData({ name: '', phone: '' });
              }}
              disabled={addingBeneficiary}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAddBeneficiary}
              disabled={addingBeneficiary}
            >
              {addingBeneficiary && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Beneficiary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Supervisor Dialog */}
      <Dialog open={showAddSupervisorDialog} onOpenChange={setShowAddSupervisorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for transaction tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supervisor_name">Full Name *</Label>
              <Input
                id="supervisor_name"
                placeholder="Enter full name"
                value={newSupervisorData.full_name}
                onChange={(e) => setNewSupervisorData({ ...newSupervisorData, full_name: e.target.value })}
                disabled={addingSupervisor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_email">Email</Label>
              <Input
                id="supervisor_email"
                type="email"
                placeholder="Enter email address (optional)"
                value={newSupervisorData.email}
                onChange={(e) => setNewSupervisorData({ ...newSupervisorData, email: e.target.value })}
                disabled={addingSupervisor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_role">Role *</Label>
              <Select
                value={newSupervisorData.role}
                onValueChange={(value: 'admin' | 'md' | 'worker') => 
                  setNewSupervisorData({ ...newSupervisorData, role: value })
                }
                disabled={addingSupervisor}
              >
                <SelectTrigger id="supervisor_role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="md">Supervisor</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_password">Password *</Label>
              <Input
                id="supervisor_password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newSupervisorData.password}
                onChange={(e) => setNewSupervisorData({ ...newSupervisorData, password: e.target.value })}
                disabled={addingSupervisor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_phone">Phone (Optional)</Label>
              <Input
                id="supervisor_phone"
                placeholder="Enter phone number"
                value={newSupervisorData.phone}
                onChange={(e) => setNewSupervisorData({ ...newSupervisorData, phone: e.target.value })}
                disabled={addingSupervisor}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowAddSupervisorDialog(false);
                setNewSupervisorData({ full_name: '', email: '', password: '', phone: '', role: 'md' });
              }}
              disabled={addingSupervisor}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAddSupervisor}
              disabled={addingSupervisor}
            >
              {addingSupervisor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Beneficiaries Dialog */}
      <Dialog open={showManageBeneficiariesDialog} onOpenChange={setShowManageBeneficiariesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Beneficiaries</DialogTitle>
            <DialogDescription>
              View and delete beneficiaries from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[500px] overflow-y-auto">
            {beneficiaries.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Supervisors (Managing Directors)</h3>
                <div className="space-y-2">
                  {beneficiaries.map((beneficiary) => (
                    <div
                      key={beneficiary.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{beneficiary.name}</p>
                        {beneficiary.contact && (
                          <p className="text-sm text-muted-foreground">{beneficiary.contact}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBeneficiary(beneficiary.id)}
                        disabled={deletingBeneficiary === beneficiary.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {deletingBeneficiary === beneficiary.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {supervisorUsers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">User Accounts</h3>
                <div className="space-y-2">
                  {supervisorUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">Cannot delete user accounts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {beneficiaries.length === 0 && supervisorUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No beneficiaries found
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setShowManageBeneficiariesDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
