import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  useGetAllTimesheetsQuery, useApproveTimesheetMutation, useRejectTimesheetMutation,
  type ApiTimesheet, type TimesheetStatus,
} from '../../store/api/timesheetsApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const STATUS_LABEL: Record<TimesheetStatus, string> = { draft: 'Draft', pending_approval: 'Pending Approval', approved: 'Approved', rejected: 'Rejected' };
const STATUS_VARIANT: Record<TimesheetStatus, 'gray' | 'warning' | 'success' | 'destructive'> = { draft: 'gray', pending_approval: 'warning', approved: 'success', rejected: 'destructive' };
const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
const empName = (t: ApiTimesheet) => (typeof t.employee === 'object' ? `${t.employee.firstName} ${t.employee.lastName}` : 'Employee');
const empCode = (t: ApiTimesheet) => (typeof t.employee === 'object' ? t.employee.employeeCode || '' : '');
const empDept = (t: ApiTimesheet) => (typeof t.employee === 'object' && t.employee.department && typeof t.employee.department === 'object' ? t.employee.department.name : '');
const deptOf = (e: { department?: { name: string } | string }) => (typeof e.department === 'object' ? e.department?.name : e.department) || '';
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);

export default function ManagerTimesheetApprovals() {
  const { user } = useAuth();
  const mgrDept = (user as any)?.department || '';

  const [statusF, setStatusF] = useState<TimesheetStatus | ''>('pending_approval');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [yearF, setYearF] = useState('');
  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!mgrDept });
  const DEPTS = apiDepartments.map((d) => d.name);
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const effDept = mgrDept || deptF;
  const empOptions = useMemo(() => apiEmployees.filter((e) => !effDept || deptOf(e) === effDept), [apiEmployees, effDept]);

  const rangeFrom = yearF ? `${yearF}-01-01` : from || undefined;
  const rangeTo = yearF ? `${yearF}-12-31` : to || undefined;
  // Fetched WITHOUT a status filter so the summary cards below always reflect the true
  // counts across every status — the status filter is applied client-side to the rows
  // instead, otherwise a card's own count would collapse to 0 once its status was selected
  // (the query would already be scoped to just that one status).
  const { data: allTimesheets = [], isLoading } = useGetAllTimesheetsQuery({ department: mgrDept || deptF, employeeId: empF || undefined, from: rangeFrom, to: rangeTo });
  const [approveTimesheet] = useApproveTimesheetMutation();
  const [rejectTimesheet] = useRejectTimesheetMutation();

  const [viewT, setViewT] = useState<ApiTimesheet | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApiTimesheet | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const rows = useMemo(
    () => [...allTimesheets].filter((t) => !statusF || t.status === statusF).sort((a, b) => b.date.localeCompare(a.date)),
    [allTimesheets, statusF]
  );
  const counts = {
    pending_approval: allTimesheets.filter((t) => t.status === 'pending_approval').length,
    approved: allTimesheets.filter((t) => t.status === 'approved').length,
    rejected: allTimesheets.filter((t) => t.status === 'rejected').length,
  };

  const approve = async (t: ApiTimesheet) => {
    try { await approveTimesheet(t._id).unwrap(); toast.success(`${empName(t)}'s timesheet approved`); }
    catch (err: any) { toast.error(err?.data?.message || 'Failed to approve'); }
  };
  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Please enter a reason'); return; }
    try { await rejectTimesheet({ id: rejectTarget._id, reason: rejectReason.trim() }).unwrap(); toast.success('Timesheet rejected'); }
    catch (err: any) { toast.error(err?.data?.message || 'Failed to reject'); }
    setRejectTarget(null); setRejectReason('');
  };

  const columns: ColumnDef<ApiTimesheet>[] = [
    { accessorKey: 'employee', header: 'Employee', cell: ({ row }) => (
      <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{empName(row.original)}</p><p className="text-[10px] text-gray-400">{empCode(row.original)} · {empDept(row.original)}</p></div>
    ), enableHiding: false },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300">{row.original.date.slice(0, 10)}</span> },
    { accessorKey: 'entries', header: 'Tasks', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300">{row.original.entries.length}</span> },
    { accessorKey: 'totalMinutes', header: 'Hours', cell: ({ row }) => <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmtMinutes(row.original.totalMinutes)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    {
      id: 'actions', enableHiding: false,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewT(t)}>View</Button>
            {t.status === 'pending_approval' && <>
              <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-emerald-50 text-emerald-600" onClick={() => approve(t)}>Approve</Button>
              <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-red-50 text-red-500" onClick={() => { setRejectTarget(t); setRejectReason(''); }}>Reject</Button>
            </>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setStatusF('')} className={`border rounded-2xl p-4 text-left transition-all ${statusF === '' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className="text-2xl font-bold text-blue-600">{allTimesheets.length}</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Total</p>
        </button>
        <button onClick={() => setStatusF('pending_approval')} className={`border rounded-2xl p-4 text-left transition-all ${statusF === 'pending_approval' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className="text-2xl font-bold text-amber-600">{counts.pending_approval}</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Pending Approval</p>
        </button>
        <button onClick={() => setStatusF('approved')} className={`border rounded-2xl p-4 text-left transition-all ${statusF === 'approved' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className="text-2xl font-bold text-emerald-600">{counts.approved}</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Approved</p>
        </button>
        <button onClick={() => setStatusF('rejected')} className={`border rounded-2xl p-4 text-left transition-all ${statusF === 'rejected' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className="text-2xl font-bold text-red-500">{counts.rejected}</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Rejected</p>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v as TimesheetStatus)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {!mgrDept && (
          <Select value={deptF || 'all'} onValueChange={(v: string) => { setDeptF(v === 'all' ? '' : v); setEmpF(''); }}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {empOptions.map((e) => <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setYearF(''); }} className="h-8 w-36 text-xs" placeholder="From" />
        <Input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setYearF(''); }} className="h-8 w-36 text-xs" placeholder="To" />
        <Select value={yearF || 'all'} onValueChange={(v: string) => { setYearF(v === 'all' ? '' : v); if (v !== 'all') { setFrom(''); setTo(''); } }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Year</SelectItem>
            {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {(from || to || yearF) && <button onClick={() => { setFrom(''); setTo(''); setYearF(''); }} className="text-[10px] text-blue-500 hover:underline whitespace-nowrap">Clear dates</button>}
        <span className="text-xs text-gray-400 ml-1">{rows.length} timesheet{rows.length !== 1 ? 's' : ''}</span>
      </div>

      <DataTable columns={columns} data={rows} isLoading={isLoading} emptyMessage="No timesheets found" />

      {/* View entries */}
      <Dialog open={!!viewT} onOpenChange={(o: boolean) => !o && setViewT(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewT ? empName(viewT) : ''} — {viewT?.date.slice(0, 10)}</DialogTitle></DialogHeader>
          {viewT && (
            <DialogBody>
              <div className="space-y-2">
                {viewT.entries.map((e, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Task / Project</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.task}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Time Spent</p>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmtMinutes(e.timeSpentMinutes)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Description</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">{e.description || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Remarks</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 italic">{e.remarks || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
              {viewT.rejectionReason && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Rejection reason</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{viewT.rejectionReason}</p>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Audit Trail</p>
                <div className="space-y-1">
                  {viewT.auditTrail.map((a, i) => (
                    <p key={i} className="text-[10px] text-gray-400">
                      <span className="font-semibold text-gray-600 dark:text-gray-300 capitalize">{a.action}</span> — {new Date(a.at).toLocaleString('en-IN')}{a.note ? ` — ${a.note}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setViewT(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with mandatory reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(o: boolean) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Timesheet</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Rejecting {rejectTarget ? empName(rejectTarget) : ''}'s timesheet for {rejectTarget?.date.slice(0, 10)}. A reason is required — the employee will see it and can resubmit.
            </p>
            <Label>Reason *</Label>
            <Textarea className="mt-1" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Please add more detail on which tasks were completed" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={!rejectReason.trim()} onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
