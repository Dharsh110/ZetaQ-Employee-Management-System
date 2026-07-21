import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ApiDepartment } from '@/store/api/departmentsApi';

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  Product: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  Design: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  HR: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  'Sales & Marketing': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  Finance: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  Support: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  Security: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

interface ColumnActions {
  onViewMembers: (dept: ApiDepartment) => void;
  onViewDetail: (dept: ApiDepartment) => void;
  onEdit: (dept: ApiDepartment) => void;
  onToggleStatus: (dept: ApiDepartment) => void;
  onDelete: (dept: ApiDepartment) => void;
}

export function buildDepartmentColumns({ onViewMembers, onViewDetail, onEdit, onToggleStatus, onDelete }: ColumnActions): ColumnDef<ApiDepartment>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Department',
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className={'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ' + (DEPT_COLORS[d.name] || 'bg-gray-100 text-gray-600')}>
              {d.code?.slice(0, 2) || d.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{d.name}</p>
              <p className="text-[10px] text-gray-400">{d.code}</p>
            </div>
          </div>
        );
      },
      enableHiding: false,
    },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.location || '—'}</span> },
    {
      accessorKey: 'head',
      header: 'Head',
      cell: ({ row }) => {
        const h = row.original.head;
        const label = h && typeof h === 'object' ? `${h.firstName} ${h.lastName}` : (h as string) || '—';
        return <span className="text-xs text-gray-500">{label}</span>;
      },
    },
    {
      accessorKey: 'employeeCount',
      header: 'Employees',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="h-auto py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-full hover:bg-indigo-100" onClick={() => onViewMembers(row.original)}>
          <Users className="w-3 h-3 mr-1" /> {row.original.employeeCount ?? 0}
        </Button>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'gray'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const dept = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetail(dept)}>View Employees</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(dept)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStatus(dept)}>{dept.isActive ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(dept)} className="text-red-500 focus:text-red-500">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
