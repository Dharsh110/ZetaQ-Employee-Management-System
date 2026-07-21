import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGetTodayQuery, useGetAllAttendanceQuery, type ApiAttendance } from '../../store/api/attendanceApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const todayStr = new Date().toISOString().slice(0, 10);

type Period = 'today' | 'week' | 'month' | 'year' | 'date';
type SortDir = 'asc' | 'desc';
type SortCol = 'name' | 'attPct' | 'present' | 'absent' | 'late';

const AVAIL_CLR = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const deptOf = (e: { department?: { name: string } | string } | null) => (e ? (typeof e.department === 'object' ? e.department?.name : e.department) || '' : '');

interface AggRow { id: string; name: string; code: string; dept: string; present: number; absent: number; late: number; halfDay: number; leave: number; avgHours: number; attPct: number; officialMinutes: number }

// `records` here are flat per-day attendance records — tally each day into its
// employee's running totals.
function aggregate(records: ApiAttendance[]): AggRow[] {
  const byEmp = new Map<string, { name: string; code: string; dept: string; present: number; absent: number; late: number; halfDay: number; leave: number; totalHours: number; officialMinutes: number; count: number }>();
  records.forEach((r) => {
    const emp = typeof r.employee === 'object' ? r.employee : null;
    if (!emp) return;
    const key = emp._id;
    if (!byEmp.has(key)) byEmp.set(key, { name: `${emp.firstName} ${emp.lastName}`, code: emp.employeeCode || '', dept: deptOf(emp), present: 0, absent: 0, late: 0, halfDay: 0, leave: 0, totalHours: 0, officialMinutes: 0, count: 0 });
    const agg = byEmp.get(key)!;
    if (r.status === 'present') agg.present++;
    if (r.status === 'absent') agg.absent++;
    if (r.status === 'half_day') agg.halfDay++;
    if (r.status === 'leave') agg.leave++;
    if (r.isLate) agg.late++;
    agg.totalHours += r.totalHours || 0;
    agg.officialMinutes += r.officialWorkMinutes || 0;
    agg.count++;
  });
  return Array.from(byEmp.entries()).map(([id, a]) => ({
    id, name: a.name, code: a.code, dept: a.dept, present: a.present, absent: a.absent, late: a.late, halfDay: a.halfDay, leave: a.leave,
    avgHours: a.count ? a.totalHours / a.count : 0,
    // `late` isn't a separate day bucket — a late day is still counted in `present`,
    // so it must not be added again here or the percentage can exceed 100%.
    attPct: a.count ? Math.round(((a.present + a.halfDay) / a.count) * 100) : 0,
    officialMinutes: a.officialMinutes,
  }));
}
const fmtOfficialMinutes = (m: number) => (m ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : '—');

export default function ManagerTeamAttendance() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';

  const [period, setPeriod] = useState<Period>('today');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [specificDate, setSpecificDate] = useState(todayStr);
  const [statusF, setStatusF] = useState<string>('all');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const effDept = myDept || deptF;

  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!myDept });
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.filter((e) => !effDept || deptOf(e as any) === effDept).map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees, effDept]);
  const isDayMode = period === 'today' || period === 'date';
  const { data: todayData } = useGetTodayQuery({ date: period === 'date' ? specificDate : todayStr }, { skip: !isDayMode });
  const periodRange = useMemo(() => {
    if (period === 'week') { const from = new Date(Date.now() - 7 * 864e5); return { from: from.toISOString().slice(0, 10), to: todayStr }; }
    if (period === 'year') { return { from: `${selYear}-01-01`, to: `${selYear}-12-31` }; }
    const from = new Date(selYear, selMonth, 1); const to = new Date(selYear, selMonth + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [period, selMonth, selYear]);
  const { data: monthlyRecords = [], isFetching: monthlyLoading } = useGetAllAttendanceQuery({ from: periodRange.from, to: periodRange.to, limit: 5000 }, { skip: isDayMode });

  const todayTeam = useMemo(() => {
    const records = (todayData?.records ?? []).filter((r) => !effDept || deptOf(typeof r.employee === 'object' ? r.employee : null) === effDept);
    return records.map((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      return {
        id: r._id, name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown', code: emp?.employeeCode || '', dept: deptOf(emp),
        date: r.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        // `status` is the real attendance state; `isLate` is an independent flag on
        // top of it — a late arrival is still present, so the two must not collapse
        // into one mutually-exclusive bucket (that previously made "Present" undercount).
        status: r.status,
        isLate: !!r.isLate,
        officialMinutes: r.officialWorkMinutes || 0,
        notes: r.notes || '',
      };
    });
  }, [todayData, effDept]);

  const periodTeam = useMemo(() => {
    // periodRange already scopes monthlyRecords to the right from/to window server-side.
    const records = monthlyRecords.filter((r) => !effDept || deptOf(typeof r.employee === 'object' ? r.employee : null) === effDept);
    return aggregate(records);
  }, [monthlyRecords, effDept]);

  const todaySummary = {
    present: todayTeam.filter((m) => m.status === 'present').length,
    absent: todayTeam.filter((m) => m.status === 'absent').length,
    late: todayTeam.filter((m) => m.isLate).length,
    onLeave: todayTeam.filter((m) => m.status === 'leave').length,
  };

  const sortedToday = useMemo(() => {
    let data = statusF === 'all' ? todayTeam : statusF === 'late' ? todayTeam.filter((m) => m.isLate) : todayTeam.filter((m) => m.status === statusF);
    if (empF) data = data.filter((m) => m.name === empF);
    data = [...data].sort((a, b) => (sortDir === 'asc' ? 1 : -1) * a.name.localeCompare(b.name));
    return data;
  }, [todayTeam, statusF, sortDir, empF]);

  const sortedPeriod = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1;
    const base = empF ? periodTeam.filter((m) => m.name === empF) : periodTeam;
    return [...base].sort((a, b) => (sortCol === 'name' ? factor * a.name.localeCompare(b.name) : factor * (a[sortCol] - b[sortCol])));
  }, [periodTeam, sortCol, sortDir, empF]);

  const SortBtn = ({ col, label }: { col: SortCol; label: string }) => (
    <button onClick={() => { if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortCol(col); setSortDir('asc'); } }}
      className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-0.5 hover:text-gray-800 dark:hover:text-gray-200 whitespace-nowrap">
      {label}{sortCol === col ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="opacity-30">↕</span>}
    </button>
  );

  const isToday = isDayMode;
  const rowCount = isToday ? sortedToday.length : sortedPeriod.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          ['all', 'Total', isToday ? todayTeam.length : periodTeam.length, 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700', 'text-gray-900 dark:text-white'],
          ['present', 'Present', isToday ? todaySummary.present : periodTeam.reduce((s, m) => s + m.present, 0), 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800', 'text-emerald-600 dark:text-emerald-400'],
          ['absent', 'Absent', isToday ? todaySummary.absent : periodTeam.reduce((s, m) => s + m.absent, 0), 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800', 'text-red-500 dark:text-red-400'],
          ['late', 'Late', isToday ? todaySummary.late : periodTeam.reduce((s, m) => s + m.late, 0), 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800', 'text-amber-600 dark:text-amber-400'],
          ['leave', 'On Leave', isToday ? todaySummary.onLeave : periodTeam.reduce((s, m) => s + m.leave, 0), 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800', 'text-purple-600 dark:text-purple-400'],
        ] as [string, string, number, string, string][]).map(([key, label, val, bg, tc]) => (
          <button key={key} onClick={() => setStatusF(key)} className={`border rounded-2xl p-3 text-center hover:scale-105 transition-all ${bg} ${statusF === key ? 'ring-2 ring-blue-500' : ''}`}>
            <p className={`text-xl font-bold ${tc}`}>{val}</p>
            <p className={`text-[10px] font-semibold ${tc} mt-0.5`}>{label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'week', 'month', 'year'] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} onClick={() => setPeriod(p)} className="capitalize">
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'Month' : 'Year'}
            </Button>
          ))}
          <Input type="date" value={specificDate} max={todayStr} onChange={(e) => { setSpecificDate(e.target.value); setPeriod('date'); }} className={`h-8 w-36 text-xs ${period === 'date' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`} />
          {(period === 'month' || period === 'year') && (
            <>
              {period === 'month' && (
                <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS_SHORT.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
          {!myDept && (
            <Select value={deptF || 'all'} onValueChange={(v: string) => { setDeptF(v === 'all' ? '' : v); setEmpF(''); }}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-auto">
            <Button size="sm" variant={sortCol === 'name' && sortDir === 'asc' ? 'default' : 'secondary'} onClick={() => { setSortCol('name'); setSortDir('asc'); }}>A→Z</Button>
            <Button size="sm" variant={sortCol === 'name' && sortDir === 'desc' ? 'default' : 'secondary'} onClick={() => { setSortCol('name'); setSortDir('desc'); }}>Z→A</Button>
          </div>
          <span className="text-xs text-gray-400">{rowCount} records</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {period === 'today' ? `Today — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` :
              period === 'date' ? new Date(specificDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) :
              period === 'week' ? 'This Week' : period === 'month' ? `${MONTHS_FULL[selMonth]} ${selYear}` : `Year ${selYear}`}
            {statusF !== 'all' && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">&middot; {statusF}</span>}
          </h3>
          {statusF !== 'all' && <button onClick={() => setStatusF('all')} className="text-xs text-red-500 hover:underline">Clear filter ✕</button>}
        </div>
        <div className="overflow-x-auto">
          {isToday ? (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="name" label="Employee" /></th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Check In</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Check Out</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide" title="From the approved timesheet for this date — separate from clock-in/out hours">Official Hours</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {sortedToday.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No records for this filter</td></tr>
                ) : sortedToday.map((m, i) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials(m.name)}</div>
                        <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{m.name}</p><p className="text-[10px] text-gray-400">{m.code}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{m.dept}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{m.date}</td>
                    <td className="px-4 py-3">{m.checkIn ? <span className={`text-xs font-mono font-semibold ${m.isLate ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{m.checkIn}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">{m.checkOut ? <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{m.checkOut}</span> : <span className="text-xs text-gray-400">{m.checkIn ? 'Active' : '—'}</span>}</td>
                    <td className="px-4 py-3">{m.officialMinutes ? <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg">{fmtOfficialMinutes(m.officialMinutes)}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                    <td className="px-4 py-3"><Badge variant={m.isLate ? 'warning' : m.status === 'present' ? 'success' : m.status === 'absent' ? 'destructive' : 'default'} className="capitalize">{m.isLate ? 'Late' : m.status.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-400 italic max-w-[160px] truncate" title={m.notes}>{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="name" label="Employee" /></th>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="present" label="Present" /></th>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="absent" label="Absent" /></th>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="late" label="Late" /></th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Half Day</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Avg Hours</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide" title="Summed from approved timesheets in this period — separate from clock-in/out hours">Official Hours</th>
                  <th className="px-4 py-2.5 text-left"><SortBtn col="attPct" label="Att %" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {monthlyLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : sortedPeriod.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No attendance data for this period</td></tr>
                ) : sortedPeriod.map((m, i) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-xs font-bold`}>{initials(m.name)}</div>
                        <div><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{m.name}</p><p className="text-[10px] text-gray-400">{m.code}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">{m.present}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-500">{m.absent}</td>
                    <td className="px-4 py-3 text-sm font-bold text-amber-500">{m.late}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{m.halfDay}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{m.avgHours.toFixed(1)}h</td>
                    <td className="px-4 py-3">{m.officialMinutes ? <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg">{fmtOfficialMinutes(m.officialMinutes)}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                          <div className={`h-full rounded-full ${m.attPct >= 85 ? 'bg-emerald-500' : m.attPct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.attPct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{m.attPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
