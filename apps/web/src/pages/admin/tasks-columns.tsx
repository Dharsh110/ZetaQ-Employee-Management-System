import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ApiTask } from '@/store/api/tasksApi';

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dept: string;
  status: ApiTask['status'];
  priority: ApiTask['priority'];
  due: string;
  created: string;
  progress: number;
  submittedDescription?: string;
  submittedFiles?: { name: string; size: number; type: string }[];
}

const PROGRESS_BY_STATUS: Record<ApiTask['status'], number> = { pending: 0, in_progress: 50, completed: 100, overdue: 0, cancelled: 0 };

export function mapApiTaskToRow(t: ApiTask): TaskRow {
  const assignee = typeof t.assignedTo === 'object' ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '';
  const assigneeDept = typeof t.assignedTo === 'object' && typeof t.assignedTo.department === 'object' ? t.assignedTo.department?.name : '';
  const dept = (typeof t.department === 'object' ? t.department?.name : '') || assigneeDept || '';
  return {
    id: t._id,
    title: t.title,
    description: t.description || '',
    assignee,
    dept,
    status: t.status,
    priority: t.priority,
    due: t.dueDate?.slice(0, 10) || '',
    created: t.createdAt?.slice(0, 10) || '',
    progress: PROGRESS_BY_STATUS[t.status],
    submittedDescription: t.submittedDescription,
    submittedFiles: t.submittedFiles,
  };
}

const S_VARIANT: Record<ApiTask['status'], 'warning' | 'default' | 'success' | 'destructive' | 'gray'> = {
  pending: 'warning', in_progress: 'default', completed: 'success', overdue: 'destructive', cancelled: 'gray',
};
const P_VARIANT: Record<ApiTask['priority'], 'gray' | 'default' | 'warning' | 'destructive'> = {
  low: 'gray', medium: 'default', high: 'warning', urgent: 'destructive',
};

interface ColumnActions { onStatusChange: (row: TaskRow, status: ApiTask['status']) => void }

export function buildTaskColumns({ onStatusChange }: ColumnActions): ColumnDef<TaskRow>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Task',
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{row.original.title}</p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{row.original.description}</p>
          {row.original.submittedDescription && (
            <p className="text-[10px] text-blue-500 dark:text-blue-400 truncate mt-0.5" title={row.original.submittedDescription}>📝 {row.original.submittedDescription}</p>
          )}
          {!!row.original.submittedFiles?.length && (
            <p className="text-[10px] text-gray-400 mt-0.5" title={row.original.submittedFiles.map((f) => f.name).join(', ')}>📎 {row.original.submittedFiles.length} file{row.original.submittedFiles.length > 1 ? 's' : ''} attached</p>
          )}
        </div>
      ),
      enableHiding: false,
    },
    { accessorKey: 'assignee', header: 'Assignee', cell: ({ row }) => <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.original.assignee}</span> },
    { accessorKey: 'dept', header: 'Department', cell: ({ row }) => <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full font-medium whitespace-nowrap">{row.original.dept}</span> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={P_VARIANT[row.original.priority]} className="capitalize">{row.original.priority}</Badge> },
    { accessorKey: 'due', header: 'Due Date', cell: ({ row }) => <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.original.due}</span> },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 w-24">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={'h-full rounded-full transition-all ' + (row.original.progress >= 100 ? 'bg-emerald-500' : row.original.progress >= 60 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: `${row.original.progress}%` }} />
          </div>
          <span className="text-[10px] text-gray-500 w-7 text-right">{row.original.progress}%</span>
        </div>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={S_VARIANT[row.original.status]} className="capitalize">{row.original.status.replace('_', ' ')}</Badge> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex items-center gap-1">
            {t.status !== 'completed' && <Button size="sm" variant="ghost" className="h-auto py-0.5 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100" onClick={() => onStatusChange(t, 'completed')}>Complete</Button>}
            {t.status === 'pending' && <Button size="sm" variant="ghost" className="h-auto py-0.5 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100" onClick={() => onStatusChange(t, 'in_progress')}>Start</Button>}
            {t.status !== 'cancelled' && t.status !== 'completed' && <Button size="icon" variant="ghost" className="h-6 w-6 bg-gray-50 dark:bg-gray-700 text-gray-500" onClick={() => onStatusChange(t, 'cancelled')}>✕</Button>}
          </div>
        );
      },
    },
  ];
}
