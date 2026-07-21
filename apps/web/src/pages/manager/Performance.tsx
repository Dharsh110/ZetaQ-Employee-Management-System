import { type ReactNode, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetMonthlyReportQuery } from '../../store/api/attendanceApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const CY = new Date().getFullYear();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);

type SortCol = 'name' | 'tasksDone' | 'taskRate' | 'attendance' | 'lateCount' | 'avgHours' | 'score';
type SortDir = 'asc' | 'desc';
type PerfRow = { id: string; name: string; dept: string; designation: string; tasksTotal: number; tasksDone: number; taskRate: number; attendance: number; lateCount: number; avgHours: number; score: number };

const AVAIL_CLR = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ManagerPerformance() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(CY);
  const [deptF, setDeptF] = useState(myDept);
  const [empF, setEmpF] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: apiEmployees = [], isLoading: loadingEmp } = useGetEmployeesQuery();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!myDept });
  const { data: apiAttendance = [], isLoading: loadingAtt } = useGetMonthlyReportQuery({ month: month + 1, year, department: myDept });
  const { data: apiTasks = [], isLoading: loadingTk } = useGetTasksQuery({ department: myDept });
  const loading = loadingEmp || loadingAtt || loadingTk;

  const data: PerfRow[] = useMemo(() => {
    const emps = apiEmployees.filter((e) => !myDept || (typeof e.department === 'object' ? e.department?.name : e.department) === myDept);
    return emps.map((e) => {
      const empAtts = apiAttendance.filter((a) => (typeof a.employee === 'object' ? a.employee._id : a.employee) === e._id);
      const empTasks = apiTasks.filter((t) => (typeof t.assignedTo === 'object' ? t.assignedTo._id : t.assignedTo) === e._id);

      const tasksTotal = empTasks.length;
      const tasksDone = empTasks.filter((t) => t.status === 'completed').length;
      const taskRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

      // empAtts holds pre-aggregated monthly rows (present/absent/late as counts,
      // no per-day checkIn/status fields) — sum the count fields directly.
      const presentDays = empAtts.reduce((sum, a) => sum + (a.present || 0) + (a.halfDay || 0), 0);
      const workingDays = empAtts.reduce((sum, a) => sum + (a.present || 0) + (a.absent || 0) + (a.halfDay || 0) + (a.leave || 0), 0) || 1;
      const attendance = Math.round((presentDays / workingDays) * 100);

      const lateCount = empAtts.reduce((sum, a) => sum + (a.late || 0), 0);
      const totalHours = empAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
      const avgHours = presentDays > 0 ? +(totalHours / presentDays).toFixed(1) : 0;

      const score = Math.round(taskRate * 0.4 + attendance * 0.4 + Math.min(avgHours / 9, 1) * 20);

      return {
        id: e._id,
        name: `${e.firstName} ${e.lastName}`,
        dept: typeof e.department === 'object' ? e.department?.name || myDept : e.department || myDept,
        designation: e.designation || 'Employee',
        tasksTotal, tasksDone, taskRate, attendance, lateCount, avgHours, score,
      };
    });
  }, [apiEmployees, apiAttendance, apiTasks, myDept]);

  const handleSort = (col: SortCol) => { if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortCol(col); setSortDir('desc'); } };
  const deptFiltered = useMemo(() => data.filter((r) => (!deptF || r.dept === deptF) && (!empF || r.name === empF)), [data, deptF, empF]);
  const empNames = useMemo(() => Array.from(new Set(data.filter((r) => !deptF || r.dept === deptF).map((r) => r.name))).sort((a, b) => a.localeCompare(b)), [data, deptF]);
  const sorted = useMemo(() => [...deptFiltered].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  }), [deptFiltered, sortCol, sortDir]);

  const SortBtn = ({ col, label }: { col: SortCol; label: string }) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-0.5 hover:text-blue-500 transition-colors group whitespace-nowrap">{label}<span className="ml-0.5 text-[9px] opacity-60 group-hover:opacity-100">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span></button>
  );
  const getScoreColor = (score: number) => (score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : score >= 60 ? 'text-amber-500' : 'text-red-500');
  const getBar = (val: number, max: number, color: string): ReactNode => (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full flex-shrink-0"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (val / max) * 100)}%` }} /></div>
      <span className="text-xs text-gray-600 dark:text-gray-400">{typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(1) : val}</span>
    </div>
  );
  const avg = (key: keyof PerfRow) => {
    const vals = deptFiltered.map((r) => r[key] as number);
    if (!vals.length) return '0.0';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Avg Task Rate', v: `${avg('taskRate')}%`, c: 'bg-blue-50 dark:bg-blue-900/10 text-blue-600' },
          { l: 'Avg Attendance', v: `${avg('attendance')}%`, c: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' },
          { l: 'Avg Score', v: `${avg('score')}`, c: 'bg-purple-50 dark:bg-purple-900/10 text-purple-600' },
          { l: 'Avg Hours/Day', v: `${avg('avgHours')}h`, c: 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' },
        ].map((s) => (
          <div key={s.l} className={`border border-gray-200 dark:border-gray-700 rounded-2xl p-3 ${s.c}`}>
            <p className="text-xl font-bold">{s.v}</p>
            <p className="text-[10px] font-semibold mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Period:</span>
          <Select value={String(month)} onValueChange={(v: string) => setMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
          <Select value={String(year)} onValueChange={(v: string) => setYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          {!myDept && (
            <Select value={deptF || 'all'} onValueChange={(v: string) => { setDeptF(v === 'all' ? '' : v); setEmpF(''); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-gray-400 ml-auto">Showing {sorted.length} of {data.length} members</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="name" label="Employee" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="tasksDone" label="Tasks Done" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="taskRate" label="Task Rate" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="attendance" label="Attendance" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="lateCount" label="Late" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="avgHours" label="Avg hrs/day" /></th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col="score" label="Score" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No performance data yet. Add team members to see their metrics here.</td></tr>
              ) : sorted.map((r, i) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>{initials(r.name)}</div><div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.name}</p><p className="text-[10px] text-gray-400">{r.designation}</p></div></div></td>
                  <td className="px-4 py-3">{getBar(r.tasksDone, Math.max(r.tasksTotal, 1), 'bg-blue-500')}<span className="text-[10px] text-gray-400">{r.tasksDone}/{r.tasksTotal}</span></td>
                  <td className="px-4 py-3">{getBar(r.taskRate, 100, 'bg-purple-500')}</td>
                  <td className="px-4 py-3">{getBar(r.attendance, 100, 'bg-emerald-500')}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold ${r.lateCount > 5 ? 'text-red-500' : r.lateCount > 2 ? 'text-amber-500' : 'text-emerald-600'}`}>{r.lateCount}</span></td>
                  <td className="px-4 py-3">{getBar(r.avgHours, 10, 'bg-amber-500')}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-current" style={{ borderColor: r.score >= 90 ? '#10b981' : r.score >= 75 ? '#3b82f6' : r.score >= 60 ? '#f59e0b' : '#ef4444' }}><span className={`text-[11px] font-bold ${getScoreColor(r.score)}`}>{r.score}</span></div></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
