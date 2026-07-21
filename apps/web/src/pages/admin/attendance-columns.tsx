import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { ApiAttendance } from '@/store/api/attendanceApi';

export type AttStatus = 'Present' | 'Late' | 'Absent' | 'Half Day' | 'Holiday';

export interface AttendanceRow {
  id: string;
  name: string;
  code: string;
  dept: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  officialHours: string;
  status: AttStatus;
  // `isLate` is an independent flag on top of `status` — a late arrival is
  // still Present, not a separate exclusive bucket (see admin/Attendance.tsx).
  isLate: boolean;
}

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');
const fmtHours = (h?: number) => (h ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : '—');
const fmtOfficialMinutes = (m?: number | null) => (m ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : '—');

export function mapApiAttendanceToRow(r: ApiAttendance): AttendanceRow {
  const emp = typeof r.employee === 'object' ? r.employee : null;
  return {
    id: r._id,
    name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
    code: emp?.employeeCode || '',
    dept: emp?.department ? (typeof emp.department === 'object' ? emp.department.name : emp.department) : '',
    date: r.date?.slice(0, 10) || '',
    checkIn: fmtTime(r.checkIn),
    checkOut: fmtTime(r.checkOut),
    hours: fmtHours(r.totalHours),
    // Sourced only from the approved timesheet for this employee+date — distinct
    // from clock-based "hours" above, per the attendance/timesheet spec.
    officialHours: fmtOfficialMinutes(r.officialWorkMinutes),
    status: (r.status === 'present' ? 'Present' : r.status === 'absent' ? 'Absent' : r.status === 'holiday' ? 'Holiday' : 'Half Day') as AttStatus,
    isLate: !!r.isLate,
  };
}

const STATUS_VARIANT: Record<AttStatus, 'success' | 'warning' | 'destructive' | 'default' | 'outline'> = {
  Present: 'success',
  Late: 'warning',
  Absent: 'destructive',
  'Half Day': 'default',
  Holiday: 'outline',
};

export const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  {
    accessorKey: 'name',
    header: 'Employee',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="w-7 h-7"><AvatarFallback className="rounded-full bg-gradient-to-br from-purple-400 to-purple-600">{initials(row.original.name)}</AvatarFallback></Avatar>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.original.name}</span>
      </div>
    ),
    enableHiding: false,
  },
  { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="text-xs font-mono text-gray-500">{row.original.code}</span> },
  { accessorKey: 'dept', header: 'Department', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.dept}</span> },
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-gray-500 whitespace-nowrap">{row.original.date}</span> },
  {
    accessorKey: 'checkIn',
    header: 'Check In',
    cell: ({ row }) => row.original.checkIn
      ? <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg whitespace-nowrap">{row.original.checkIn}</span>
      : <span className="text-xs text-gray-400">—</span>,
  },
  {
    accessorKey: 'checkOut',
    header: 'Check Out',
    cell: ({ row }) => row.original.checkOut
      ? <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg whitespace-nowrap">{row.original.checkOut}</span>
      : <span className="text-xs text-gray-400 italic">{row.original.status === 'Absent' ? '—' : 'In progress'}</span>,
  },
  { accessorKey: 'hours', header: 'Hours', cell: ({ row }) => <span className={'text-xs font-bold ' + (row.original.hours === '—' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300')}>{row.original.hours}</span> },
  {
    accessorKey: 'officialHours',
    header: 'Official Hours',
    cell: ({ row }) => (
      <span
        className={'text-xs font-bold px-2 py-0.5 rounded-lg ' + (row.original.officialHours === '—' ? 'text-gray-400' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20')}
        title="From the approved timesheet for this date — separate from clock-in/out hours"
      >
        {row.original.officialHours}
      </span>
    ),
  },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ row }) => row.original.isLate
      ? <Badge variant="warning">Late</Badge>
      : <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
  },
];
