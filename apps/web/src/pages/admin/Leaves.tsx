import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetLeavesQuery, useUpdateLeaveStatusMutation } from '../../store/api/leavesApi';
import { mapApiLeaveToRow, buildLeaveColumns, type LeaveRow } from './leaves-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

type LS = 'pending' | 'approved' | 'rejected' | 'cancelled';
const TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Half Day', 'Unpaid Leave'];

export default function AdminLeaves() {
  const { data: apiLeaves = [], isLoading } = useGetLeavesQuery();
  const [updateStatus] = useUpdateLeaveStatusMutation();

  const [mainTab, setMainTab] = useState<'active' | 'archived'>('active');
  const [statusF, setStatusF] = useState<'all' | LS>('all');
  const [typeF, setTypeF] = useState('');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');

  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const deptNames = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees]);

  const leaves = useMemo(() => apiLeaves.map(mapApiLeaveToRow), [apiLeaves]);

  const approve = async (row: LeaveRow) => {
    try { await updateStatus({ id: row.id, status: 'approved' }).unwrap(); toast.success('Leave approved!'); }
    catch { toast.error('Failed to approve'); }
  };
  const reject = async (row: LeaveRow) => {
    try { await updateStatus({ id: row.id, status: 'rejected', reason: 'Rejected by admin' }).unwrap(); toast.error('Leave rejected'); }
    catch { toast.error('Failed to reject'); }
  };
  const revoke = async (row: LeaveRow) => {
    try { await updateStatus({ id: row.id, status: 'rejected' }).unwrap(); toast('Leave revoked'); }
    catch { toast.error('Failed to revoke'); }
  };

  const activeLeaves = leaves.filter((l) => l.status === 'pending');
  const archivedLeaves = leaves.filter((l) => l.status !== 'pending');
  const tabLeaves = mainTab === 'active' ? activeLeaves : archivedLeaves;
  const counts = {
    all: tabLeaves.length,
    pending: tabLeaves.filter((l) => l.status === 'pending').length,
    approved: tabLeaves.filter((l) => l.status === 'approved').length,
    rejected: tabLeaves.filter((l) => l.status === 'rejected').length,
    cancelled: tabLeaves.filter((l) => l.status === 'cancelled').length,
  };
  const filtered = tabLeaves.filter((l) => (statusF === 'all' || l.status === statusF) && (!typeF || l.type === typeF) && (!deptF || l.dept === deptF) && (!empF || l.name === empF));

  const columns = useMemo(() => buildLeaveColumns({ onApprove: approve, onReject: reject, onRevoke: revoke }), []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mainTab === 'active' ? 'default' : 'outline'} onClick={() => { setMainTab('active'); setStatusF('all'); }}>
          Active <span className="ml-1 text-xs opacity-80">({activeLeaves.length})</span>
        </Button>
        <Button variant={mainTab === 'archived' ? 'default' : 'outline'} onClick={() => { setMainTab('archived'); setStatusF('all'); }}>
          Archived <span className="ml-1 text-xs opacity-80">({archivedLeaves.length})</span>
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {(mainTab === 'archived' ? (['all', 'approved', 'rejected', 'cancelled'] as const) : (['all'] as const)).map((s) => (
              <Button key={s} size="sm" variant={statusF === s ? 'default' : 'secondary'} onClick={() => setStatusF(s)} className="capitalize">
                {s === 'all' ? `All (${counts.all})` : `${s} (${counts[s]})`}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Depts" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Depts</SelectItem>{deptNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeF || 'all'} onValueChange={(v: string) => setTypeF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {statusF === 'cancelled' && (
        <div className="flex items-start gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-600 dark:text-gray-400">
          <span>i</span><p>Leaves cancelled by employees — shown for record-keeping only. No action needed.</p>
        </div>
      )}

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No leave requests found" />
    </div>
  );
}
