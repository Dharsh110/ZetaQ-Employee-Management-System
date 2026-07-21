import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetTodayQuery, useGetMonthlyReportQuery, useGetAttendanceTrendQuery } from '../../store/api/attendanceApi';
import { useGetLeavesQuery } from '../../store/api/leavesApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const isToday = (from: string, to: string) => { const now = new Date().toISOString().slice(0, 10); return from <= now && now <= to; };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [attDept, setAttDept] = useState('');
  const [attMonth, setAttMonth] = useState(new Date().getMonth());
  const [attYear, setAttYear] = useState(CY);
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false);
  const [mdDeptSort, setMdDeptSort] = useState('');

  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const { data: todayData } = useGetTodayQuery();
  const { data: monthlyRecords = [] } = useGetMonthlyReportQuery({ month: attMonth + 1, year: attYear });
  const { data: trend = [] } = useGetAttendanceTrendQuery({ months: 6 });
  const { data: apiLeaves = [] } = useGetLeavesQuery();
  const { data: apiTasks = [] } = useGetTasksQuery();

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const depts = useMemo(() => [...new Set(apiEmployees.map((e) => (typeof e.department === 'object' ? e.department?.name : e.department) || '').filter(Boolean))] as string[], [apiEmployees]);
  const presentToday = todayData?.summary.present ?? 0;
  const lateToday = todayData?.summary.late ?? 0;
  const onLeave = apiLeaves.filter((l) => l.status === 'approved' && l.fromDate?.slice && l.toDate?.slice && isToday(l.fromDate.slice(0, 10), l.toDate.slice(0, 10))).length;
  const pendingLeaves = apiLeaves.filter((l) => l.status === 'pending').length;
  const openTasks = apiTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;

  // Per-employee attendance aggregation for the selected month
  const empRows = useMemo(() => {
    const byEmp = new Map<string, { code: string; name: string; dept: string; present: number; absent: number; late: number; leaves: number }>();
    apiEmployees.forEach((e) => byEmp.set(e._id, { code: e.employeeCode, name: `${e.firstName} ${e.lastName}`, dept: typeof e.department === 'object' ? e.department?.name || '' : e.department || '', present: 0, absent: 0, late: 0, leaves: 0 }));
    monthlyRecords.forEach((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      if (!emp) return;
      const row = byEmp.get(emp._id);
      if (!row) return;
      row.present += (r.present || 0) + (r.halfDay || 0);
      row.absent += r.absent || 0;
      row.leaves += r.leave || 0;
      row.late += r.late || 0;
    });
    return Array.from(byEmp.values());
  }, [apiEmployees, monthlyRecords]);
  const histFiltered = empRows.filter((e) => !attDept || e.dept === attDept);

  const deptAttData = useMemo(() => {
    const byDept = new Map<string, { dept: string; present: number; absent: number; late: number; leaves: number }>();
    depts.forEach((d) => byDept.set(d, { dept: d, present: 0, absent: 0, late: 0, leaves: 0 }));
    monthlyRecords.forEach((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      const deptName = emp?.department ? (typeof emp.department === 'object' ? emp.department.name : emp.department) : '';
      const row = byDept.get(deptName);
      if (!row) return;
      row.present += (r.present || 0) + (r.halfDay || 0);
      row.absent += r.absent || 0;
      row.leaves += r.leave || 0;
      row.late += r.late || 0;
    });
    return Array.from(byDept.values());
  }, [depts, monthlyRecords]);

  const taskRows = useMemo(() => apiTasks.slice(0, 6).map((t) => ({
    id: t._id,
    emp: typeof t.assignedTo === 'object' ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '—',
    task: t.title,
    dept: typeof t.assignedTo === 'object' ? (typeof t.assignedTo.department === 'object' ? t.assignedTo.department?.name || '' : t.assignedTo.department || '') : '',
    date: t.dueDate?.slice(0, 10) || '',
    status: t.status,
    hours: t.hoursWorked || 0,
  })), [apiTasks]);

  const activity = useMemo(() => apiTasks.slice(0, 5).map((t, i) => ({
    id: String(i),
    action: `${typeof t.assignedTo === 'object' ? t.assignedTo.firstName : 'Someone'} — ${t.title} (${t.status})`,
    type: t.status === 'completed' ? 'task' : t.status === 'in_progress' ? 'checkin' : 'report',
  })), [apiTasks]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-blue-100 text-sm mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            {[['Present Today', presentToday], ['Late Today', lateToday], ['On Leave', onLeave]].map(([l, v]) => (
              <div key={l as string} className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <p className="text-2xl font-bold">{v}</p>
                <p className="text-[10px] text-blue-100">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Total Employees', value: apiEmployees.length, icon: '👥', badge: 'Total', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', path: '/admin/employees' },
          { label: 'Active Today', value: presentToday, icon: '✅', badge: 'Active', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', path: '/admin/attendance' },
          { label: 'Pending Leaves', value: pendingLeaves, icon: '🗓️', badge: 'Pending', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', path: '/admin/leaves' },
          { label: 'Open Tasks', value: openTasks, icon: '📋', badge: 'Open', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', path: '/admin/tasks' },
        ] as const).map((c) => (
          <button key={c.label} onClick={() => navigate(c.path)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{c.icon}</span>
              <Badge className={c.cls}>{c.badge}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.label}</p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">View →</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Monthly Attendance Report</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 6 months across all employees</p>
          </div>
          {depts.length > 0 && (
            <Button size="sm" onClick={() => setShowMonthlyDetail(true)}>View Dept Breakdown →</Button>
          )}
        </div>
        <div className="p-5">
          {/* Always render the full 6-month structure — months with no records yet still
              show a row with 0% rather than collapsing the whole table to a blank state. */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50">
                {['Month', 'Present', 'Absent', 'Late', 'Leaves', 'Attendance %'].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {trend.map((m) => {
                  const total = m.present + m.absent;
                  const pct = total ? Math.round((m.present / total) * 100) : 0;
                  return (
                    <tr key={`${m.month}-${m.year}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{m.month} {m.year}</td>
                      <td className="px-3 py-2.5 text-xs text-emerald-600 font-bold">{m.present}</td>
                      <td className="px-3 py-2.5 text-xs text-red-500 font-bold">{m.absent}</td>
                      <td className="px-3 py-2.5 text-xs text-amber-600 font-bold">{m.late}</td>
                      <td className="px-3 py-2.5 text-xs text-blue-600 font-bold">{m.leaves}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                            <div className={'h-1.5 rounded-full ' + (total === 0 ? 'bg-gray-300 dark:bg-gray-600' : pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: (total === 0 ? 100 : pct) + '%' }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {trend.every((m) => m.present + m.absent === 0) && (
            <p className="text-[11px] text-gray-400 mt-3 text-center">No check-ins recorded yet — data will populate once employees check in.</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Employee Attendance History</h2>
            <p className="text-xs text-gray-400 mt-0.5">{MONTHS[attMonth]} {attYear} overview</p>
          </div>
          <div className="flex items-center gap-2">
            {depts.length > 0 && (
              <Select value={attDept || 'all'} onValueChange={(v: string) => setAttDept(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Departments</SelectItem>{depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => navigate('/admin/attendance')}>View Full List →</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {histFiltered.length === 0 ? (
            <div className="py-10 text-center"><span className="text-3xl">👥</span><p className="text-sm text-gray-400 mt-2">No employees yet</p></div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>{['Employee', 'Emp ID', 'Department', 'Present', 'Absent', 'Late', 'Leaves', 'Attendance %'].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {histFiltered.slice(0, 6).map((e) => {
                  const total = e.present + e.absent;
                  const pct = total ? Math.round((e.present / total) * 100) : 0;
                  return (
                    <tr key={e.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">{ini(e.name)}</div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.name}</p></div></td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-500">{e.code}</td>
                      <td className="px-3 py-3"><Badge>{e.dept}</Badge></td>
                      <td className="px-3 py-3 text-xs font-bold text-emerald-600">{e.present}</td>
                      <td className="px-3 py-3 text-xs font-bold text-red-500">{e.absent}</td>
                      <td className="px-3 py-3 text-xs font-bold text-amber-600">{e.late}</td>
                      <td className="px-3 py-3 text-xs font-bold text-blue-600">{e.leaves}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 min-w-[50px]"><div className={'h-1.5 rounded-full ' + (pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: pct + '%' }} /></div>
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div><h2 className="text-sm font-bold text-gray-900 dark:text-white">Daily Task Tracker</h2><p className="text-xs text-gray-400 mt-0.5">Latest task activity</p></div>
          <Button size="sm" variant="secondary" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => navigate('/admin/tasks')}>View Full Tracker →</Button>
        </div>
        {taskRows.length === 0 ? (
          <div className="py-10 text-center"><span className="text-3xl">📋</span><p className="text-sm text-gray-400 mt-2">No tasks yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>{['Employee', 'Task', 'Department', 'Due Date', 'Status', 'Hours'].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {taskRows.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">{ini(t.emp || '?')}</div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{t.emp}</p></div></td>
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={t.task}>{t.task}</td>
                    <td className="px-3 py-3"><Badge variant="default">{t.dept}</Badge></td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-3"><Badge variant={t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'default' : 'warning'} className="capitalize">{t.status.replace('_', ' ')}</Badge></td>
                    <td className="px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300">{t.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        {activity.length === 0 ? (
          <div className="py-6 text-center"><span className="text-2xl">🕐</span><p className="text-sm text-gray-400 mt-2">No recent activity</p></div>
        ) : (
          <div className="space-y-3">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div className={'w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ' + (a.type === 'checkin' ? 'bg-emerald-50 text-emerald-600' : a.type === 'report' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600')}>
                  {a.type === 'checkin' ? '✓' : a.type === 'report' ? '📋' : '✅'}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{a.action}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showMonthlyDetail} onOpenChange={setShowMonthlyDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex-1">
              <DialogTitle>Dept-wise Monthly Attendance</DialogTitle>
              <p className="text-xs text-gray-400 mt-0.5">{MONTHS[attMonth]} {attYear}</p>
            </div>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Select value={String(attMonth)} onValueChange={(v: string) => setAttMonth(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(attYear)} onValueChange={(v: string) => setAttYear(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={mdDeptSort || 'name'} onValueChange={(v: string) => setMdDeptSort(v === 'name' ? '' : v)}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Department (A–Z)</SelectItem>
                  <SelectItem value="present_desc">Sort: Present (High–Low)</SelectItem>
                  <SelectItem value="att_desc">Sort: Attendance % (High–Low)</SelectItem>
                  <SelectItem value="att_asc">Sort: Attendance % (Low–High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deptAttData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No department data available</p>
            ) : (
              <table className="w-full">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50">{['Department', 'Present', 'Absent', 'Late', 'Leaves', 'Att %'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {(() => {
                    const rows = deptAttData.map((d) => { const total = d.present + d.absent; return { ...d, pct: total ? Math.round((d.present / total) * 100) : 0 }; });
                    if (mdDeptSort === 'present_desc') rows.sort((a, b) => b.present - a.present);
                    else if (mdDeptSort === 'att_desc') rows.sort((a, b) => b.pct - a.pct);
                    else if (mdDeptSort === 'att_asc') rows.sort((a, b) => a.pct - b.pct);
                    else rows.sort((a, b) => a.dept.localeCompare(b.dept));
                    return rows.map((r) => (
                      <tr key={r.dept} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3"><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.dept}</span></td>
                        <td className="px-4 py-3 text-xs font-bold text-emerald-600">{r.present}</td>
                        <td className="px-4 py-3 text-xs font-bold text-red-500">{r.absent}</td>
                        <td className="px-4 py-3 text-xs font-bold text-amber-600">{r.late}</td>
                        <td className="px-4 py-3 text-xs font-bold text-blue-600">{r.leaves}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className={'h-1.5 rounded-full ' + (r.pct >= 90 ? 'bg-emerald-500' : r.pct >= 75 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: r.pct + '%' }} /></div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{r.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMonthlyDetail(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
