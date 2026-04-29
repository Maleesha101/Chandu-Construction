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
import { 
  Plus, 
  Wallet, 
  ArrowRightLeft, 
  Loader2, 
  Edit, 
  TrendingUp, 
  Receipt, 
  ArrowLeft,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  from_account_name?: string;
  to_account_name?: string;
  transaction_type?: 'credit' | 'debit';
  transfer_type?: string;
  cheque_number?: string;
  payee_name?: string;
}

interface Cheque {
  id: string;
  bank_account_id: string;
  cheque_number: string;
  payee_name: string;
  amount: number;
  cheque_date: string;
  deposit_date?: string;
  deposited_to_account_id?: string;
  status: 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled';
  description?: string;
  bank_account_name?: string;
  deposited_to_account_name?: string;
  created_by_name?: string;
}

export default function BankManagement() {
  const { isRole } = useAuth();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [chequeDialogOpen, setChequeDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [bankToDelete, setBankToDelete] = useState<BankAccount | null>(null);
  const [viewingAccount, setViewingAccount] = useState<BankAccount | null>(null);
  const [accountTransactions, setAccountTransactions] = useState<BankTransfer[]>([]);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

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

  const [chequeData, setChequeData] = useState({
    cheque_number: '',
    payee_name: '',
    amount: '',
    cheque_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    deposit_to_account_id: '',
  });

  const handleDeleteBank = async () => {
    if (!bankToDelete || deleteConfirmationText !== 'CONFIRM') {
      toast.error('Type CONFIRM to deactivate the bank account');
      return;
    }

    setDeleting(true);
    try {
      await bankApi.delete(bankToDelete.id);
      toast.success('Bank account deactivated successfully');
      setBankToDelete(null);
      setDeleteConfirmationText('');
      fetchBanks();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      toast.error('Failed to deactivate bank account');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchBanks();
    fetchTransfers();
    fetchCheques();
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

  const fetchCheques = async () => {
    try {
      const data = await bankApi.getCheques();
      setCheques(data || []);
    } catch (error) {
      console.error('Error fetching cheques:', error);
    }
  };

  const fetchAccountTransactions = async (accountId: string) => {
    try {
      const data = await bankApi.getAccountTransactions(accountId);
      setAccountTransactions(data || []);
    } catch (error) {
      console.error('Error fetching account transactions:', error);
      toast.error('Failed to load account transactions');
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error('Error transferring:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chequeData.cheque_number || !chequeData.payee_name || !chequeData.amount || !chequeData.deposit_to_account_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    const amount = parseFloat(chequeData.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);

    try {
      await bankApi.createCheque({
        cheque_number: chequeData.cheque_number.trim(),
        payee_name: chequeData.payee_name.trim(),
        amount,
        cheque_date: chequeData.cheque_date,
        description: chequeData.description.trim() || null,
        deposit_to_account_id: chequeData.deposit_to_account_id,
      });

      toast.success('Cheque added and deposited successfully');
      setChequeDialogOpen(false);
      setChequeData({
        cheque_number: '',
        payee_name: '',
        amount: '',
        cheque_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        deposit_to_account_id: '',
      });
      fetchCheques();
      fetchTransfers();
      fetchBanks();
    } catch (error) {
      console.error('Error adding cheque:', error);
      toast.error('Failed to add cheque');
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

  const viewAccountDetails = async (bank: BankAccount) => {
    setViewingAccount(bank);
    await fetchAccountTransactions(bank.id);
  };

  const goBackToList = () => {
    setViewingAccount(null);
    setAccountTransactions([]);
  };

  const totalBalance = banks.reduce((sum, bank) => sum + Number(bank.balance), 0);
  const activeAccounts = banks.filter((b) => b.active).length;
  const totalCheques = cheques.length;

  if (!isRole(['boss', 'admin'])) {
    return (
      <DashboardLayout title="Bank Management">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Account Detail View
  if (viewingAccount) {
    const credits = accountTransactions.filter(t => t.transaction_type === 'credit');
    const debits = accountTransactions.filter(t => t.transaction_type === 'debit');
    const totalCredits = credits.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount), 0);

    return (
      <DashboardLayout
        title={`${viewingAccount.name} - Transaction History`}
        description={`${viewingAccount.bank_name} • ${viewingAccount.account_number || 'No Account Number'}`}
      >
        <Button variant="outline" onClick={goBackToList} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </Button>

        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(viewingAccount.balance))}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</div>
              <p className="text-xs text-muted-foreground">{credits.length} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDebits)}</div>
              <p className="text-xs text-muted-foreground">{debits.length} transactions</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Split View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Credits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-green-600" />
                Credits (Incoming)
              </CardTitle>
              <CardDescription>Money received into this account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {credits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No credit transactions</p>
                ) : (
                  credits.map((txn) => (
                    <div key={txn.id} className="flex justify-between items-start p-3 border rounded-lg bg-green-50">
                      <div className="flex-1">
                        <p className="font-medium text-sm">Cheque Deposit</p>
                        {txn.transfer_type === 'cheque_deposit' && txn.cheque_number && (
                          <p className="text-xs text-muted-foreground">
                            Cheque #{txn.cheque_number} - {txn.payee_name}
                          </p>
                        )}
            
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(txn.transfer_date), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">+{formatCurrency(Number(txn.amount))}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Debits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-red-600" />
                Debits (Outgoing)
              </CardTitle>
              <CardDescription>Money sent from this account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {debits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No debit transactions</p>
                ) : (
                  debits.map((txn) => (
                    <div key={txn.id} className="flex justify-between items-start p-3 border rounded-lg bg-red-50">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{txn.to_account_name || 'Unknown'}</p>
                        {txn.description && (
                          <p className="text-xs text-muted-foreground mt-1">{txn.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(txn.transfer_date), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">-{formatCurrency(Number(txn.amount))}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Main Bank Management View
  return (
    <DashboardLayout
      title="Bank Account Management"
      description="Manage your bank accounts, balances, transfers, and cheques"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Cheques</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{totalCheques}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
              <Receipt className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
            <TabsTrigger value="cheques">Cheques</TabsTrigger>
            <TabsTrigger value="transfers">Transfer History</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Dialog open={chequeDialogOpen} onOpenChange={setChequeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Receipt className="h-4 w-4" />
                  Add Cheque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Cheque</DialogTitle>
                  <DialogDescription>
                    Record a cheque and deposit it to your account.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCheque} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cheque Number *</Label>
                    <Input
                      placeholder="e.g., 001234"
                      value={chequeData.cheque_number}
                      onChange={(e) =>
                        setChequeData({ ...chequeData, cheque_number: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Payee Name *</Label>
                    <Input
                      placeholder="Who issued the cheque"
                      value={chequeData.payee_name}
                      onChange={(e) =>
                        setChequeData({ ...chequeData, payee_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Amount (LKR) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={chequeData.amount}
                      onChange={(e) =>
                        setChequeData({ ...chequeData, amount: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cheque Date *</Label>
                    <Input
                      type="date"
                      value={chequeData.cheque_date}
                      onChange={(e) =>
                        setChequeData({ ...chequeData, cheque_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Deposit To Account *</Label>
                    <Select
                      value={chequeData.deposit_to_account_id}
                      onValueChange={(value) =>
                        setChequeData({ ...chequeData, deposit_to_account_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account to deposit" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks
                          .filter((b) => b.active)
                          .map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.name} - {bank.bank_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Optional notes"
                      value={chequeData.description}
                      onChange={(e) =>
                        setChequeData({ ...chequeData, description: e.target.value })
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setChequeDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add & Deposit
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

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
                    <TableRow 
                      key={bank.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => viewAccountDetails(bank)}
                    >
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
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(bank);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={bank.active ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : ''}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (bank.active) {
                                setBankToDelete(bank);
                                setDeleteConfirmationText('');
                                return;
                              }

                              toggleActive(bank);
                            }}
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

        {/* Cheques Tab */}
        <TabsContent value="cheques" className="space-y-4">
          <div className="stat-card !p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cheque #</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead>Deposited To</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No cheques recorded yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  cheques.map((cheque) => (
                    <TableRow key={cheque.id}>
                      <TableCell className="font-medium">{cheque.cheque_number}</TableCell>
                      <TableCell>{cheque.payee_name}</TableCell>
                      <TableCell>{cheque.deposited_to_account_name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cheque.description || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(cheque.amount))}
                      </TableCell>
                      <TableCell>{format(new Date(cheque.cheque_date), 'MMM d, yyyy')}</TableCell>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
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
                      <TableCell>{transfer.from_account_name || '-'}</TableCell>
                      <TableCell>{transfer.to_account_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={transfer.transfer_type === 'cheque_deposit' ? 'default' : 'secondary'}>
                          {transfer.transfer_type === 'cheque_deposit' ? 'Cheque' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transfer.transfer_type === 'cheque_deposit' && transfer.cheque_number ? (
                          <div>
                            <p className="text-sm">Cheque #{transfer.cheque_number}</p>
                            <p className="text-xs text-muted-foreground">{transfer.payee_name}</p>
                          </div>
                        ) : (
                          transfer.description || '-'
                        )}
                      </TableCell>
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

      <Dialog open={!!bankToDelete} onOpenChange={(open) => {
        if (!open) {
          setBankToDelete(null);
          setDeleteConfirmationText('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Bank Account</DialogTitle>
            <DialogDescription>
              This will remove the bank account from active lists. Type CONFIRM to continue.
            </DialogDescription>
          </DialogHeader>
          {bankToDelete && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">Name:</span> {bankToDelete.name}</p>
              <p className="text-sm"><span className="text-muted-foreground">Bank:</span> {bankToDelete.bank_name}</p>
              <p className="text-sm"><span className="text-muted-foreground">Account:</span> {bankToDelete.account_number || '-'}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Type CONFIRM to deactivate</Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="CONFIRM"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBankToDelete(null);
                setDeleteConfirmationText('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteBank}
              disabled={deleting || deleteConfirmationText !== 'CONFIRM'}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deactivate Bank Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
