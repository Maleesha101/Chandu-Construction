import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { expenseApi, siteApi } from '@/lib/apiClient';
import { ExpenseRecord, Site } from '@/lib/types';
import { ArrowLeft, Loader2, Receipt, Building2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function SiteExpenses() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!siteId) {
        navigate('/sites');
        return;
      }

      try {
        const [sitesData, expensesData] = await Promise.all([
          siteApi.getAll(),
          expenseApi.getAll({ site_id: siteId }),
        ]);

        const foundSite = sitesData.find((s: Site) => s.id === siteId);
        if (!foundSite) {
          toast.error('Site not found');
          navigate('/sites');
          return;
        }

        setSite(foundSite);
        // Filter to only show cash expenses, exclude bank transfers
        setExpenses(expensesData.filter((e: ExpenseRecord) => e.payment_method === 'cash'));
      } catch (error) {
        console.error('Error fetching site expenses:', error);
        toast.error('Failed to load site expenses');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [siteId, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!site) {
    return null;
  }

  const pettyCashExpenses = expenses.filter(
    (e) => e.payment_method === 'cash' && ['approved', 'wd_approved'].includes(e.status)
  );
  const approvedExpenses = expenses.filter(
    (e) => e.payment_method === 'cash' && ['approved', 'wd_approved'].includes(e.status)
  );

  const totalPettyCash = pettyCashExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const totalExpenses = approvedExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  return (
    <DashboardLayout
      title={site.name}
      description={`View all expenses for ${site.name}`}
    >
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/sites')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Sites
        </Button>
      </div>

      {/* Site Info Card */}
      <div className="stat-card mb-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-2xl font-semibold">{site.name}</h2>
            </div>
            {site.code && (
              <Badge variant="secondary" className="w-fit">
                {site.code}
              </Badge>
            )}
            {site.location && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{site.location}</span>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="flex gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Receipt className="h-4 w-4" />
                <span className="text-sm font-medium">Total Expenses</span>
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(totalExpenses)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {approvedExpenses.length} approved
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="stat-card !p-0 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No petty cash expenses yet
            </h3>
            <p className="text-muted-foreground">
              There are no petty cash expense records for this site.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="data-table-row">
                    <TableCell className="font-medium">
                      {format(new Date(expense.entry_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{expense.to_name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expense.purpose}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={expense.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.entered_by_name || 'Unknown'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
