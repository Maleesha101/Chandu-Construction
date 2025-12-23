import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { BankAccount } from '@/lib/types';
import { bankApi } from '@/lib/apiClient';
import { toast } from 'sonner';
import { Plus, Wallet, ArrowRightLeft, Loader2, Edit, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface BankTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description: string;
  transfer_date: string;
  created_at: string;
  from_account?: BankAccount;
  to_account?: BankAccount;
}

export default function BankManagement() {
  const { isRole } = useAuth();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    balance: '',
    currency: 'LKR',
  });

  const [transferData, setTransferData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    fetchBanks();
    fetchTransfers();
  }, []);

  const fetchBanks = async () => {
    try {
      const data = await bankApi.getAll();
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const data = await bankApi.getTransfers();
      setTransfers(data || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.bank_name.trim()) {
      toast.error('Account name and bank name are required');
      return;
    }
    setSubmitting(true);

    try {
      await bankApi.create({
        name: formData.name.trim(),
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim() || null,
        balance: parseFloat(formData.balance) || 0,
        currency: formData.currency,
        active: true,
      });

      toast.success('Bank account added successfully');
      setAddDialogOpen(false);
      setFormData({
        name: '',
        bank_name: '',
        account_number: '',
        balance: '',
        currency: 'LKR',
      });
      fetchBanks();
    } catch (error: any) {
      console.error('Error adding bank:', error);
      toast.error('Failed to add bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank || !formData.name.trim() || !formData.bank_name.trim()) {
      toast.error('Account name and bank name are required');
      return;
    }
    setSubmitting(true);

    try {
      await bankApi.update(selectedBank.id, {
        name: formData.name.trim(),
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim() || null,
        balance: parseFloat(formData.balance) || 0,
        currency: formData.currency,
      });

      toast.success('Bank account updated successfully');
      setEditDialogOpen(false);
      setSelectedBank(null);
      setFormData({
        name: '',
        bank_name: '',
        account_number: '',
        balance: '',
        currency: 'LKR',
      });
      fetchBanks();
    } catch (error: any) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.from_account_id || !transferData.to_account_id) {
      toast.error('Please select both accounts');
      return;
    }
    if (transferData.from_account_id === transferData.to_account_id) {
      toast.error('Cannot transfer to the same account');
      return;
    }
    const amount = parseFloat(transferData.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);

    try {
      await bankApi.transfer({
        from_account_id: transferData.from_account_id,
        to_account_id: transferData.to_account_id,
        amount,
        description: transferData.description.trim() || null,
      });

      toast.success('Transfer completed successfully');
      setTransferDialogOpen(false);
      setTransferData({
        from_account_id: '',
        to_account_id: '',
        amount: '',
        description: '',
      });
      fetchBanks();
      fetchTransfers();
    } catch (error: any) {
      console.error('Error transferring:', error);
      toast.error(error.message || 'Failed to complete transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (bank: BankAccount) => {
    setSelectedBank(bank);
    setFormData({
      name: bank.name,
      bank_name: bank.bank_name,
      account_number: bank.account_number || '',
      balance: bank.balance.toString(),
      currency: bank.currency,
    });
    setEditDialogOpen(true);
  };

  const toggleActive = async (bank: BankAccount) => {
    try {
      await bankApi.update(bank.id, { active: !bank.active });
      toast.success(`Bank account ${bank.active ? 'deactivated' : 'activated'}`);
      fetchBanks();
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank account');
    }
  };

  const totalBalance = banks.reduce((sum, bank) => sum + Number(bank.balance), 0);
  const activeAccounts = banks.filter((b) => b.active).length;

  if (!isRole(['boss', 'admin'])) {
    return (
      <DashboardLayout title="Bank Management">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Bank Account Management"
      description="Manage your bank accounts, balances, and transfers"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{activeAccounts}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{banks.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <ArrowRightLeft className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
            <TabsTrigger value="transfers">Transfer History</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer Between Accounts</DialogTitle>
                  <DialogDescription>
                    Transfer funds between your bank accounts.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="space-y-2">
                    <Label>From Account *</Label>
                    <Select
                      value={transferData.from_account_id}
                      onValueChange={(value) =>
                        setTransferData({ ...transferData, from_account_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks
                          .filter((b) => b.active)
                          .map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.name} - {formatCurrency(Number(bank.balance))}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>To Account *</Label>
                    <Select
                      value={transferData.to_account_id}
                      onValueChange={(value) =>
                        setTransferData({ ...transferData, to_account_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks
                          .filter((b) => b.active && b.id !== transferData.from_account_id)
                          .map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.name} - {formatCurrency(Number(bank.balance))}
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
                      value={transferData.amount}
                      onChange={(e) =>
                        setTransferData({ ...transferData, amount: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Transfer reason or note"
                      value={transferData.description}
                      onChange={(e) =>
                        setTransferData({ ...transferData, description: e.target.value })
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTransferDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Transfer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Bank Account</DialogTitle>
                  <DialogDescription>
                    Create a new bank account for tracking.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddBank} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account Name *</Label>
                    <Input
                      placeholder="e.g., Main Operating Account"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Input
                      placeholder="e.g., Bank of Ceylon"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      placeholder="Optional"
                      value={formData.account_number}
                      onChange={(e) =>
                        setFormData({ ...formData, account_number: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current Balance (LKR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LKR">LKR - Sri Lankan Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Account
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bank Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="stat-card !p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : banks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">No bank accounts found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  banks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.name}</TableCell>
                      <TableCell>{bank.bank_name}</TableCell>
                      <TableCell>{bank.account_number || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(bank.balance))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={bank.active ? 'default' : 'secondary'}>
                          {bank.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(bank)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(bank)}
                          >
                            {bank.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Transfer History Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <div className="stat-card !p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <ArrowRightLeft className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No transfers recorded yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        {format(new Date(transfer.transfer_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{(transfer as any).from_account_name || '-'}</TableCell>
                      <TableCell>{(transfer as any).to_account_name || '-'}</TableCell>
                      <TableCell>{transfer.description || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(transfer.amount))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
            <DialogDescription>Update bank account details and balance.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBank} className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g., Main Operating Account"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input
                placeholder="e.g., Bank of Ceylon"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                placeholder="Optional"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Current Balance (LKR)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LKR">LKR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedBank(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
