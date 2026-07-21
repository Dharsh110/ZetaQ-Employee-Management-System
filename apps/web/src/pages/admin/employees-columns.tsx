import { type ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ApiEmployee } from '@/store/api/employeesApi';

export interface EmployeeRow {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  dept: string;
  designation: string;
  type: string;
  status: string;
  joined: string;
  salary: string;
  gender: string;
  avatar: string;
}

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

const typeFromApi: Record<string, string> = { full_time: 'Full-Time', part_time: 'Part-Time', contract: 'Contract', intern: 'Intern' };

export function mapApiEmployeeToRow(e: ApiEmployee): EmployeeRow {
  return {
    id: e._id,
    name: `${e.firstName} ${e.lastName}`,
    code: e.employeeCode,
    email: e.email || '',
    phone: e.phone || '',
    dept: typeof e.department === 'object' ? e.department?.name || '' : e.department || '',
    designation: e.designation || '',
    type: typeFromApi[e.employmentType] || 'Full-Time',
    status: e.status === 'active' ? 'Active' : 'Inactive',
    joined: e.joiningDate?.slice(0, 10) || '',
    salary: String(e.salary || ''),
    gender: e.gender || 'Male',
    avatar: e.avatar || '',
  };
}

interface ColumnActions {
  onView: (row: EmployeeRow) => void;
  onEdit: (row: EmployeeRow) => void;
  onToggleStatus: (row: EmployeeRow) => void;
  onDelete: (row: EmployeeRow) => void;
}

export function buildEmployeeColumns({ onView, onEdit, onToggleStatus, onDelete }: ColumnActions): ColumnDef<EmployeeRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v: boolean | 'indeterminate') => row.toggleSelected(!!v)} aria-label="Select row" />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'employee',
      header: 'Employee',
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar>
              {e.avatar ? <AvatarImage src={e.avatar} alt={e.name} /> : null}
              <AvatarFallback>{initials(e.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{e.email}</p>
            </div>
          </div>
        );
      },
      enableHiding: false,
    },
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Emp ID <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-xs font-mono text-gray-500">{row.original.code}</span>,
    },
    { accessorKey: 'dept', header: 'Dept', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.dept}</span> },
    { accessorKey: 'designation', header: 'Designation', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.designation}</span> },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.phone || '—'}</span> },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => <Badge variant="default">{row.original.type}</Badge> },
    {
      accessorKey: 'joined',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Joined <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-xs text-gray-400">{row.original.joined}</span>,
    },
    {
      accessorKey: 'salary',
      header: 'Salary',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {row.original.salary ? 'Rs.' + Number(row.original.salary).toLocaleString('en-IN') : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'Active' ? 'success' : 'gray'}>{row.original.status}</Badge>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(emp)}>View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(emp)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStatus(emp)}>
                {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(emp)} className="text-red-500 focus:text-red-500">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
