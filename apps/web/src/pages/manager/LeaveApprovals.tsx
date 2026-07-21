import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useGetLeavesQuery, useGetMyLeavesQuery, useApplyLeaveMutation, useUpdateLeaveStatusMutation, useCancelLeaveMutation } from '../../store/api/leavesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { mapApiLeaveToRow, type LeaveRow } from '../admin/leaves-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import { computeLeaveBalance } from '../../lib/leave-constants';

const todayStr = new Date().toISOString().slice(0, 10);
const LEAVE_TYPES: Record<string, string> = { 'Casual Leave': 'casual', 'Sick Leave': 'sick', 'Earned Leave': 'earned', 'Maternity Leave': 'maternity', 'Paternity Leave': 'paternity', 'Half Day': 'half_day', 'Unpaid Leave': 'unpaid' };
const STATUS_VARIANT: Record<LeaveRow['status'], 'warning' | 'success' | 'destructive' | 'gray'> = { pending: 'warning', approved: 'success', rejected: 'destructive', cancelled: 'gray' };
const diffDays = (from: string, to: string) => Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1);
type PageTab = 'approvals' | 'my-leaves';

export default function ManagerLeaveApprovals() {
  const { user } = useAuth();
  const mgrDept = (user as any)?.department || '';

  const [pageTab, setPageTab] = useState<PageTab>('approvals');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!mgrDept });
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const empNames = useMemo(() => {
    const effDept = mgrDept || deptF;
    return Array.from(new Set(apiEmployees.filter((e) => !effDept || (typeof e.department === 'object' ? e.department?.name : e.department) === effDept).map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b));
  }, [apiEmployees, mgrDept, deptF]);
  const { data: apiTeamLeaves = [], isLoading: teamLoading } = useGetLeavesQuery({ department: mgrDept || deptF });
  const { data: apiMyLeaves = [], isLoading: myLoading } = useGetMyLeavesQuery();
  const [updateStatus] = useUpdateLeaveStatusMutation();
  const [cancelLeave] = useCancelLeaveMutation();
  const [applyLeave] = useApplyLeaveMutation();

  const teamLeaves = useMemo(() => apiTeamLeaves.map(mapApiLeaveToRow), [apiTeamLeaves]);
  const myLeaves = useMemo(() => apiMyLeaves.map(mapApiLeaveToRow), [apiMyLeaves]);
  const myLeaveBalance = useMemo(() => computeLeaveBalance(myLeaves), [myLeaves]);

  const [statusF, setStatusF] = useState<LeaveRow['status'] | ''>('');
  const [myStatusF, setMyStatusF] = useState<LeaveRow['status'] | ''>('');
  const [viewL, setViewL] = useState<LeaveRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LeaveRow | null>(null);
  const [form, setForm] = useState({ leaveType: 'Casual Leave', from: todayStr, to: todayStr, reason: '' });

  const filtered = teamLeaves.filter((l) => (!statusF || l.status === statusF) && (!empF || l.name === empF));
  const myFiltered = myStatusF ? myLeaves.filter((l) => l.status === myStatusF) : myLeaves;

  const counts = { '': teamLeaves.length, pending: teamLeaves.filter((l) => l.status === 'pending').length, approved: teamLeaves.filter((l) => l.status === 'approved').length, rejected: teamLeaves.filter((l) => l.status === 'rejected').length, cancelled: teamLeaves.filter((l) => l.status === 'cancelled').length };
  const myCounts = { '': myLeaves.length, pending: myLeaves.filter((l) => l.status === 'pending').length, approved: myLeaves.filter((l) => l.status === 'approved').length, rejected: myLeaves.filter((l) => l.status === 'rejected').length, cancelled: myLeaves.filter((l) => l.status === 'cancelled').length };

  const approve = async (l: LeaveRow) => { try { await updateStatus({ id: l.id, status: 'approved' }).unwrap(); toast.success('Leave approved'); } catch { toast.error('Failed to approve'); } };
  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Please enter a reason'); return; }
    try { await updateStatus({ id: rejectTarget.id, status: 'rejected', reason: rejectReason.trim() }).unwrap(); toast.success('Leave rejected'); }
    catch { toast.error('Failed to reject'); }
    setRejectTarget(null); setRejectReason('');
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try { await cancelLeave(cancelTarget.id).unwrap(); toast.success('Leave cancelled'); }
    catch { toast.error('Failed to cancel'); }
    setCancelTarget(null);
  };

  const submitMyLeave = async () => {
    if (!form.reason.trim()) { toast.error('Please enter a reason'); return; }
    if (form.to < form.from) { toast.error('End date must be after start date'); return; }
    try {
      await applyLeave({ leaveType: LEAVE_TYPES[form.leaveType] || 'casual', fromDate: form.from, toDate: form.to, totalDays: diffDays(form.from, form.to), reason: form.reason.trim() }).unwrap();
      toast.success('Leave request submitted');
      setForm({ leaveType: 'Casual Leave', from: todayStr, to: todayStr, reason: '' });
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to submit leave');
    }
  };

  const teamColumns: ColumnDef<LeaveRow>[] = [
    { accessorKey: 'name', header: 'Employee', cell: ({ row }) => (
      <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{row.original.name}</p><p className="text-[10px] text-gray-400">{row.original.dept}</p></div>
    ), enableHiding: false },
    { accessorKey: 'type', header: 'Leave Type', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300">{row.original.type}</span> },
    { accessorKey: 'from', header: 'Duration', cell: ({ row }) => <div><p className="text-xs text-gray-700 dark:text-gray-300">{row.original.from}</p><p className="text-[10px] text-gray-400">to {row.original.to}</p></div> },
    { accessorKey: 'days', header: 'Days', cell: ({ row }) => <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{row.original.days}d</span> },
    { accessorKey: 'applied', header: 'Applied On', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.applied}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]} className="capitalize">{row.original.status}</Badge> },
    {
      id: 'actions', enableHiding: false,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewL(l)}>View</Button>
            {l.status === 'pending' && <>
              <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-emerald-50 text-emerald-600" onClick={() => approve(l)}>Approve</Button>
              <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-red-50 text-red-500" onClick={() => { setRejectTarget(l); setRejectReason(''); }}>Reject</Button>
            </>}
            {(l.status === 'pending' || l.status === 'approved') && <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px]" onClick={() => setCancelTarget(l)}>Cancel</Button>}
          </div>
        );
      },
    },
  ];

  const myColumns: ColumnDef<LeaveRow>[] = [
    { accessorKey: 'type', header: 'Leave Type', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{row.original.type}</span>, enableHiding: false },
    { accessorKey: 'from', header: 'Duration', cell: ({ row }) => <div><p className="text-xs text-gray-700 dark:text-gray-300">{row.original.from}</p><p className="text-[10px] text-gray-400">to {row.original.to}</p></div> },
    { accessorKey: 'days', header: 'Days', cell: ({ row }) => <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{row.original.days}d</span> },
    { accessorKey: 'applied', header: 'Applied On', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.applied}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]} className="capitalize">{row.original.status}</Badge> },
    {
      id: 'actions', enableHiding: false,
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewL(row.original)}>View</Button>
          {(row.original.status === 'pending' || row.original.status === 'approved') && <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px]" onClick={() => setCancelTarget(row.original)}>Cancel</Button>}
        </div>
      ),
    },
  ];

  const StatusCards = ({ c, active, onSelect }: { c: Record<string, number>; active: string; onSelect: (v: any) => void }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
      {[{ k: 'pending', l: 'Pending', c: 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' }, { k: 'approved', l: 'Approved', c: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' }, { k: 'rejected', l: 'Rejected', c: 'bg-red-50 dark:bg-red-900/10 text-red-500' }, { k: 'cancelled', l: 'Cancelled', c: 'bg-gray-50 dark:bg-gray-700/30 text-gray-500' }].map((s) => (
        <button key={s.k} onClick={() => onSelect(s.k)} className={`border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-left hover:scale-105 transition-all ${s.c} ${active === s.k ? 'ring-2 ring-blue-500' : ''}`}>
          <p className="text-2xl font-bold">{c[s.k] ?? 0}</p>
          <p className="text-xs font-semibold mt-0.5">{s.l}</p>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex gap-2">
          <Button variant={pageTab === 'approvals' ? 'default' : 'secondary'} onClick={() => setPageTab('approvals')}>✅ Team Leave Approvals</Button>
          <Button variant={pageTab === 'my-leaves' ? 'default' : 'secondary'} onClick={() => setPageTab('my-leaves')}>📝 My Leave Requests</Button>
        </div>
      </div>

      {pageTab === 'approvals' && (
        <>
          <StatusCards c={counts} active={statusF} onSelect={setStatusF} />
          <div className="flex items-center gap-2">
            <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v as LeaveRow['status'])}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{['pending', 'approved', 'rejected', 'cancelled'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
            {!mgrDept && (
              <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-gray-400">{filtered.length} request{filtered.length !== 1 ? 's' : ''}{mgrDept ? ` · ${mgrDept} dept` : deptF ? ` · ${deptF} dept` : ' · All Departments'}</span>
          </div>
          <DataTable columns={teamColumns} data={filtered} isLoading={teamLoading} emptyMessage="No leave requests found" />
        </>
      )}

      {pageTab === 'my-leaves' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {myLeaveBalance.slice(0, 4).map((b) => {
              const rem = Math.max(b.total - b.used, 0);
              const pct = Math.round((b.used / b.total) * 100);
              return (
                <div key={b.type} className={`border rounded-2xl p-3.5 ${b.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{b.icon}</span>
                    <span className={`text-xs font-bold ${b.txt}`}>{rem}/{b.total}</span>
                  </div>
                  <p className={`text-[10px] font-semibold ${b.txt} leading-tight`}>{b.type}</p>
                  <div className="mt-2 h-1.5 bg-white/50 dark:bg-gray-600/50 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${b.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-gray-400">{b.used} used</span>
                    <span className={`text-[9px] font-semibold ${b.txt}`}>{rem} left</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-3">
            <StatusCards c={myCounts} active={myStatusF} onSelect={setMyStatusF} />
            <Button onClick={() => setShowForm(true)} className="mt-0.5">+ Apply Leave</Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={myStatusF || 'all'} onValueChange={(v: string) => setMyStatusF(v === 'all' ? '' : v as LeaveRow['status'])}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{['pending', 'approved', 'rejected', 'cancelled'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-gray-400">{myFiltered.length} request{myFiltered.length !== 1 ? 's' : ''}</span>
          </div>
          <DataTable columns={myColumns} data={myFiltered} isLoading={myLoading} emptyMessage="No leave requests found" />
        </>
      )}

      {/* View leave details */}
      <Dialog open={!!viewL} onOpenChange={(o: boolean) => !o && setViewL(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Leave Request</DialogTitle></DialogHeader>
          {viewL && (
            <>
              <DialogBody>
                {([['Employee', viewL.name], ['Leave Type', viewL.type], ['From', viewL.from], ['To', viewL.to], ['Days', `${viewL.days} day${viewL.days !== 1 ? 's' : ''}`], ['Applied On', viewL.applied], ['Status', viewL.status]] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs border-b border-gray-50 dark:border-gray-700/50 pb-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">{v}</span>
                  </div>
                ))}
                <div><p className="text-[10px] text-gray-400 uppercase mb-1">Reason</p><p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">{viewL.reason}</p></div>
                {viewL.rejectionReason && <div><p className="text-[10px] text-gray-400 uppercase mb-1">Reject Reason</p><p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{viewL.rejectionReason}</p></div>}
              </DialogBody>
              <DialogFooter className="flex-col">
                {viewL.status === 'pending' && pageTab === 'approvals' && <>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => { approve(viewL); setViewL(null); }}>Approve</Button>
                  <Button className="w-full bg-red-500 hover:bg-red-600" onClick={() => { setViewL(null); setRejectTarget(viewL); setRejectReason(''); }}>Reject</Button>
                </>}
                {(viewL.status === 'pending' || viewL.status === 'approved') && <Button variant="outline" className="w-full" onClick={() => { setCancelTarget(viewL); setViewL(null); }}>Cancel Leave</Button>}
                <Button variant="outline" className="w-full" onClick={() => setViewL(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(o: boolean) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
          <DialogBody>
            <Label>Reason for Rejection *</Label>
            <Textarea className="mt-1" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain reason for rejection…" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply leave */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <DialogBody>
            <div>
              <Label>Leave Type *</Label>
              <Select value={form.leaveType} onValueChange={(v: string) => setForm((f) => ({ ...f, leaveType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(LEAVE_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From *</Label><input type="date" value={form.from} min={todayStr} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to }))} className="mt-1 w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></div>
              <div><Label>To *</Label><input type="date" value={form.to} min={form.from} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} className="mt-1 w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl px-4 py-2">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Duration: {diffDays(form.from, form.to)} day{diffDays(form.from, form.to) !== 1 ? 's' : ''}</p>
            </div>
            <div><Label>Reason *</Label><Textarea className="mt-1" rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Describe the reason for leave…" /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submitMyLeave}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o: boolean) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">⚠️</span>
            <AlertDialogTitle>Cancel Leave Request?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Yes, Cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
