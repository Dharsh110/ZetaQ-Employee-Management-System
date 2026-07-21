import { useMemo, useState } from 'react';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetTodayQuery, useGetAllAttendanceQuery } from '../../store/api/attendanceApi';
import { mapApiAttendanceToRow, attendanceColumns, type AttStatus } from './attendance-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayStr = new Date().toISOString().slice(0, 10);
const deptOf = (e: { department?: { name: string } | string }) => (typeof e.department === 'object' ? e.department?.name : e.department) || '';

type Period = 'today' | 'week' | 'month' | 'year' | 'date';
type AttTab = 'employee' | 'manager';

export default function AdminAttendance() {
  const [attTab, setAttTab] = useState<AttTab>('employee');
  const [period, setPeriod] = useState<Period>('today');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [specificDate, setSpecificDate] = useState(todayStr);
  const [statusF, setStatusF] = useState('');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');

  // Sourced live from the Departments collection so newly-added departments show up here automatically.
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const deptNames = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);
  // Full alphabetical roster, narrowed to the selected department (if any) and to the
  // current tab's role (employee vs manager), for the "filter by employee" dropdown —
  // never truncated, and always cascades with Department.
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const empNames = useMemo(
    () => Array.from(new Set(apiEmployees
      .filter((e) => (attTab === 'manager' ? e.role === 'manager' : e.role !== 'manager'))
      .filter((e) => !deptF || deptOf(e) === deptF)
      .map((e) => `${e.firstName} ${e.lastName}`)))
      .sort((a, b) => a.localeCompare(b)),
    [apiEmployees, deptF, attTab]
  );

  const isDayMode = period === 'today' || period === 'date';
  const todayQuery = useGetTodayQuery({ date: period === 'date' ? specificDate : todayStr, role: attTab }, { skip: !isDayMode });
  // Week/Month/Year need real per-day records (date/checkIn/checkOut/status) — the
  // monthly-report endpoint is a pre-aggregated per-employee summary and has none of
  // those fields, so it's the wrong source here (see MonthlyAttendanceRow).
  const periodRange = useMemo(() => {
    if (period === 'week') { const from = new Date(Date.now() - 7 * 864e5); return { from: from.toISOString().slice(0, 10), to: todayStr }; }
    if (period === 'month') { const from = new Date(selYear, selMonth, 1); const to = new Date(selYear, selMonth + 1, 0); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; }
    if (period === 'year') { return { from: `${selYear}-01-01`, to: `${selYear}-12-31` }; }
    return { from: todayStr, to: todayStr };
  }, [period, selMonth, selYear]);
  const rangeQuery = useGetAllAttendanceQuery({ role: attTab, from: periodRange.from, to: periodRange.to, limit: 5000 }, { skip: isDayMode });

  const isLoading = isDayMode ? todayQuery.isLoading : rangeQuery.isLoading;
  const rawRecords = isDayMode ? todayQuery.data?.records ?? [] : rangeQuery.data ?? [];
  const baseRecords = useMemo(() => rawRecords.map(mapApiAttendanceToRow), [rawRecords]);

  const filtered = baseRecords.filter((r) => (!statusF || (statusF === 'Late' ? r.isLate : r.status === statusF)) && (!deptF || r.dept === deptF) && (!empF || r.name === empF));

  const present = filtered.filter((r) => r.status === 'Present').length;
  // `late` is an independent flag layered on top of `status`, not a separate
  // exclusive bucket — a late arrival is still counted in `present` above.
  const late = filtered.filter((r) => r.isLate).length;
  const absent = filtered.filter((r) => r.status === 'Absent').length;
  const halfday = filtered.filter((r) => r.status === 'Half Day').length;
  const total = filtered.length;
  const attRate = total ? Math.round(((present + halfday) / total) * 100) : 0;

  const periodLabel = { today: 'Today', week: 'This Week', month: `${MOS[selMonth]} ${selYear}`, year: `Year ${selYear}`, date: specificDate }[period];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={attTab === 'employee' ? 'default' : 'outline'} onClick={() => { setAttTab('employee'); setStatusF(''); setDeptF(''); setEmpF(''); }}>
          Employee Attendance
        </Button>
        <Button variant={attTab === 'manager' ? 'default' : 'outline'} onClick={() => { setAttTab('manager'); setStatusF(''); setDeptF(''); setEmpF(''); }}>
          Manager Attendance
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(['today', 'week', 'month', 'year'] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} onClick={() => setPeriod(p)} className="capitalize">
                {p === 'week' ? 'This Week' : p === 'today' ? 'Today' : p}
              </Button>
            ))}
          </div>
          <Input type="date" value={specificDate} max={todayStr} onChange={(e) => { setSpecificDate(e.target.value); setPeriod('date'); }} className={`h-8 w-36 text-xs ${period === 'date' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`} />
          {period === 'month' && (
            <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {(period === 'month' || period === 'year') && (
            <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(['Present', 'Late', 'Absent', 'Half Day'] as AttStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deptF || 'all'} onValueChange={(v: string) => { setDeptF(v === 'all' ? '' : v); setEmpF(''); }}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Depts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Depts</SelectItem>
              {deptNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={attTab === 'manager' ? 'All Managers' : 'All Employees'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{attTab === 'manager' ? 'All Managers' : 'All Employees'}</SelectItem>
              {empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button onClick={() => setStatusF('')} className={`bg-white dark:bg-gray-800 border rounded-2xl p-3.5 text-center hover:shadow-md transition-all ${statusF === '' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Total — {periodLabel}</p>
          <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${attRate}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">{attRate}% attendance</p>
        </button>
        <button onClick={() => setStatusF('Present')} className={`bg-emerald-50 dark:bg-emerald-900/20 border rounded-2xl p-3.5 text-center hover:shadow-md transition-all ${statusF === 'Present' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-emerald-200 dark:border-emerald-800'}`}>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{present}</p>
          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">Present</p>
        </button>
        <button onClick={() => setStatusF('Late')} className={`bg-amber-50 dark:bg-amber-900/20 border rounded-2xl p-3.5 text-center hover:shadow-md transition-all ${statusF === 'Late' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-200 dark:border-amber-800'}`}>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{late}</p>
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">Late</p>
        </button>
        <button onClick={() => setStatusF('Absent')} className={`bg-red-50 dark:bg-red-900/20 border rounded-2xl p-3.5 text-center hover:shadow-md transition-all ${statusF === 'Absent' ? 'border-red-500 ring-1 ring-red-500' : 'border-red-200 dark:border-red-800'}`}>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400">{absent}</p>
          <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 mt-0.5">Absent</p>
        </button>
        <button onClick={() => setStatusF('Half Day')} className={`bg-blue-50 dark:bg-blue-900/20 border rounded-2xl p-3.5 text-center hover:shadow-md transition-all ${statusF === 'Half Day' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-blue-200 dark:border-blue-800'}`}>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{halfday}</p>
          <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">Half Day</p>
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''} — {periodLabel}</p>
      <DataTable columns={attendanceColumns} data={filtered} isLoading={isLoading} emptyMessage={attTab === 'manager' ? 'No manager attendance records found' : 'No attendance records found'} />
    </div>
  );
}
