import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { LedgerAccount, LedgerEntryDetail, ExpenseBreakdown } from '@/lib/types';
import { ledgerApi } from '@/lib/apiClient';
import { toast } from 'sonner';
import {
  BookOpen,
  Loader2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Wrench,
  Home,
  Receipt,
  FileText,
  Banknote,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getAccountIcon(category: string) {
  switch (category) {
    case 'bank':
      return Wallet;
    case 'petty_cash':
      return Banknote;
    case 'supervisor':
      return Users;
    case 'machine':
      return Wrench;
    case 'rent':
      return Home;
    case 'general':
      return Receipt;
    default:
      return FileText;
  }
}

function getAccountTypeColor(type: string) {
  switch (type) {
    case 'asset':
      return 'bg-blue-100 text-blue-700';
    case 'liability':
      return 'bg-orange-100 text-orange-700';
    case 'expense':
      return 'bg-red-100 text-red-700';
    case 'revenue':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function Ledger() {
  const { isRole } = useAuth();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccount | null>(null);
  const [entries, setEntries] = useState<LedgerEntryDetail[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAccounts();
    fetchExpenseBreakdown();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await ledgerApi.getAccounts();
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching ledger accounts:', error);
      toast.error('Failed to load ledger accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseBreakdown = async () => {
    try {
      const data = await ledgerApi.getExpenseBreakdown();
      setExpenseBreakdown(data || []);
    } catch (error) {
      console.error('Error fetching expense breakdown:', error);
    }
  };

  const exportToExcel = () => {
    if (!selectedAccount || entries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = entries.map((entry) => ({
      Date: format(new Date(entry.transaction_date), 'yyyy-MM-dd'),
      Description: entry.description || '-',
      'From Person': entry.from_person_name || '-',
      Beneficiary: entry.expense_to_name || '-',
      Reference: entry.expense_reference || entry.reference_number || '-',
      Site: entry.site_name || '-',
      'Debit (LKR)': entry.debit > 0 ? Number(entry.debit).toFixed(2) : '0.00',
      'Credit (LKR)': entry.credit > 0 ? Number(entry.credit).toFixed(2) : '0.00',
      'Balance (LKR)': entry.balance_after !== null ? Number(entry.balance_after).toFixed(2) : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    const fileName = `${selectedAccount.account_name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel file exported successfully');
  };

  const exportToPDF = () => {
    if (!selectedAccount || entries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Add title
    doc.setFontSize(16);
    doc.text(`Dhanu Construction: ${selectedAccount.account_name}`, 14, 15);
    
    // Add account details
    doc.setFontSize(10);
    doc.text(`Account Code: ${selectedAccount.account_code} | Type: ${selectedAccount.account_type.toUpperCase()}`, 14, 22);
    doc.text(`Current Balance: LKR ${Number(selectedAccount.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 28);
    doc.text(`Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 34);

    // Prepare table data
    const tableData = entries.map((entry) => [
      format(new Date(entry.transaction_date), 'yyyy-MM-dd'),
      entry.description || '-',
      entry.expense_to_name || '-',
      entry.expense_reference || entry.reference_number || '-',
      entry.debit > 0 ? Number(entry.debit).toFixed(2) : '-',
      selectedAccount.account_type !== 'expense' ? (entry.credit > 0 ? Number(entry.credit).toFixed(2) : '-') : null,
      entry.balance_after !== null ? Number(entry.balance_after).toFixed(2) : '-',
    ].filter(item => item !== null));

    const columns = selectedAccount.account_type === 'expense'
      ? ['Date', 'Description', 'Beneficiary', 'Reference', 'Amount (LKR)', 'Balance (LKR)']
      : ['Date', 'Description', 'Beneficiary', 'Reference', 'Debit (LKR)', 'Credit (LKR)', 'Balance (LKR)'];

    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 }, // Date
        1: { cellWidth: 'auto' }, // Description
      },
    });

    const fileName = `${selectedAccount.account_name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    toast.success('PDF file exported successfully');
  };

  const exportAccountsToExcel = () => {
    if (accounts.length === 0) {
      toast.error('No accounts to export');
      return;
    }

    const filteredAccounts = getFilteredAccounts();
    const exportData = filteredAccounts.map((account) => ({
      'Account Code': account.account_code,
      'Account Name': account.account_name,
      Type: account.account_type.toUpperCase(),
      Category: account.account_category,
      'Balance (LKR)': Number(account.balance).toFixed(2),
      'Transactions': account.transaction_count || 0,
      Status: account.active ? 'Active' : 'Inactive',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger Accounts');
    
    const fileName = `Ledger_Accounts_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel file exported successfully');
  };

  const exportAccountsToPDF = () => {
    if (accounts.length === 0) {
      toast.error('No accounts to export');
      return;
    }

    const filteredAccounts = getFilteredAccounts();
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.text('Ledger Accounts Summary', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22);
    doc.text(`Total Accounts: ${filteredAccounts.length}`, 14, 28);
    doc.text(`Total Assets: LKR ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, 34);
    doc.text(`Total Expenses: LKR ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, 40);

    const tableData = filteredAccounts.map((account) => [
      account.account_code,
      account.account_name,
      account.account_type.toUpperCase(),
      account.account_category,
      Number(account.balance).toFixed(2),
      (account.transaction_count || 0).toString(),
    ]);

    autoTable(doc, {
      head: [['Code', 'Account Name', 'Type', 'Category', 'Balance (LKR)', 'Transactions']],
      body: tableData,
      startY: 46,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });

    const fileName = `Ledger_Accounts_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    toast.success('PDF file exported successfully');
  };

  const getFilteredAccounts = () => {
    return accounts.filter((account) => {
      const matchesSearch = searchTerm
        ? account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          account.account_code.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesSearch;
    });
  };

  const fetchAccountEntries = async (accountId: string) => {
    try {
      setLoadingEntries(true);
      const data = await ledgerApi.getAccountEntries(accountId, { limit: 100 });
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching account entries:', error);
      toast.error('Failed to load account transactions');
    } finally {
      setLoadingEntries(false);
    }
  };

  const viewAccountDetails = async (account: LedgerAccount) => {
    setSelectedAccount(account);
    await fetchAccountEntries(account.id);
  };

  const goBackToList = () => {
    setSelectedAccount(null);
    setEntries([]);
  };

  const filteredAccounts = accounts.filter(
    (account) =>
      // Show assets and expenses, hide liabilities
      account.account_type !== 'liability' &&
      (account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.account_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = [];
    }
    acc[account.account_type].push(account);
    return acc;
  }, {} as Record<string, LedgerAccount[]>);

  const totalAssets = accounts
    .filter((a) => a.account_type === 'asset')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const totalExpenses = accounts
    .filter((a) => a.account_type === 'expense')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const totalPettyCash = accounts
    .filter((a) => a.account_category === 'petty_cash')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  if (!isRole(['boss', 'admin'])) {
    return (
      <DashboardLayout title="Ledger">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Account Detail View
  if (selectedAccount) {
    const totalDebits = entries.reduce((sum, e) => sum + Number(e.debit), 0);
    const totalCredits = entries.reduce((sum, e) => sum + Number(e.credit), 0);
    const Icon = getAccountIcon(selectedAccount.account_category);

    return (
      <DashboardLayout
        title={`Ledger: ${selectedAccount.account_name}`}
        description={`${selectedAccount.account_code} • ${selectedAccount.account_type.toUpperCase()}`}
      >
        <Button variant="outline" onClick={goBackToList} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Ledger Accounts
        </Button>

        {/* Account Summary */}
        <div className={`grid grid-cols-1 ${selectedAccount.account_type === 'expense' ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6 mb-8`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(selectedAccount.balance))}</div>
              <Badge className={`mt-2 ${getAccountTypeColor(selectedAccount.account_type)}`}>
                {selectedAccount.account_type.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalDebits)}</div>
              <p className="text-xs text-muted-foreground">{entries.filter(e => e.debit > 0).length} entries</p>
              {selectedAccount.account_type === 'expense' && (
                <p className="text-xs text-muted-foreground mt-1">Expenses only have debits</p>
              )}
            </CardContent>
          </Card>

          {selectedAccount.account_type !== 'expense' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(totalCredits)}</div>
                <p className="text-xs text-muted-foreground">{entries.filter(e => e.credit > 0).length} entries</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entries.length}</div>
              <p className="text-xs text-muted-foreground">Total entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  {selectedAccount.account_type === 'expense' 
                    ? 'Expense accounts only receive DEBIT entries (spending increases). Machine and Rent expenses are recorded here when approved.'
                    : 'All ledger entries for this account'
                  }
                </CardDescription>
              </div>
              {entries.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    className="gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPDF}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">
                        {selectedAccount.account_type === 'expense' ? 'Amount (Debit)' : 'Debit'}
                      </TableHead>
                      {selectedAccount.account_type !== 'expense' && (
                        <TableHead className="text-right">Credit</TableHead>
                      )}
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={selectedAccount.account_type === 'expense' ? 6 : 7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {format(new Date(entry.transaction_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{entry.description || '-'}</p>
                              {entry.from_person_name && (
                                <p className="text-xs text-muted-foreground">From: {entry.from_person_name}</p>
                              )}
                              {entry.site_name && (
                                <p className="text-xs text-muted-foreground">Site: {entry.site_name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.expense_to_name || '-'}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">
                            {entry.expense_reference || entry.reference_number || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.debit > 0 ? (
                              <span className={`font-semibold ${
                                selectedAccount.account_type === 'asset' 
                                  ? 'text-green-600'  // Asset debit = money in (increase)
                                  : 'text-red-600'    // Expense debit = spending (decrease for company)
                              }`}>
                                {formatCurrency(Number(entry.debit))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {selectedAccount.account_type !== 'expense' && (
                            <TableCell className="text-right">
                              {entry.credit > 0 ? (
                                <span className={`font-semibold ${
                                  selectedAccount.account_type === 'asset'
                                    ? 'text-red-600'     // Asset credit = money out (decrease)
                                    : 'text-green-600'   // Liability/Revenue credit = increase
                                }`}>
                                  {formatCurrency(Number(entry.credit))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-semibold">
                            {entry.balance_after !== null ? formatCurrency(Number(entry.balance_after)) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Main Ledger View
  return (
    <DashboardLayout
      title="Ledger Accounts"
      description="Double-entry bookkeeping system for all financial transactions"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalAssets)}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter((a) => a.account_type === 'asset').length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Petty Cash Accounts</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPettyCash)}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter((a) => a.account_category === 'petty_cash').length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter((a) => a.account_type === 'expense').length} accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Accounts</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="petty_cash">Petty Cash</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="breakdown">Expense Breakdown</TabsTrigger>
        </TabsList>

        <div className="mb-4 flex items-center justify-between">
          <Input
            placeholder="Search accounts by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <div className="flex gap-2">
            <Button onClick={exportAccountsToExcel} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportAccountsToPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* All Accounts Tab */}
        <TabsContent value="all" className="space-y-6">
          {loading ? (
            <div className="stat-card text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <>
              {Object.entries(groupedAccounts).map(([type, accts]) => (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getAccountTypeColor(type)}>{type.toUpperCase()}</Badge>
                      <span className="text-muted-foreground font-normal text-sm">
                        ({accts.length} accounts)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accts.map((account) => {
                          const Icon = getAccountIcon(account.account_category);
                          return (
                            <TableRow
                              key={account.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => viewAccountDetails(account)}
                            >
                              <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{account.account_name}</p>
                                    {account.bank_account_name && (
                                      <p className="text-xs text-muted-foreground">
                                        {account.bank_account_name}
                                      </p>
                                    )}
                                    {account.supervisor_name && (
                                      <p className="text-xs text-muted-foreground">
                                        {account.supervisor_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{account.account_category}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(Number(account.balance))}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {account.transaction_count || 0}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Asset Accounts</CardTitle>
              <CardDescription>Bank accounts and other assets</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts
                    .filter((a) => a.account_type === 'asset')
                    .map((account) => {
                      const Icon = getAccountIcon(account.account_category);
                      return (
                        <TableRow
                          key={account.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => viewAccountDetails(account)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{account.account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{account.account_category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Number(account.balance))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Petty Cash Tab */}
        <TabsContent value="petty_cash">
          <Card>
            <CardHeader>
              <CardTitle>Petty Cash Accounts</CardTitle>
              <CardDescription>Cash held by individuals for expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts
                    .filter((a) => a.account_category === 'petty_cash')
                    .map((account) => {
                      const Icon = getAccountIcon(account.account_category);
                      return (
                        <TableRow
                          key={account.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => viewAccountDetails(account)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{account.account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                              {account.account_category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {formatCurrency(Number(account.balance))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {filteredAccounts.filter((a) => a.account_category === 'petty_cash').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No petty cash accounts found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Expense Accounts</CardTitle>
              <CardDescription>
                Machine, Rent, and General expense categories. These accounts ONLY receive debit entries (no credits).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts
                    .filter((a) => a.account_type === 'expense')
                    .map((account) => {
                      const Icon = getAccountIcon(account.account_category);
                      return (
                        <TableRow
                          key={account.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => viewAccountDetails(account)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{account.account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{account.account_category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {formatCurrency(Number(account.balance))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Breakdown Tab */}
        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>
                Detailed expense analysis by category. All amounts shown are debits (spending). Machine and Rent expenses are never credited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Expense Count</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No expense data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseBreakdown.map((item, index) => {
                      const Icon = getAccountIcon(item.account_category);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline">{item.account_category}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.account_name}</TableCell>
                          <TableCell className="text-right">{item.expense_count}</TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {formatCurrency(Number(item.total_amount))}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
