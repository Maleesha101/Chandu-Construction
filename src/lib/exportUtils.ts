import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';
import { ExpenseRecord, Site } from './types';
import { format } from 'date-fns';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface ExportOptions {
  site: Site;
  expenses: ExpenseRecord[];
  dateFilter: 'all' | 'week' | 'month' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
}

export function exportToPDF(options: ExportOptions): void {
  const { site, expenses, dateFilter, customStartDate, customEndDate } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Site Expenses Report', margin, yPosition);

  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Site Details
  doc.text(`Site: ${site.name}${site.code ? ` (${site.code})` : ''}`, margin, yPosition);
  yPosition += 5;
  if (site.location) {
    doc.text(`Location: ${site.location}`, margin, yPosition);
    yPosition += 5;
  }

  // Date Range
  const dateRangeText =
    dateFilter === 'all'
      ? 'Period: All Time'
      : dateFilter === 'week'
        ? 'Period: This Week'
        : dateFilter === 'month'
          ? 'Period: This Month'
          : `Period: ${customStartDate} to ${customEndDate}`;
  doc.text(dateRangeText, margin, yPosition);
  yPosition += 5;

  // Export Date
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, yPosition);
  yPosition += 10;

  // Calculate totals
  const approvedExpenses = expenses.filter((e) => ['approved', 'wd_approved'].includes(e.status));
  const totalAmount = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Approved Expenses: ${formatCurrency(totalAmount)}`, margin, yPosition);
  doc.setFont('helvetica', 'normal');
  yPosition += 7;
  doc.text(`Total Records: ${expenses.length}`, margin, yPosition);
  yPosition += 10;

  // Table
  const tableData = expenses.map((expense) => [
    format(new Date(expense.entry_date), 'MMM d, yyyy'),
    expense.to_name || '-',
    expense.purpose || '-',
    formatCurrency(Number(expense.amount)),
    expense.status.toUpperCase(),
    expense.entered_by_name || 'Unknown',
  ]);

  autoTable(doc, {
    head: [['Date', 'Beneficiary', 'Purpose', 'Amount', 'Status', 'Entered By']],
    body: tableData,
    startY: yPosition,
    margin: margin,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      3: { halign: 'right' },
    },
  });

  // Save PDF
  const fileName = `SiteExpenses_${site.code || site.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}

export function exportToExcel(options: ExportOptions): void {
  const { site, expenses, dateFilter, customStartDate, customEndDate } = options;

  // Create workbook
  const workbook = utils.book_new();

  // Prepare expense data
  const expenseData = expenses.map((expense) => ({
    'Date': format(new Date(expense.entry_date), 'MMM d, yyyy'),
    'Beneficiary': expense.to_name || '-',
    'Purpose': expense.purpose || '-',
    'Amount (LKR)': Number(expense.amount),
    'Status': expense.status.toUpperCase(),
    'Entered By': expense.entered_by_name || 'Unknown',
  }));

  // Calculate totals
  const approvedExpenses = expenses.filter((e) => ['approved', 'wd_approved'].includes(e.status));
  const totalAmount = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Add totals row
  expenseData.push({
    'Date': 'TOTAL',
    'Beneficiary': '',
    'Purpose': '',
    'Amount (LKR)': totalAmount,
    'Status': `${approvedExpenses.length} Approved`,
    'Entered By': '',
  });

  // Create worksheet
  const worksheet = utils.json_to_sheet(expenseData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Date
    { wch: 20 }, // Beneficiary
    { wch: 30 }, // Purpose
    { wch: 15 }, // Amount
    { wch: 12 }, // Status
    { wch: 15 }, // Entered By
  ];

  // Add site info at the top
  worksheet['A1'] = { t: 's', v: `Site: ${site.name}${site.code ? ` (${site.code})` : ''}` };
  if (site.location) {
    worksheet['A2'] = { t: 's', v: `Location: ${site.location}` };
  }

  const dateRangeText =
    dateFilter === 'all'
      ? 'Period: All Time'
      : dateFilter === 'week'
        ? 'Period: This Week'
        : dateFilter === 'month'
          ? 'Period: This Month'
          : `Period: ${customStartDate} to ${customEndDate}`;
  worksheet['A3'] = { t: 's', v: dateRangeText };
  worksheet['A4'] = { t: 's', v: `Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}` };

  // Add to workbook
  utils.book_append_sheet(workbook, worksheet, 'Site Expenses');

  // Save file
  const fileName = `SiteExpenses_${site.code || site.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  writeFile(workbook, fileName);
}
