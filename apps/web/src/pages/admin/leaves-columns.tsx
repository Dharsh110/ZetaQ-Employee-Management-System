import { type ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ApiLeave } from '@/store/api/leavesApi';

export interface LeaveRow {
  id: string;
  name: string;
  dept: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  applied: string;
  status: ApiLeave['status'];
  rejectionReason?: string;
}

const TYPE_LABEL: Record<string, string> = {
  casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
  maternity: 'Maternity Leave', paternity: 'Paternity Leave', half_day: 'Half Day', unpaid: 'Unpaid Leave',
};
const TC: Record<string, string> = {
  'Sick Leave': 'bg-orange-100 text-orange-600', 'Casual Leave': 'bg-blue-100 text-blue-600', 'Earned Leave': 'bg-purple-100 text-purple-600',
  'Maternity Leave': 'bg-pink-100 text-pink-600', 'Paternity Leave': 'bg-indigo-100 text-indigo-600', 'Half Day': 'bg-teal-100 text-teal-600', 'Unpaid Leave': 'bg-gray-200 text-gray-700',
};
const STATUS_VARIANT: Record<ApiLeave['status'], 'warning' | 'success' | 'destructive' | 'gray'> = {
  pending: 'warning', approved: 'success', rejected: 'destructive', cancelled: 'gray',
};

export function mapApiLeaveToRow(l: ApiLeave): LeaveRow {
  const emp = typeof l.employee === 'object' ? l.employee : null;
  return {
    id: l._id,
    name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
    dept: emp?.department ? (typeof emp.department === 'object' ? emp.department.name : emp.department) : '',
    type: TYPE_LABEL[l.leaveType] || l.leaveType,
    from: l.fromDate?.slice(0, 10),
    to: l.toDate?.slice(0, 10),
    days: l.totalDays,
    reason: l.reason || '',
    applied: l.appliedAt?.slice(0, 10) || '',
    status: l.status,
    rejectionReason: l.rejectionReason,
  };
}

interface ColumnActions {
  onApprove: (row: LeaveRow) => void;
  onReject: (row: LeaveRow) => void;
  onRevoke: (row: LeaveRow) => void;
}

export function buildLeaveColumns({ onApprove, onReject, onRevoke }: ColumnActions): ColumnDef<LeaveRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Employee',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            {row.original.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.original.name}</span>
        </div>
      ),
      enableHiding: false,
    },
    { accessorKey: 'dept', header: 'Dept', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.dept}</span> },
    { accessorKey: 'type', header: 'Leave Type', cell: ({ row }) => <span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ' + (TC[row.original.type] || 'bg-gray-100 text-gray-600')}>{row.original.type}</span> },
    { accessorKey: 'from', header: 'From', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.from}</span> },
    { accessorKey: 'to', header: 'To', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.to}</span> },
    { accessorKey: 'days', header: 'Days', cell: ({ row }) => <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{row.original.days}</span> },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs text-gray-500 max-w-[140px] truncate block" title={row.original.reason}>{row.original.reason}</span> },
    { accessorKey: 'applied', header: 'Applied', cell: ({ row }) => <span className="text-xs text-gray-400 whitespace-nowrap">{row.original.applied}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]} className="capitalize">{row.original.status}</Badge> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const l = row.original;
        if (l.status === 'pending') return (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6 bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Approve" onClick={() => onApprove(l)}><Check className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 bg-red-50 text-red-500 hover:bg-red-100" title="Reject" onClick={() => onReject(l)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        );
        if (l.status === 'approved') return <Button size="sm" variant="ghost" className="h-auto py-0.5 text-[10px] bg-red-50 text-red-500 hover:bg-red-100" onClick={() => onRevoke(l)}>Revoke</Button>;
        if (l.status === 'rejected') return <Button size="sm" variant="ghost" className="h-auto py-0.5 text-[10px] bg-emerald-50 text-emerald-600 hover:bg-emerald-100" onClick={() => onApprove(l)}>Re-approve</Button>;
        return <span className="text-[10px] text-gray-400 italic">Cancelled</span>;
      },
    },
  ];
}
