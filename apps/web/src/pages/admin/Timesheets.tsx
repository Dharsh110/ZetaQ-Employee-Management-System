import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetAllTimesheetsQuery, useGetTimesheetSummaryQuery, type ApiTimesheet, type TimesheetStatus } from '../../store/api/timesheetsApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const STATUS_LABEL: Record<TimesheetStatus, string> = { draft: 'Draft', pending_approval: 'Pending Approval', approved: 'Approved', rejected: 'Rejected' };
const STATUS_VARIANT: Record<TimesheetStatus, 'gray' | 'warning' | 'success' | 'destructive'> = { draft: 'gray', pending_approval: 'warning', approved: 'success', rejected: 'destructive' };
const fmtHours = (m: number) => (m / 60).toFixed(2) + 'h';
const empName = (t: ApiTimesheet) => (typeof t.employee === 'object' ? `${t.employee.firstName} ${t.employee.lastName}` : 'Employee');
const empCode = (t: ApiTimesheet) => (typeof t.employee === 'object' ? t.employee.employeeCode || '' : '');
const empDept = (t: ApiTimesheet) => (typeof t.employee === 'object' && t.employee.department && typeof t.employee.department === 'object' ? t.employee.department.name : '');

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

const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const todayStr = new Date().toISOString().slice(0, 10);
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const deptOf = (e: { department?: { name: string } | string }) => (typeof e.department === 'object' ? e.department?.name : e.department) || '';

export default function AdminTimesheets() {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(todayStr);
  const [yearF, setYearF] = useState('');
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const [statusF, setStatusF] = useState<TimesheetStatus | ''>('');
  const [viewT, setViewT] = useState<ApiTimesheet | null>(null);

  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const DEPTS = apiDepartments.map((d) => d.name);
  // Narrowed to the selected department (if any) so the employee list always cascades with it.
  const empOptions = useMemo(() => apiEmployees.filter((e) => !deptF || deptOf(e) === deptF), [apiEmployees, deptF]);

  const rangeFrom = yearF ? `${yearF}-01-01` : from;
  const rangeTo = yearF ? `${yearF}-12-31` : to;
  const filterArg = { from: rangeFrom, to: rangeTo, department: deptF || undefined, employeeId: empF || undefined, status: statusF || undefined };
  const { data: summary } = useGetTimesheetSummaryQuery(filterArg);
  const { data: timesheets = [], isLoading } = useGetAllTimesheetsQuery(filterArg);

  const rows = useMemo(() => [...timesheets].sort((a, b) => b.date.localeCompare(a.date)), [timesheets]);

  const exportRows = rows.map((t) => ({
    Employee: empName(t), Code: empCode(t), Department: empDept(t), Date: t.date.slice(0, 10),
    Tasks: t.entries.length, Hours: fmtHours(t.totalMinutes), Status: STATUS_LABEL[t.status],
    ApprovedBy: typeof t.approvedBy === 'object' ? t.approvedBy?.name || '' : '', RejectionReason: t.rejectionReason || '',
  }));

  const cards = [
    { label: 'Approved Hours', value: (summary?.approvedHours ?? 0).toFixed(2) + 'h', sub: `${summary?.approvedCount ?? 0} timesheets`, cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600', status: 'approved' as TimesheetStatus | '' },
    { label: 'Pending Hours', value: (summary?.pendingHours ?? 0).toFixed(2) + 'h', sub: `${summary?.pendingCount ?? 0} timesheets`, cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600', status: 'pending_approval' as TimesheetStatus | '' },
    { label: 'Rejected Hours', value: (summary?.rejectedHours ?? 0).toFixed(2) + 'h', sub: `${summary?.rejectedCount ?? 0} timesheets`, cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500', status: 'rejected' as TimesheetStatus | '' },
    { label: 'Total Timesheets', value: String(summary?.totalCount ?? 0), sub: 'in selected range', cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600', status: '' as TimesheetStatus | '' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button key={c.label} onClick={() => setStatusF(c.status)} className={`text-left border rounded-2xl p-4 hover:shadow-md transition-all ${c.cls} ${statusF === c.status ? 'ring-2 ring-current' : ''}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-semibold mt-0.5">{c.label}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-end gap-2">
        <div><Label className="text-[10px]">From</Label><Input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setYearF(''); }} className="h-8 text-xs w-36" /></div>
        <div><Label className="text-[10px]">To</Label><Input type="date" value={to} max={todayStr} onChange={(e) => { setTo(e.target.value); setYearF(''); }} className="h-8 text-xs w-36" /></div>
        <div>
          <Label className="text-[10px]">Year</Label>
          <Select value={yearF || 'all'} onValueChange={(v: string) => setYearF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Any</SelectItem>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Department</Label>
          <Select value={deptF || 'all'} onValueChange={(v: string) => { setDeptF(v === 'all' ? '' : v); setEmpF(''); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Employee</Label>
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Employees</SelectItem>{empOptions.map((e) => <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Status</Label>
          <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v as TimesheetStatus)}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-gray-400 ml-1">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => downloadCSV(exportRows, 'timesheets_report.csv')}>Excel</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => downloadPDF(exportRows, 'Timesheet Report')}>PDF</Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>{['Employee', 'Department', 'Date', 'Tasks', 'Hours', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No timesheets found for this filter</td></tr>
              ) : rows.map((t) => (
                <tr key={t._id} onClick={() => setViewT(t)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{empName(t)}</p><p className="text-[10px] text-gray-400">{empCode(t)}</p></td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{empDept(t)}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{t.date.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{t.entries.length}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-300">{fmtHours(t.totalMinutes)}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{(e.timeSpentMinutes / 60).toFixed(2)}h</span>
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
    </div>
  );
}
