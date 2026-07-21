import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetMyLeavesQuery, useApplyLeaveMutation, useCancelLeaveMutation } from '../../store/api/leavesApi';
import { computeLeaveBalance } from '../../lib/leave-constants';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Emergency', 'Compensatory Leave'];
const LEAVE_TYPE_MAP: Record<string, string> = {
  'Casual Leave': 'casual', 'Sick Leave': 'sick', 'Earned Leave': 'earned',
  'Maternity Leave': 'maternity', 'Paternity Leave': 'paternity', 'Emergency': 'casual', 'Compensatory Leave': 'earned',
};
const TYPE_DISPLAY: Record<string, string> = {
  casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave', maternity: 'Maternity Leave', paternity: 'Paternity Leave', half_day: 'Half Day', unpaid: 'Unpaid',
};
const S_CLR: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
};

const BLANK = { type: 'Casual Leave', from: '', to: '', reason: '' };

export default function MyLeaves() {
  const { data: apiLeaves } = useGetMyLeavesQuery();
  const [applyLeave, { isLoading: applying }] = useApplyLeaveMutation();
  const [cancelLeave] = useCancelLeaveMutation();

  const [statusF, setStatusF] = useState<'all' | LeaveStatus>('all');
  const [selMonth, setSelMonth] = useState<number | ''>('');
  const [selYear, setSelYear] = useState<number | ''>('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);

  const leaves = useMemo(() => (apiLeaves || []).map((l) => ({
    id: l._id, type: TYPE_DISPLAY[l.leaveType] || l.leaveType, from: l.fromDate?.slice(0, 10), to: l.toDate?.slice(0, 10),
    days: l.totalDays, reason: l.reason, applied: l.appliedAt?.slice(0, 10) || '', status: l.status as LeaveStatus,
  })), [apiLeaves]);

  const daysCalc = useMemo(() => {
    if (!form.from || !form.to) return 0;
    const from = new Date(form.from), to = new Date(form.to);
    if (to < from) return 0;
    return Math.ceil((to.getTime() - from.getTime()) / 864e5) + 1;
  }, [form.from, form.to]);

  const filtered = leaves.filter((l) => {
    const matchSt = statusF === 'all' || l.status === statusF;
    const d = new Date(l.applied);
    const matchM = selMonth === '' || d.getMonth() === selMonth;
    const matchY = selYear === '' || d.getFullYear() === selYear;
    return matchSt && matchM && matchY;
  });

  const submit = async () => {
    if (!form.from || !form.to || !form.reason.trim()) { toast.error('Fill all required fields'); return; }
    const from = new Date(form.from), to = new Date(form.to);
    if (to < from) { toast.error('End date must be after start date'); return; }
    const days = Math.ceil((to.getTime() - from.getTime()) / 864e5) + 1;
    try {
      await applyLeave({ leaveType: LEAVE_TYPE_MAP[form.type] || form.type.toLowerCase().replace(' ', '_'), fromDate: form.from, toDate: form.to, totalDays: days, reason: form.reason }).unwrap();
      toast.success('Leave application submitted!');
      setModal(false); setForm(BLANK);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to submit leave');
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelLeave(id).unwrap();
      toast('Leave cancelled', { icon: '✕' });
    } catch { toast.error('Failed to cancel leave'); }
  };

  const leaveBalance = useMemo(() => computeLeaveBalance(leaves), [leaves]);

  const counts: Record<string, number> = {
    all: leaves.length, pending: leaves.filter((l) => l.status === 'pending').length, approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length, cancelled: leaves.filter((l) => l.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {leaveBalance.slice(0, 4).map((b) => {
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

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((s) => (
              <Button key={s} size="sm" variant={statusF === s ? 'default' : 'secondary'} className="rounded-lg text-[11px] capitalize" onClick={() => setStatusF(s)}>{s} ({counts[s]})</Button>
            ))}
          </div>
          <Select value={selMonth === '' ? 'all' : String(selMonth)} onValueChange={(v: string) => setSelMonth(v === 'all' ? '' : +v)}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Months</SelectItem>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selYear === '' ? 'all' : String(selYear)} onValueChange={(v: string) => setSelYear(v === 'all' ? '' : +v)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Years</SelectItem>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-gray-400">{filtered.length} records</span>
          <Button size="sm" className="ml-auto rounded-xl" onClick={() => setModal(true)}>+ Apply Leave</Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{['Leave Type', 'From', 'To', 'Days', 'Reason', 'Applied On', 'Status', 'Action'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🗓️</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No leave records found</p>
                  </div>
                </TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-semibold whitespace-nowrap">{l.type}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{l.from}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{l.to}</TableCell>
                  <TableCell className="font-bold text-center">{l.days}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={l.reason}>{l.reason}</TableCell>
                  <TableCell className="text-gray-400 whitespace-nowrap">{l.applied}</TableCell>
                  <TableCell><Badge className={`capitalize ${S_CLR[l.status]}`}>{l.status}</Badge></TableCell>
                  <TableCell>
                    {l.status === 'pending' ? (
                      <button onClick={() => cancel(l.id)} title="Cancel application"
                        className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500 font-bold text-sm transition-colors">✕</button>
                    ) : <span className="text-[10px] text-gray-400">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="p-5 space-y-3">
            <div>
              <Label className="mb-1 block">Leave Type *</Label>
              <Select value={form.type} onValueChange={(v: string) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">From *</Label>
                <Input type="date" value={form.from} onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block">To *</Label>
                <Input type="date" value={form.to} onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))} />
              </div>
            </div>
            {daysCalc > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Duration calculated</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{daysCalc} day{daysCalc !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div>
              <Label className="mb-1 block">Reason *</Label>
              <Textarea rows={3} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Briefly describe the reason for leave…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setModal(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl" disabled={applying} onClick={submit}>{applying ? 'Submitting…' : 'Submit Application'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
