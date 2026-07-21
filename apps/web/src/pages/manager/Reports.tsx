import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useGetAllAttendanceQuery } from '../../store/api/attendanceApi';
import { useGetLeavesQuery } from '../../store/api/leavesApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayStr = new Date().toISOString().slice(0, 10);

type ReportTab = 'attendance' | 'leave' | 'task' | 'assigned' | 'members';
type Period = 'all' | 'today' | 'week' | 'month' | 'year';
type SortDir = 'asc' | 'desc';

const dlCSV = (rows: string[][], filename: string) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(', ')).join('\r\n');
  const b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const u = URL.createObjectURL(b);
  const a = Object.assign(document.createElement('a'), { href: u, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};

const dlPDF = (rows: string[][], headers: string[], title: string) => {
  const trHtml = rows.map((r) => `<tr>${r.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111827;font-size:12px}
h2{font-size:18px;font-weight:700;margin-bottom:4px;color:#1e40af} .meta{font-size:10px;color:#6b7280;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:11px} thead tr{background:#1e40af} th{color:#fff;padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap}
td{padding:6px 10px;border-bottom:1px solid #e5e7eb} tr:nth-child(even) td{background:#f9fafb} @media print{@page{margin:15mm}}</style></head><body>
<h2>${title}</h2><p class="meta">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;·&nbsp; ${rows.length} records</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trHtml}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const getWeekRange = () => {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
};

type AttRow = { date: string; name: string; code: string; dept: string; checkIn: string; checkOut: string; hours: number; status: string };
type LeaveRow = { date: string; name: string; dept: string; type: string; from: string; to: string; days: number; status: string };
type TaskRow = { date: string; name: string; dept: string; title: string; status: string; progress: number; due: string };
type AssignRow = { assignedOn: string; name: string; dept: string; title: string; priority: string; due: string };
type MemberRow = { code: string; name: string; dept: string; designation: string; joining: string; status: string };

const deptOfEmp = (e: { department?: { name: string } | string } | null) => (e ? (typeof e.department === 'object' ? e.department?.name : e.department) || '—' : '—');

export default function ManagerReports() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';
  const [tab, setTab] = useState<ReportTab>('attendance');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [sort, setSort] = useState<{ col: string; dir: SortDir }>({ col: 'date', dir: 'desc' });
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const effDept = myDept || deptF;

  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!myDept });
  const { data: apiAttendance = [], isFetching: loadingAtt } = useGetAllAttendanceQuery(myDept ? { department: myDept } : undefined);
  const { data: apiLeaves = [], isFetching: loadingLv } = useGetLeavesQuery({ department: myDept });
  const { data: apiTasks = [], isFetching: loadingTk } = useGetTasksQuery({ department: myDept });
  const { data: apiEmployees = [], isFetching: loadingEmp } = useGetEmployeesQuery();
  const loading = loadingAtt || loadingLv || loadingTk || loadingEmp;
  // Full alphabetical roster (scoped to the manager's team when applicable) for the
  // "filter by employee" dropdown — never truncated.
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.filter((e) => !effDept || (typeof e.department === 'object' ? e.department?.name : e.department) === effDept).map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees, effDept]);

  const attRows: AttRow[] = useMemo(() => apiAttendance.map((r) => {
    const emp = typeof r.employee === 'object' ? r.employee : null;
    return { date: r.date?.slice(0, 10) || '—', name: emp ? `${emp.firstName} ${emp.lastName}` : '—', code: emp?.employeeCode || '—', dept: deptOfEmp(emp), checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--', checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--', hours: r.totalHours || 0, status: r.status || '—' };
  }), [apiAttendance]);

  const leaveRows: LeaveRow[] = useMemo(() => apiLeaves.map((r) => {
    const emp = typeof r.employee === 'object' ? r.employee : null;
    return { date: r.appliedAt?.slice(0, 10) || '—', name: emp ? `${emp.firstName} ${emp.lastName}` : '—', dept: deptOfEmp(emp), type: r.leaveType || '—', from: r.fromDate?.slice(0, 10) || '—', to: r.toDate?.slice(0, 10) || '—', days: r.totalDays || 0, status: r.status || '—' };
  }), [apiLeaves]);

  const taskDept = (r: { department?: { name: string } | string; assignedTo: any }) => {
    if (typeof r.department === 'object' && r.department) return r.department.name;
    if (typeof r.department === 'string' && r.department) return r.department;
    const a = typeof r.assignedTo === 'object' ? r.assignedTo : null;
    return deptOfEmp(a);
  };

  const taskRows: TaskRow[] = useMemo(() => apiTasks.map((r) => {
    const a = typeof r.assignedTo === 'object' ? r.assignedTo : null;
    return { date: r.createdAt?.slice(0, 10) || '—', name: a ? `${a.firstName} ${a.lastName}` : '—', dept: taskDept(r), title: r.title, status: r.status, progress: r.status === 'completed' ? 100 : r.status === 'in_progress' ? 50 : 0, due: r.dueDate?.slice(0, 10) || '—' };
  }), [apiTasks]);

  const assignRows: AssignRow[] = useMemo(() => apiTasks.map((r) => {
    const a = typeof r.assignedTo === 'object' ? r.assignedTo : null;
    return { assignedOn: r.createdAt?.slice(0, 10) || '—', name: a ? `${a.firstName} ${a.lastName}` : '—', dept: taskDept(r), title: r.title, priority: r.priority, due: r.dueDate?.slice(0, 10) || '—' };
  }), [apiTasks]);

  const members: MemberRow[] = useMemo(() => apiEmployees.filter((e) => !effDept || (typeof e.department === 'object' ? e.department?.name : e.department) === effDept).filter((e) => !empF || `${e.firstName} ${e.lastName}` === empF).map((e) => ({ code: e.employeeCode, name: `${e.firstName} ${e.lastName}`, dept: typeof e.department === 'object' ? e.department?.name || '—' : e.department || '—', designation: e.designation || '—', joining: e.joiningDate?.slice(0, 10) || '—', status: e.status })), [apiEmployees, effDept, empF]);

  const toggleSort = (col: string) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  const inPeriod = (dateStr: string) => {
    if (period === 'all') return true;
    if (!dateStr || dateStr === '—') return false;
    const wr = getWeekRange();
    if (period === 'today') return dateStr === todayStr;
    if (period === 'week') return dateStr >= wr.from && dateStr <= wr.to;
    if (period === 'month') return new Date(dateStr).getMonth() === selMonth && new Date(dateStr).getFullYear() === selYear;
    if (period === 'year') return new Date(dateStr).getFullYear() === selYear;
    return true;
  };
  const sorted = <T extends Record<string, any>>(arr: T[]): T[] => {
    const col = sort.col;
    return [...arr].sort((a, b) => {
      const va = a[col] ?? '', vb = b[col] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  };

  const filtAtt = useMemo(() => sorted(attRows.filter((r) => inPeriod(r.date) && (!effDept || r.dept === effDept) && (!empF || r.name === empF))), [attRows, period, selMonth, selYear, sort, effDept, empF]);
  const filtLeave = useMemo(() => sorted(leaveRows.filter((r) => inPeriod(r.date) && (!effDept || r.dept === effDept) && (!empF || r.name === empF))), [leaveRows, period, selMonth, selYear, sort, effDept, empF]);
  const filtTask = useMemo(() => sorted(taskRows.filter((r) => inPeriod(r.date) && (!effDept || r.dept === effDept) && (!empF || r.name === empF))), [taskRows, period, selMonth, selYear, sort, effDept, empF]);
  const filtAssign = useMemo(() => sorted(assignRows.filter((r) => inPeriod(r.assignedOn) && (!effDept || r.dept === effDept) && (!empF || r.name === empF))), [assignRows, period, selMonth, selYear, sort, effDept, empF]);

  const doCSV = () => {
    const genDate = new Date().toISOString().slice(0, 10);
    if (tab === 'attendance') dlCSV([['Report Date', 'Date', 'Emp Code', 'Employee', 'Check-In', 'Check-Out', 'Hours', 'Status'], ...filtAtt.map((r) => [genDate, r.date, r.code, r.name, r.checkIn, r.checkOut, r.hours > 0 ? r.hours.toFixed(2) + 'h' : '0h', r.status])], 'attendance_report.csv');
    if (tab === 'leave') dlCSV([['Report Date', 'Applied On', 'Employee', 'Type', 'From', 'To', 'Days', 'Status'], ...filtLeave.map((r) => [genDate, r.date, r.name, r.type, r.from, r.to, String(r.days) + 'd', r.status])], 'leave_report.csv');
    if (tab === 'task') dlCSV([['Report Date', 'Date', 'Employee', 'Task', 'Status', 'Progress', 'Due'], ...filtTask.map((r) => [genDate, r.date, r.name, r.title, r.status.replace(/_/g, ' '), r.progress + '%', r.due])], 'task_report.csv');
    if (tab === 'assigned') dlCSV([['Report Date', 'Assigned On', 'Employee', 'Task', 'Priority', 'Due'], ...filtAssign.map((r) => [genDate, r.assignedOn, r.name, r.title, r.priority, r.due])], 'assigned_tasks.csv');
    if (tab === 'members') dlCSV([['Report Date', 'Code', 'Name', 'Department', 'Designation', 'Joining Date', 'Status'], ...members.map((m) => [genDate, m.code, m.name, m.dept, m.designation, m.joining, m.status])], 'team_members.csv');
    toast.success('CSV downloaded');
  };

  const doPDF = () => {
    if (tab === 'attendance') dlPDF(filtAtt.map((r) => [r.date, r.name, r.checkIn, r.checkOut, r.hours > 0 ? r.hours.toFixed(2) + 'h' : '—', r.status]), ['Date', 'Employee', 'Check In', 'Check Out', 'Hours', 'Status'], 'Team Attendance Report');
    if (tab === 'leave') dlPDF(filtLeave.map((r) => [r.date, r.name, r.type, r.from, r.to, r.days + 'd', r.status]), ['Applied On', 'Employee', 'Type', 'From', 'To', 'Days', 'Status'], 'Leave Report');
    if (tab === 'task') dlPDF(filtTask.map((r) => [r.date, r.name, r.title, r.status.replace('_', ' '), r.progress + '%', r.due]), ['Date', 'Employee', 'Task', 'Status', 'Progress', 'Due'], 'Task Report');
    if (tab === 'assigned') dlPDF(filtAssign.map((r) => [r.assignedOn, r.name, r.title, r.priority, r.due]), ['Assigned On', 'Employee', 'Task', 'Priority', 'Due Date'], 'Assigned Tasks');
    if (tab === 'members') dlPDF(members.map((m) => [m.code, m.name, m.dept, m.designation, m.joining, m.status]), ['Code', 'Name', 'Department', 'Designation', 'Joining Date', 'Status'], 'Team Members');
    toast.success('PDF report opening…');
  };

  const TABS: { v: ReportTab; l: string }[] = [{ v: 'attendance', l: 'Attendance' }, { v: 'leave', l: 'Leave' }, { v: 'task', l: 'Tasks' }, { v: 'assigned', l: 'Assigned' }, { v: 'members', l: 'Team Members' }];
  const SortBtn = ({ col, label }: { col: string; label: string }) => (
    <button onClick={() => toggleSort(col)} className="flex items-center gap-0.5 hover:text-blue-500 whitespace-nowrap">{label}<span className="text-[9px] opacity-60 ml-0.5">{sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></button>
  );
  const TH = ({ col, label }: { col: string; label: string }) => <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><SortBtn col={col} label={label} /></th>;
  const currentCount = tab === 'attendance' ? filtAtt.length : tab === 'leave' ? filtLeave.length : tab === 'task' ? filtTask.length : tab === 'assigned' ? filtAssign.length : members.length;
  const EmptyRow = ({ cols }: { cols: number }) => <tr><td colSpan={cols} className="py-10 text-center"><p className="text-sm text-gray-400">No data found</p></td></tr>;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => <Button key={t.v} size="sm" variant={tab === t.v ? 'default' : 'secondary'} onClick={() => { setTab(t.v); setSort({ col: 'date', dir: 'desc' }); }}>{t.l}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(['all', 'today', 'week', 'month', 'year'] as Period[]).map((p) => <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} className="capitalize" onClick={() => setPeriod(p)}>{p}</Button>)}
            {period === 'month' && <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>}
            {(period === 'month' || period === 'year') && <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>}
            {!myDept && (
              <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{loading ? 'Loading…' : `${currentCount} record${currentCount !== 1 ? 's' : ''}`}</span>
        <div className="flex gap-2">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={doCSV}>⬇ Export CSV</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={doPDF}>⬇ Export PDF</Button>
        </div>
      </div>

      {tab === 'attendance' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><TH col="date" label="Date" /><TH col="name" label="Employee" /><TH col="code" label="Code" /><TH col="checkIn" label="Check In" /><TH col="checkOut" label="Check Out" /><TH col="hours" label="Hours" /><TH col="status" label="Status" /></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtAtt.length === 0 ? <EmptyRow cols={7} /> : filtAtt.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-200">{r.name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{r.code}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.checkIn}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.checkOut}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.hours > 0 ? r.hours.toFixed(2) + 'h' : '—'}</td>
                  <td className="px-3 py-2.5"><Badge variant={r.status === 'present' ? 'success' : r.status === 'absent' ? 'destructive' : 'warning'} className="capitalize">{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {tab === 'leave' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><TH col="date" label="Applied On" /><TH col="name" label="Employee" /><TH col="type" label="Type" /><TH col="from" label="From" /><TH col="to" label="To" /><TH col="days" label="Days" /><TH col="status" label="Status" /></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtLeave.length === 0 ? <EmptyRow cols={7} /> : filtLeave.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-200">{r.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 capitalize">{r.type}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.from}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.to}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300">{r.days}d</td>
                  <td className="px-3 py-2.5"><Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : r.status === 'pending' ? 'warning' : 'gray'} className="capitalize">{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {tab === 'task' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><TH col="date" label="Date" /><TH col="name" label="Employee" /><TH col="title" label="Task" /><TH col="status" label="Status" /><TH col="progress" label="Progress" /><TH col="due" label="Due Date" /></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtTask.length === 0 ? <EmptyRow cols={6} /> : filtTask.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-200">{r.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 max-w-[140px] truncate">{r.title}</td>
                  <td className="px-3 py-2.5"><Badge variant={r.status === 'completed' ? 'success' : r.status === 'overdue' ? 'destructive' : r.status === 'in_progress' ? 'warning' : 'gray'} className="capitalize">{r.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><div className="w-14 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.progress}%` }} /></div><span className="text-[10px] text-gray-400">{r.progress}%</span></div></td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.due}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {tab === 'assigned' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><TH col="assignedOn" label="Assigned On" /><TH col="name" label="Employee" /><TH col="title" label="Task" /><TH col="priority" label="Priority" /><TH col="due" label="Due Date" /></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtAssign.length === 0 ? <EmptyRow cols={5} /> : filtAssign.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.assignedOn}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-200">{r.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 max-w-[140px] truncate">{r.title}</td>
                  <td className="px-3 py-2.5"><Badge variant={r.priority === 'urgent' ? 'destructive' : r.priority === 'high' ? 'warning' : r.priority === 'medium' ? 'default' : 'gray'} className="capitalize">{r.priority}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.due}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {tab === 'members' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500">{members.length} members &middot; {myDept || 'All Departments'}</p></div>
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><TH col="code" label="Code" /><TH col="name" label="Name" /><TH col="dept" label="Department" /><TH col="designation" label="Designation" /><TH col="joining" label="Joining Date" /><TH col="status" label="Status" /></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {members.length === 0 ? <EmptyRow cols={6} /> : sorted(members).map((m, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-600 dark:text-gray-400">{m.code}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-200">{m.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{m.dept}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{m.designation}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{m.joining}</td>
                  <td className="px-3 py-2.5"><Badge variant={m.status === 'active' ? 'success' : 'gray'} className="capitalize">{m.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
