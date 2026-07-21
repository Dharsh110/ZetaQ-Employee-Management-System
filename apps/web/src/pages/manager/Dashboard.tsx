import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useGetTodayQuery, useGetMyAttendanceQuery, useCheckInMutation, useCheckOutMutation } from '../../store/api/attendanceApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetLeavesQuery, useUpdateLeaveStatusMutation } from '../../store/api/leavesApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { mapApiLeaveToRow } from '../admin/leaves-columns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../../components/ui/dialog';

const todayStr = new Date().toISOString().slice(0, 10);
const todayFmt = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return iso; } };

const STATUS_CLR: Record<string, string> = {
  in_progress: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};
const P_CLR: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

type ModalKey = 'present' | 'absent' | 'tasks' | 'leaves' | null;

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mgrDept = (user as any)?.department || '';
  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';

  const { data: todayData } = useGetTodayQuery();
  const { data: apiTasks = [] } = useGetTasksQuery({ department: mgrDept });
  const { data: apiLeaves = [] } = useGetLeavesQuery({ department: mgrDept });
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const { data: myAttRecords = [] } = useGetMyAttendanceQuery();
  const [checkIn] = useCheckInMutation();
  const [checkOut] = useCheckOutMutation();
  const [updateLeaveStatus] = useUpdateLeaveStatusMutation();

  const [ciNotes, setCiNotes] = useState('');
  const [ciLoading, setCiLoading] = useState(false);
  const [modal, setModal] = useState<ModalKey>(null);
  const [showAll, setShowAll] = useState(false);

  const teamAtt = useMemo(
    () => (todayData?.records ?? []).filter((a) => {
      const emp = typeof a.employee === 'object' ? a.employee : null;
      const dept = emp?.department ? (typeof emp.department === 'object' ? emp.department.name : emp.department) : '';
      return !mgrDept || dept === mgrDept;
    }),
    [todayData, mgrDept]
  );
  const leaves = useMemo(() => apiLeaves.map(mapApiLeaveToRow), [apiLeaves]);
  const teamRoster = useMemo(
    () => apiEmployees.filter((e) => e.status === 'active' && (!mgrDept || (typeof e.department === 'object' ? e.department?.name : e.department) === mgrDept)),
    [apiEmployees, mgrDept]
  );
  const myAtt = myAttRecords.find((a) => a.date?.slice(0, 10) === todayStr) || null;

  const doCheckIn = async () => {
    setCiLoading(true);
    try { await checkIn().unwrap(); toast.success('Checked in successfully!'); }
    catch (err: any) { toast.error(err?.data?.message || 'Check-in failed'); }
    finally { setCiLoading(false); }
  };
  const doCheckOut = async () => {
    setCiLoading(true);
    try { await checkOut().unwrap(); toast.success('Checked out successfully!'); }
    catch (err: any) { toast.error(err?.data?.message || 'Check-out failed'); }
    finally { setCiLoading(false); }
  };

  const approveLeave = async (id: string) => { try { await updateLeaveStatus({ id, status: 'approved' }).unwrap(); toast.success('Leave approved'); } catch { toast.error('Failed to approve'); } };
  const rejectLeave = async (id: string) => { try { await updateLeaveStatus({ id, status: 'rejected', reason: 'Rejected by manager' }).unwrap(); toast.success('Leave rejected'); } catch { toast.error('Failed to reject'); } };

  const present = teamAtt.filter((a) => a.status === 'present' || (a.checkIn && a.status !== 'absent'));
  const absent = teamAtt.filter((a) => a.status === 'absent');
  const late = teamAtt.filter((a) => a.isLate);
  const onLeaveAtt = teamAtt.filter((a) => a.status === 'leave');
  const pendingL = leaves.filter((l) => l.status === 'pending');
  const activeTasks = apiTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  const empName = (a: (typeof teamAtt)[number]) => (typeof a.employee === 'object' ? `${a.employee.firstName} ${a.employee.lastName}` : 'Employee');
  const empCode = (a: (typeof teamAtt)[number]) => (typeof a.employee === 'object' ? a.employee.employeeCode || '' : '');
  const assigneeName = (t: (typeof apiTasks)[number]) => (typeof t.assignedTo === 'object' ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Unassigned');

  const statCards: { key: ModalKey; label: string; val: number; icon: string; color: string; sub: string; bg: string }[] = [
    { key: 'present', label: 'Present Today', val: present.length, icon: '✅', color: 'bg-emerald-500', sub: `${late.length} arrived late`, bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' },
    { key: 'absent', label: 'Absent Today', val: absent.length, icon: '❌', color: 'bg-red-500', sub: `${onLeaveAtt.length} on leave`, bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' },
    { key: 'tasks', label: 'Active Tasks', val: activeTasks.length, icon: '📋', color: 'bg-blue-500', sub: `${activeTasks.filter((t) => t.status === 'overdue').length} overdue`, bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' },
    { key: 'leaves', label: 'Pending Leaves', val: pendingL.length, icon: '🗓️', color: 'bg-amber-500', sub: 'Needs your approval', bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' },
  ];

  const displayTeam = showAll ? teamAtt : teamAtt.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-lg font-bold">Good {greeting}, {user?.name?.split(' ')[0] || 'Manager'}! 👋</h2>
          <p className="text-blue-100 text-xs mt-0.5">{todayFmt} &middot; {mgrDept ? `${mgrDept} Department` : 'All Departments'}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl">👥 {teamRoster.length} team members</span>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl">✅ {present.length} present today</span>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl">📋 {activeTasks.length} active tasks</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Attendance</h3><p className="text-xs text-gray-400 mt-0.5">{todayStr}</p></div>
          <div className="flex items-center gap-4 flex-wrap">
            {myAtt ? (
              <>
                <div className="text-center"><p className="text-[10px] text-gray-400 uppercase tracking-wide">Checked In</p><p className="text-sm font-bold text-emerald-600">{myAtt.checkIn ? fmtTime(myAtt.checkIn) : '—'}</p></div>
                {myAtt.checkOut ? (
                  <div className="text-center"><p className="text-[10px] text-gray-400 uppercase tracking-wide">Checked Out</p><p className="text-sm font-bold text-blue-600">{fmtTime(myAtt.checkOut)}</p></div>
                ) : (
                  <Button variant="secondary" className="bg-red-500 hover:bg-red-600 text-white" onClick={doCheckOut} disabled={ciLoading}>{ciLoading ? 'Checking out…' : 'Check Out'}</Button>
                )}
                <Badge variant={myAtt.checkOut ? 'default' : 'success'}>{myAtt.checkOut ? 'Completed' : 'Active'}</Badge>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Input value={ciNotes} onChange={(e) => setCiNotes(e.target.value)} placeholder="Optional note…" className="w-44" />
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={doCheckIn} disabled={ciLoading}>{ciLoading ? 'Checking in…' : 'Check In'}</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <button key={s.label} onClick={() => setModal(s.key)} className={`border rounded-2xl p-4 text-left hover:scale-105 transition-all ${s.bg}`}>
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center text-white text-base mb-3 shadow`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.val}</p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{s.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Requests</h3><p className="text-xs text-gray-400 mt-0.5">{pendingL.length} pending &middot; {mgrDept}</p></div>
            <button onClick={() => navigate('/manager/leaves')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Full view →</button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {pendingL.length === 0 ? (
              <div className="px-5 py-8 text-center"><span className="text-2xl">✅</span><p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No pending leave requests</p></div>
            ) : pendingL.slice(0, 4).map((l, i) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{ini(l.name)}</div>
                  <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{l.name}</p><p className="text-[10px] text-gray-400">{l.type} &middot; {l.days}d &middot; {l.from}</p></div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="secondary" className="h-7 w-7 bg-emerald-50 text-emerald-700 border border-emerald-200" onClick={() => approveLeave(l.id)}>✓</Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7 bg-red-50 text-red-600 border border-red-200" onClick={() => rejectLeave(l.id)}>✕</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Tasks</h3><p className="text-xs text-gray-400 mt-0.5">{activeTasks.length} total &middot; {activeTasks.filter((t) => t.status === 'overdue').length} overdue</p></div>
            <button onClick={() => navigate('/manager/tasks')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">View all →</button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {activeTasks.length === 0 ? (
              <div className="px-5 py-8 text-center"><span className="text-2xl">📋</span><p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No active tasks for {mgrDept || 'your team'}</p></div>
            ) : activeTasks.slice(0, 5).map((t) => (
              <div key={t._id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{t.title}</p><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_CLR[t.priority] || P_CLR.medium}`}>{t.priority}</span></div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{assigneeName(t).split(' ')[0]}</span>
                    <span className="text-[10px] text-gray-400">Due: {t.dueDate?.slice(0, 10)}</span>
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_CLR[t.status] || ''}`}>{t.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Today's Team Check-in</h3><p className="text-xs text-gray-400 mt-0.5">{mgrDept} &middot; {teamAtt.length} members &middot; {todayStr}</p></div>
          {teamAtt.length > 5 && <button onClick={() => setShowAll((p) => !p)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">{showAll ? 'Show less' : `Show all (${teamAtt.length}) →`}</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>{['Employee', 'Code', 'Check In', 'Check Out', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {teamAtt.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{mgrDept ? `No attendance data for ${mgrDept} today` : 'No attendance data for today'}</td></tr>
              ) : displayTeam.map((a, i) => (
                <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${COLORS[i % COLORS.length]}`}>{ini(empName(a))}</div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{empName(a)}</span></div></td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">{empCode(a)}</td>
                  <td className="px-4 py-3">{a.checkIn ? <span className={`text-xs font-semibold font-mono ${a.isLate ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtTime(a.checkIn)}{a.isLate && ' ⚠️'}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="px-4 py-3">{a.checkOut ? <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{fmtTime(a.checkOut)}</span> : <span className="text-xs text-gray-400">{a.checkIn ? 'Still in' : '—'}</span>}</td>
                  <td className="px-4 py-3"><Badge variant={a.status === 'present' ? 'success' : a.isLate ? 'warning' : a.status === 'absent' ? 'destructive' : a.status === 'leave' ? 'default' : 'gray'} className="capitalize">{a.status?.replace('_', ' ') || (a.checkIn ? 'present' : 'absent')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Assign Task', path: '/manager/tasks', icon: '📋', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100' },
            { label: 'Approve Leave', path: '/manager/leaves', icon: '✅', cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100' },
            { label: 'Team Reports', path: '/manager/reports', icon: '📊', cls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100' },
            { label: 'Performance', path: '/manager/performance', icon: '🏆', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${a.cls}`}><span>{a.icon}</span>{a.label}</button>
          ))}
        </div>
      </div>

      <Dialog open={modal === 'present'} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>✅ Present Today ({present.length})</DialogTitle></DialogHeader>
          <DialogBody>
            {present.map((a, i) => (
              <div key={a._id} className="flex items-center gap-3 py-2">
                <div className={`w-9 h-9 rounded-xl ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-xs font-bold`}>{ini(empName(a))}</div>
                <div className="flex-1"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{empName(a)}</p><p className="text-[10px] text-gray-400">{a.checkIn ? fmtTime(a.checkIn) : '—'}</p></div>
                {a.isLate && <Badge variant="warning">Late</Badge>}
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'absent'} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>❌ Absent Today ({absent.length + onLeaveAtt.length})</DialogTitle></DialogHeader>
          <DialogBody>
            {[...absent, ...onLeaveAtt].map((a, i) => (
              <div key={a._id} className="flex items-center gap-3 py-2">
                <div className={`w-9 h-9 rounded-xl ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-xs font-bold`}>{ini(empName(a))}</div>
                <div className="flex-1"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{empName(a)}</p></div>
                <Badge variant={a.status === 'leave' ? 'default' : 'destructive'} className="capitalize">{a.status?.replace('_', ' ') || 'absent'}</Badge>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'tasks'} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>📋 {mgrDept} Active Tasks ({activeTasks.length})</DialogTitle></DialogHeader>
          <DialogBody>
            {activeTasks.map((t) => (
              <div key={t._id} className="py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div className="flex items-center gap-2 flex-wrap"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.title}</p><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_CLR[t.priority] || P_CLR.medium}`}>{t.priority}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_CLR[t.status] || ''}`}>{t.status.replace(/_/g, ' ')}</span></div>
                <div className="flex items-center gap-3 mt-1.5"><span className="text-[10px] text-gray-400">👤 {assigneeName(t)}</span><span className="text-[10px] text-gray-400">Due: {t.dueDate?.slice(0, 10)}</span></div>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'leaves'} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>🗓️ {mgrDept} Leave Requests ({pendingL.length} pending)</DialogTitle></DialogHeader>
          <DialogBody>
            {leaves.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-xs font-bold`}>{ini(l.name)}</div>
                  <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{l.name}</p><p className="text-[10px] text-gray-400">{l.type} &middot; {l.days}d &middot; {l.from} → {l.to}</p></div>
                </div>
                {l.status === 'pending' ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200" onClick={() => approveLeave(l.id)}>✓ Approve</Button>
                    <Button size="sm" variant="secondary" className="bg-red-50 text-red-600 border border-red-200" onClick={() => rejectLeave(l.id)}>✕ Reject</Button>
                  </div>
                ) : <Badge variant={l.status === 'approved' ? 'success' : 'destructive'} className="capitalize">{l.status}</Badge>}
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
