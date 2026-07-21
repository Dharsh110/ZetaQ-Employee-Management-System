import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ApiPayroll } from '@/store/api/payrollApi';

const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export interface PayrollRow {
  id: string;
  name: string;
  code: string;
  dept: string;
  basic: number;
  hra: number;
  allowance: number;
  deduction: number;
  net: number;
  month: string;
  year: number;
  status: ApiPayroll['status'];
  paidOn: string;
}

export function mapApiPayrollToRow(p: ApiPayroll): PayrollRow {
  const emp = p.employee && typeof p.employee === 'object' ? p.employee : null;
  return {
    id: p._id,
    name: emp ? `${emp.firstName} ${emp.lastName}` : p.employeeName || 'Unknown',
    code: emp?.employeeCode || p.employeeCode || '',
    dept: emp?.department ? (typeof emp.department === 'object' ? emp.department.name : emp.department) : p.department || '',
    basic: p.basicSalary || 0,
    hra: p.allowances?.hra || 0,
    allowance: (p.allowances?.transport || 0) + (p.allowances?.medical || 0) + (p.allowances?.other || 0),
    deduction: p.totalDeductions || 0,
    net: p.netSalary || 0,
    month: MOS[p.month - 1] || '',
    year: p.year,
    status: p.status,
    paidOn: p.paidAt?.slice(0, 10) || '',
  };
}

const S_VARIANT: Record<ApiPayroll['status'], 'success' | 'warning' | 'destructive' | 'gray'> = {
  paid: 'success', processed: 'warning', pending: 'destructive', failed: 'gray',
};

interface ColumnActions { onMarkPaid: (row: PayrollRow) => void }

export function buildPayrollColumns({ onMarkPaid }: ColumnActions): ColumnDef<PayrollRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Employee',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">{row.original.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.original.name}</span>
        </div>
      ),
      enableHiding: false,
    },
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="text-xs font-mono text-gray-500">{row.original.code}</span> },
    { accessorKey: 'dept', header: 'Department', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.dept}</span> },
    { accessorKey: 'basic', header: 'Basic', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(row.original.basic)}</span> },
    { accessorKey: 'hra', header: 'HRA', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(row.original.hra)}</span> },
    { accessorKey: 'allowance', header: 'Allowance', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(row.original.allowance)}</span> },
    { accessorKey: 'deduction', header: 'Deduction', cell: ({ row }) => <span className="text-xs text-red-500 dark:text-red-400 whitespace-nowrap">-{fmt(row.original.deduction)}</span> },
    { accessorKey: 'net', header: 'Net Pay', cell: ({ row }) => <span className="text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap">{fmt(row.original.net)}</span> },
    { accessorKey: 'month', header: 'Period', cell: ({ row }) => <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.original.month} {row.original.year}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={S_VARIANT[row.original.status]} className="capitalize">{row.original.status}</Badge> },
    { accessorKey: 'paidOn', header: 'Paid On', cell: ({ row }) => <span className="text-xs text-gray-400 whitespace-nowrap">{row.original.paidOn || '—'}</span> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => row.original.status !== 'paid'
        ? <Button size="sm" variant="ghost" className="h-auto py-1 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100" onClick={() => onMarkPaid(row.original)}>Mark Paid</Button>
        : <span className="text-[10px] text-gray-400">✓ Done</span>,
    },
  ];
}
