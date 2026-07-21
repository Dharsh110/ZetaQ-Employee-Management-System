import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetAllAttendanceQuery } from '../../store/api/attendanceApi';
import { useGetLeavesQuery } from '../../store/api/leavesApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetPayrollQuery } from '../../store/api/payrollApi';
import { useGetAllTimesheetsQuery } from '../../store/api/timesheetsApi';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
type ReportType = 'attendance' | 'leaves' | 'tasks' | 'payroll' | 'timesheets' | 'employees' | 'managers' | 'departments';

const todayStr = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const DATE_KEY: Record<ReportType, string | null> = { attendance: 'Date', leaves: 'Applied', tasks: 'Due', payroll: null, timesheets: 'Date', employees: 'JoinedDate', managers: 'JoinedDate', departments: 'Created' };
const SORT_KEY: Record<ReportType, string> = { attendance: 'Employee', leaves: 'Employee', tasks: 'Task', payroll: 'Employee', timesheets: 'Employee', employees: 'Name', managers: 'Name', departments: 'DeptName' };
// Which column holds the employee/assignee name for each report type — used to drive the
// "filter by employee" dropdown below. null means that report type has no per-employee row.
const EMP_KEY: Record<ReportType, string | null> = { attendance: 'Employee', leaves: 'Employee', tasks: 'Assignee', payroll: 'Employee', timesheets: 'Employee', employees: null, managers: null, departments: null };
const REPORT_TYPES: { id: ReportType; label: string; icon: string }[] = [
  { id: 'attendance', label: 'Attendance', icon: '⏰' }, { id: 'leaves', label: 'Leave Requests', icon: '🗓️' }, { id: 'tasks', label: 'Task Tracker', icon: '📋' },
  { id: 'payroll', label: 'Payroll', icon: '💰' }, { id: 'timesheets', label: 'Timesheets', icon: '🕒' }, { id: 'employees', label: 'Employees', icon: '👥' }, { id: 'managers', label: 'Managers', icon: '🧑‍💼' }, { id: 'departments', label: 'Departments', icon: '🏢' },
];

const downloadCSV = (rows: Record<string, any>[], filename: string) => {
  if (!rows.length) { toast.error('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast.success(`${filename} downloaded!`);
};

const downloadPDF = (rows: Record<string, any>[], title: string) => {
  if (!rows.length) { toast.error('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>
    *{font-family:Arial,sans-serif;box-sizing:border-box} body{margin:0;padding:20px;color:#1f2937;font-size:12px}
    .header{border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px} h1{font-size:18px;color:#1e40af;margin:0 0 4px 0}
    .meta{color:#6b7280;font-size:11px} table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#eff6ff;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #bfdbfe}
    td{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#374151} tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:10px;color:#9ca3af;font-size:10px;text-align:right}
    @media print{@page{margin:1.5cm}body{padding:0}}
  </style></head><body>
    <div class="header"><h1>ZetaQ EMS — ${title}</h1><p class="meta">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;·&nbsp; ${rows.length} records</p></div>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="footer">ZetaQ Technologies Pvt. Ltd. — Confidential</div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=960,height=720');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
};

export default function AdminReports() {
  const [type, setType] = useState<ReportType>('attendance');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | ''>('');
  const [deptDetail, setDeptDetail] = useState<string | null>(null);
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');

  const { data: apiEmployees = [], isFetching: loadingEmp } = useGetEmployeesQuery();
  const { data: apiDepartments = [], isFetching: loadingDept } = useGetDepartmentsQuery();
  // Sourced live from the Departments collection so newly-added departments always appear here.
  const deptNames = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);
  // Full, alphabetically-sorted employee name list — always the complete roster, never truncated —
  // used to populate the "filter by employee" dropdown across every report type.
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees]);
  const { data: apiAttendance = [], isFetching: loadingAtt } = useGetAllAttendanceQuery();
  const { data: apiLeaves = [], isFetching: loadingLv } = useGetLeavesQuery();
  const { data: apiTasks = [], isFetching: loadingTk } = useGetTasksQuery();
  const { data: apiPayroll = [], isFetching: loadingPr } = useGetPayrollQuery();
  const { data: apiTimesheets = [], isFetching: loadingTs } = useGetAllTimesheetsQuery();

  const loading = { attendance: loadingAtt, leaves: loadingLv, tasks: loadingTk, payroll: loadingPr, timesheets: loadingTs, employees: loadingEmp, managers: loadingEmp, departments: loadingDept }[type];

  const data: Record<string, any>[] = useMemo(() => {
    if (type === 'attendance') return apiAttendance.map((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      return { Employee: emp ? `${emp.firstName} ${emp.lastName}` : '—', Code: emp?.employeeCode || '—', Department: emp?.department && typeof emp.department === 'object' ? emp.department.name : '—', Date: r.date?.slice(0, 10) || '—', CheckIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—', CheckOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—', Hours: r.totalHours ? `${r.totalHours.toFixed(2)}h` : '—', Status: r.status || '—' };
    });
    if (type === 'leaves') return apiLeaves.map((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      return { Employee: emp ? `${emp.firstName} ${emp.lastName}` : '—', Department: emp?.department && typeof emp.department === 'object' ? emp.department.name : '—', Type: r.leaveType || '—', From: r.fromDate?.slice(0, 10) || '—', To: r.toDate?.slice(0, 10) || '—', Days: r.totalDays ?? '—', Status: r.status || '—', Applied: r.appliedAt?.slice(0, 10) || '—' };
    });
    if (type === 'tasks') return apiTasks.map((r) => {
      const a = typeof r.assignedTo === 'object' ? r.assignedTo : null;
      const deptName = typeof r.department === 'object' && r.department ? r.department.name : (a?.department && typeof a.department === 'object' ? a.department.name : '—');
      return { Task: r.title || '—', Assignee: a ? `${a.firstName} ${a.lastName}` : '—', Department: deptName, Priority: r.priority || '—', Due: r.dueDate?.slice(0, 10) || '—', Status: r.status || '—' };
    });
    if (type === 'payroll') return apiPayroll.map((r) => {
      const emp = typeof r.employee === 'object' ? r.employee : null;
      return { Employee: emp ? `${emp.firstName} ${emp.lastName}` : '—', Code: emp?.employeeCode || '—', Department: emp?.department && typeof emp.department === 'object' ? emp.department.name : '—', Basic: `₹${(r.basicSalary ?? 0).toLocaleString('en-IN')}`, HRA: `₹${(r.allowances?.hra ?? 0).toLocaleString('en-IN')}`, Deduction: `₹${(r.totalDeductions ?? 0).toLocaleString('en-IN')}`, NetPay: `₹${(r.netSalary ?? 0).toLocaleString('en-IN')}`, Period: `${MOS[r.month - 1]} ${r.year}`, Status: r.status, PaidOn: r.paidAt?.slice(0, 10) || '—' };
    });
    if (type === 'timesheets') return apiTimesheets.map((t) => {
      const emp = typeof t.employee === 'object' ? t.employee : null;
      const dept = emp?.department && typeof emp.department === 'object' ? emp.department.name : (typeof emp?.department === 'string' ? emp.department : '—');
      return { Employee: emp ? `${emp.firstName} ${emp.lastName}` : '—', Code: emp?.employeeCode || '—', Department: dept, Date: t.date?.slice(0, 10) || '—', Entries: t.entries.length, TotalHours: `${(t.totalMinutes / 60).toFixed(2)}h`, Status: t.status.replace(/_/g, ' '), SubmittedOn: t.submittedAt?.slice(0, 10) || '—', ApprovedBy: typeof t.approvedBy === 'object' ? t.approvedBy?.name || '—' : '—' };
    });
    if (type === 'employees' || type === 'managers') {
      // 'managers' must only include manager-role accounts — without this filter it
      // silently rendered the exact same rows as 'employees'.
      const rows = type === 'managers' ? apiEmployees.filter((e) => e.role === 'manager') : apiEmployees;
      return rows.map((e) => ({ Name: `${e.firstName} ${e.lastName}`, Department: typeof e.department === 'object' ? e.department?.name || '—' : e.department || '—', EmpID: e.employeeCode, Designation: e.designation || '—', Phone: e.phone || '—', Type: e.employmentType, JoinedDate: e.joiningDate?.slice(0, 10) || '—', Salary: e.salary ? `₹${e.salary.toLocaleString('en-IN')}` : '—' }));
    }
    if (type === 'departments') return apiDepartments.map((d) => ({ DeptName: d.name, Head: typeof d.head === 'object' && d.head ? `${d.head.firstName} ${d.head.lastName}` : '—', ActiveEmployees: d.employeeCount ?? 0, Created: d.createdAt?.slice(0, 10) || '—' }));
    return [];
  }, [type, apiAttendance, apiLeaves, apiTasks, apiPayroll, apiTimesheets, apiEmployees, apiDepartments]);

  const deptEmps = useMemo(() => {
    if (!deptDetail) return [];
    return apiEmployees.filter((e) => (typeof e.department === 'object' ? e.department?.name : e.department) === deptDetail).map((e) => ({ Name: `${e.firstName} ${e.lastName}`, EmpID: e.employeeCode, Designation: e.designation || '—', Phone: e.phone || '—', Type: e.employmentType, JoinedDate: e.joiningDate?.slice(0, 10) || '—' }));
  }, [deptDetail, apiEmployees]);

  const filterRows = (rows: Record<string, any>[]) => {
    let r = rows;
    if (deptF && type !== 'departments') r = r.filter((row) => row.Department === deptF);
    const ek = EMP_KEY[type];
    if (empF && ek) r = r.filter((row) => row[ek] === empF);
    if (period === 'all') return r;
    const dk = DATE_KEY[type];
    if (!dk) return r;
    return r.filter((row) => {
      const d = row[dk];
      if (!d || d === '—') return false;
      if (period === 'today') return d === todayStr;
      if (period === 'week') return d >= weekAgo && d <= todayStr;
      if (period === 'month') { const dt = new Date(d); return dt.getMonth() === selMonth && dt.getFullYear() === selYear; }
      if (period === 'year') return new Date(d).getFullYear() === selYear;
      return true;
    });
  };

  const rows = useMemo(() => {
    let r = filterRows(data);
    if (nameSort) {
      const sk = SORT_KEY[type];
      r = [...r].sort((a, b) => (nameSort === 'asc' ? String(a[sk] || '').localeCompare(String(b[sk] || '')) : String(b[sk] || '').localeCompare(String(a[sk] || ''))));
    }
    return r;
  }, [data, type, period, selMonth, selYear, nameSort, deptF, empF]);

  const headers = data.length ? Object.keys(data[0]) : [];
  const rt = REPORT_TYPES.find((r) => r.id === type)!;
  const title = `${rt.label} Report`;
  const filename = `zetaq_${type}_${period === 'month' ? MOS[selMonth] + '_' + selYear : period === 'year' ? selYear : period}_report`;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => (
            <Button key={r.id} variant={type === r.id ? 'default' : 'outline'} size="sm" onClick={() => { setType(r.id); setPeriod('all'); setEmpF(''); }}>{r.icon} {r.label}</Button>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'today', 'week', 'month', 'year'] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} onClick={() => setPeriod(p)}>{p === 'all' ? 'All Time' : p === 'week' ? 'This Week' : p}</Button>
            ))}
            {period === 'month' && <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>}
            {(period === 'month' || period === 'year') && <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>}
            {type !== 'departments' && (
              <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Departments</SelectItem>{deptNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {EMP_KEY[type] && (
              <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">Sort:</span>
              {(['asc', 'desc'] as const).map((d) => <Button key={d} size="sm" variant={nameSort === d ? 'default' : 'secondary'} onClick={() => setNameSort((p) => (p === d ? '' : d))}>{d === 'asc' ? 'A→Z' : 'Z→A'}</Button>)}
            </div>
            <span className="text-xs text-gray-400 ml-1">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => downloadCSV(rows, `${filename}.csv`)}>Excel</Button>
              <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => downloadPDF(rows, title)}>PDF</Button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <span className="text-base">{rt.icon}</span>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
            <span className="text-xs text-gray-400">— {period === 'all' ? 'All Time' : period === 'month' ? `${MOS[selMonth]} ${selYear}` : period === 'year' ? `Year ${selYear}` : period}</span>
            {loading && <span className="ml-auto text-xs text-gray-400 animate-pulse">Loading…</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {headers.map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                  {type === 'departments' && <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                  <tr><td colSpan={Math.max(headers.length, 1)} className="px-4 py-12 text-center"><p className="text-sm text-gray-400 animate-pulse">Loading {rt.label.toLowerCase()}…</p></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={Math.max(headers.length, 1)} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2"><span className="text-3xl">{rt.icon}</span><p className="text-sm font-medium text-gray-500 dark:text-gray-400">No {rt.label.toLowerCase()} data found</p></div></td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {headers.map((h) => <td key={h} className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{String(r[h] ?? '—')}</td>)}
                    {type === 'departments' && <td className="px-4 py-2.5"><Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setDeptDetail(r['DeptName'] || '')}>View</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!deptDetail} onOpenChange={(o: boolean) => !o && setDeptDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{deptDetail} Department — Employees ({deptEmps.length})</DialogTitle></DialogHeader>
          <DialogBody>
            {deptEmps.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No employees found in {deptDetail}</p> : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700">{Object.keys(deptEmps[0]).map((h) => <th key={h} className="pb-2 text-left font-semibold text-gray-500 dark:text-gray-400 pr-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">{deptEmps.map((e, i) => <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">{Object.values(e).map((v, j) => <td key={j} className="py-2 pr-3 text-gray-700 dark:text-gray-300">{String(v ?? '—')}</td>)}</tr>)}</tbody>
              </table>
            )}
          </DialogBody>
          <DialogFooter>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => downloadCSV(deptEmps, `${deptDetail}_employees.csv`)}>Excel</Button>
            <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => downloadPDF(deptEmps, `${deptDetail} Department — Employees`)}>PDF</Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDeptDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
