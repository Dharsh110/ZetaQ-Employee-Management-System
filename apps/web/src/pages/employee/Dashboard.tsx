import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useGetMyAttendanceQuery, useCheckInMutation, useCheckOutMutation } from '../../store/api/attendanceApi';
import { useGetMyTasksQuery } from '../../store/api/tasksApi';
import { useGetMyLeavesQuery } from '../../store/api/leavesApi';

const todayStr = new Date().toISOString().slice(0, 10);
const todayFmt = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const getTimeNow = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const isLate = () => { const n = new Date(); return n.getHours() > 9 || (n.getHours() === 9 && n.getMinutes() > 15); };
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return ''; } };

const P_CLR: Record<string, string> = {
  high: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const LEAVE_LIMITS: Record<string, number> = { casual: 10, sick: 6, earned: 15 };
const LEAVE_LABELS: Record<string, string> = { casual: 'Casual', sick: 'Sick', earned: 'Earned' };
const LEAVE_COLORS: Record<string, string> = { casual: 'bg-blue-500', sick: 'bg-red-500', earned: 'bg-emerald-500' };

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(getTimeNow());
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => { const t = setInterval(() => setTime(getTimeNow()), 1000); return () => clearInterval(t); }, []);

  const { data: attRecords } = useGetMyAttendanceQuery();
  const { data: myTasks } = useGetMyTasksQuery();
  const { data: myLeaves } = useGetMyLeavesQuery();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const attRecord = (attRecords || []).find((r) => r.date?.slice(0, 10) === todayStr) || null;
  const presentCount = (attRecords || []).filter((r) => ['present', 'half_day'].includes(r.status)).length;

  const tasksPending = (myTasks || []).filter((t) => !['completed', 'cancelled'].includes(t.status)).length;
  const tasksCompleted = (myTasks || []).filter((t) => t.status === 'completed').length;
  const recentTasks = (myTasks || [])
    .filter((t) => !['completed', 'cancelled'].includes(t.status))
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const approvedLeaves = (myLeaves || []).filter((l) => l.status === 'approved' || l.status === 'pending');
  const leaveBalance = Object.entries(LEAVE_LIMITS).map(([type, total]) => {
    const used = approvedLeaves.filter((l) => l.leaveType === type).reduce((s, l) => s + (l.totalDays || 1), 0);
    return { type, label: LEAVE_LABELS[type], used, total, color: LEAVE_COLORS[type] };
  });
  const leavesRemaining = leaveBalance.reduce((s, l) => s + Math.max(l.total - l.used, 0), 0);

  const attLoading = checkingIn || checkingOut;
  const checkedIn = !!attRecord?.checkIn;
  const checkedOut = !!attRecord?.checkOut;
  const late = isLate();

  const doCheckIn = async () => {
    try {
      await checkIn().unwrap();
      toast.success(`Checked in${late ? ' (Late)' : ' — On Time!'}`);
    } catch (e: any) {
      toast.error(e?.data?.message || 'Check-in failed');
    }
  };

  const doCheckOut = async () => {
    try {
      await checkOut().unwrap();
      toast.success('Checked out successfully!');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Check-out failed');
    }
  };

  const quickStats = [
    { label: 'Present This Month', value: String(presentCount), icon: '✅', color: 'from-emerald-500 to-emerald-600', path: '/employee/attendance' },
    { label: 'Leaves Remaining', value: String(leavesRemaining), icon: '🗓️', color: 'from-amber-500 to-amber-600', path: '/employee/leaves' },
    { label: 'Tasks Pending', value: String(tasksPending), icon: '📋', color: 'from-blue-500 to-blue-600', path: '/employee/tasks' },
    { label: 'Tasks Completed', value: String(tasksCompleted), icon: '🏆', color: 'from-purple-500 to-purple-600', path: '/employee/tasks' },
  ];

  return (
    <div className="space-y-5">
      {/* Welcome + Clock */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute right-10 top-12 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0] || 'Employee'}! 👋</h2>
            <p className="text-blue-100 text-sm mt-0.5">{todayFmt}</p>
            {checkedIn && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {attRecord?.checkIn && <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-xl">🟢 In: {fmtTime(attRecord.checkIn)}</span>}
                {attRecord?.checkOut && <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-xl">🔴 Out: {fmtTime(attRecord.checkOut)}</span>}
                {!!attRecord?.totalHours && <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-xl">⏱ {Math.floor(attRecord.totalHours)}h {Math.round((attRecord.totalHours % 1) * 60)}m</span>}
                <span className={`text-xs px-2.5 py-1 rounded-xl font-semibold ${attRecord?.isLate ? 'bg-amber-400/30 text-amber-100' : 'bg-emerald-400/30 text-emerald-100'}`}>{attRecord?.isLate ? 'Late' : 'On Time'}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold">{time}</p>
            <p className="text-blue-200 text-xs mt-0.5">Current time</p>
          </div>
        </div>
      </div>

      {/* Check-in / Check-out */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Today's Attendance</h3>
        {!checkedIn && late && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <span className="text-amber-500">⚠️</span>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">You're checking in late. Standard time is 9:00 AM.</p>
          </div>
        )}
        {!checkedIn && (
          <div className="mb-3">
            <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              <span>{showNotes ? '▾' : '▸'}</span> {showNotes ? 'Hide' : 'Add'} optional check-in notes
            </button>
            {showNotes && (
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Working from home…" className="mt-2" />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {!checkedIn ? (
            <Button onClick={doCheckIn} disabled={attLoading} size="lg"
              className={`rounded-xl font-bold shadow-lg hover:scale-105 transition-all ${late ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              🟢 {attLoading ? 'Checking in…' : `Check In ${late ? '(Late)' : ''}`}
            </Button>
          ) : !checkedOut ? (
            <Button onClick={doCheckOut} disabled={attLoading} size="lg" variant="destructive" className="rounded-xl font-bold shadow-lg hover:scale-105 transition-all">
              🔴 {attLoading ? 'Checking out…' : 'Check Out'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <span>✅</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Done for today{attRecord?.totalHours ? ` — ${Math.floor(attRecord.totalHours)}h ${Math.round((attRecord.totalHours % 1) * 60)}m worked` : ''}</span>
            </div>
          )}
          {checkedIn && !checkedOut && <div className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold text-emerald-600 dark:text-emerald-400">● Active</span> · since {fmtTime(attRecord!.checkIn!)}</div>}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((s) => (
          <button key={s.label} onClick={() => navigate(s.path)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-base mb-2.5 shadow-sm`}>{s.icon}</div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* 2-col: Tasks + Leave balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Tasks</h3>
            <button onClick={() => navigate('/employee/tasks')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all →</button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {recentTasks.map((t) => (
                <div key={t._id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex-1">{t.title}</p>
                    <Badge className={P_CLR[t.priority] || P_CLR.medium}>{t.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>{t.status.replace('_', ' ')}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">Due: {t.dueDate?.slice(0, 10) || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Balance</h3>
            <button onClick={() => navigate('/employee/leaves')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Apply →</button>
          </div>
          <div className="p-5 space-y-4">
            {leaveBalance.map((l) => {
              const pct = Math.round(Math.min(100, (l.used / l.total) * 100));
              const rem = l.total - l.used;
              return (
                <div key={l.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{l.label} Leave</span>
                    <span className="text-xs text-gray-500"><span className="font-bold text-gray-700 dark:text-gray-300">{Math.max(0, rem)}</span>/{l.total} remaining</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${l.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{l.used} used</span>
                    <span className="text-[10px] text-gray-400">{l.total} total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          <p className="text-xs text-gray-400 mt-0.5">Jump to common tasks</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Submit Report', path: '/employee/daily-report', icon: '📝', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100' },
            { label: 'Apply Leave', path: '/employee/leaves', icon: '🗓️', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100' },
            { label: 'View Payslip', path: '/employee/payslips', icon: '💰', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100' },
            { label: 'My Attendance', path: '/employee/attendance', icon: '📊', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100' },
            { label: 'Upload File', path: '/employee/uploaded-files', icon: '📎', color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100' },
            { label: 'Send Message', path: '/employee/messages', icon: '✉️', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${a.color}`}>
              <span>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
