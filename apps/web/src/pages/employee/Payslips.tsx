import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetMyPayslipsQuery } from '../../store/api/payrollApi';
import { useGetMyProfileQuery } from '../../store/api/employeesApi';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type Payslip = { id: string; month: string; monthNum: number; year: number; basic: number; hra: number; allowance: number; bonus: number; pf: number; tax: number; deduction: number; gross: number; net: number; status: 'Paid' | 'Pending'; paidOn: string };

const downloadCSV = (rows: Payslip[], filename: string) => {
  const H = ['Month', 'Year', 'Basic (INR)', 'HRA (INR)', 'Allowance (INR)', 'Bonus (INR)', 'PF (INR)', 'Tax (INR)', 'Total Deductions (INR)', 'Gross Pay (INR)', 'Net Pay (INR)', 'Status', 'Payment Date'];
  const data = rows.map((r) => [`${r.month} ${r.year}`, r.year, r.basic, r.hra, r.allowance, r.bonus, r.pf, r.tax, r.deduction, r.gross, r.net, r.status, r.paidOn]);
  const csv = [H.join(','), ...data.map((row) => row.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast.success(`${filename} downloaded!`);
};

const printPayslip = (p: Payslip, name: string, empId: string) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip ${p.month} ${p.year}</title>
  <style>*{font-family:Arial,sans-serif;box-sizing:border-box}body{margin:0;padding:24px;color:#1f2937;font-size:13px}
  .header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px}
  .header h1{margin:0;font-size:20px}.header p{margin:4px 0 0;opacity:.85;font-size:12px}
  .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
  .info-box .label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
  .info-box .value{font-weight:700;font-size:13px;margin-top:3px;color:#1e293b}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
  .card h3{margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}.row span:first-child{color:#64748b}.row span:last-child{font-weight:600}
  .net{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;margin-top:12px}
  .net span:first-child{font-weight:700;font-size:13px;color:#065f46}.net span:last-child{font-size:20px;font-weight:800;color:#059669}
  .paid-badge{display:inline-block;background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;margin-top:8px}
  @media print{@page{margin:1cm}}</style></head><body>
  <div class="header"><h1>ZetaQ EMS — Payslip</h1><p>Employee Management System | Confidential</p></div>
  <div class="info-grid">
    <div class="info-box"><div class="label">Employee Name</div><div class="value">${name}</div></div>
    <div class="info-box"><div class="label">Employee ID</div><div class="value">${empId}</div></div>
    <div class="info-box"><div class="label">Pay Period</div><div class="value">${p.month} ${p.year}</div></div>
    <div class="info-box"><div class="label">Payment Date</div><div class="value">${p.paidOn}</div><span class="paid-badge">PAID</span></div>
    <div class="info-box"><div class="label">Payment Status</div><div class="value">${p.status}</div></div>
    <div class="info-box"><div class="label">Generated</div><div class="value">${new Date().toLocaleDateString('en-IN')}</div></div>
  </div>
  <div class="grid">
    <div class="card"><h3>Earnings</h3>
      <div class="row"><span>Basic Salary</span><span>${fmt(p.basic)}</span></div>
      <div class="row"><span>HRA</span><span>${fmt(p.hra)}</span></div>
      <div class="row"><span>Allowances</span><span>${fmt(p.allowance)}</span></div>
      ${p.bonus ? `<div class="row"><span>Bonus</span><span>${fmt(p.bonus)}</span></div>` : ''}
      <div class="row" style="font-weight:700;color:#1e40af"><span>Gross Pay</span><span>${fmt(p.gross)}</span></div>
    </div>
    <div class="card"><h3>Deductions</h3>
      <div class="row"><span>Provident Fund (6%)</span><span>-${fmt(p.pf)}</span></div>
      <div class="row"><span>Income Tax</span><span>-${fmt(p.tax)}</span></div>
      <div class="row" style="font-weight:700;color:#dc2626"><span>Total Deductions</span><span>-${fmt(p.deduction)}</span></div>
    </div>
  </div>
  <div class="net"><span>Net Take-Home Pay — ${p.month} ${p.year}</span><span>${fmt(p.net)}</span></div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:20px">This is a computer-generated payslip. No signature required. | Payment Date: ${p.paidOn}</p>
  </body></html>`;
  const w = window.open('', '_blank', 'width=850,height=750');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
};

type SortDir = 'asc' | 'desc';

export default function EmployeePayslips() {
  const { user } = useAuth();
  const { data: profile } = useGetMyProfileQuery();
  const empId = profile?.employeeCode || 'EMP001';
  const { data: apiPayslips } = useGetMyPayslipsQuery();

  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [view, setView] = useState<Payslip | null>(null);

  const payslips: Payslip[] = useMemo(() => (apiPayslips || []).map((p) => {
    const basic = p.basicSalary || 0;
    const hra = p.allowances?.hra || 0;
    const allowance = (p.allowances?.transport || 0) + (p.allowances?.medical || 0) + (p.allowances?.other || 0);
    const bonus = 0;
    const pf = p.deductions?.pf || 0;
    const tax = p.deductions?.tax || 0;
    const deduction = p.totalDeductions || (pf + tax + (p.deductions?.other || 0));
    const gross = p.grossSalary || (basic + hra + allowance + bonus);
    const net = p.netSalary || (gross - deduction);
    return {
      id: p._id, month: MOS[(p.month || 1) - 1] || 'Jan', monthNum: (p.month || 1) - 1, year: p.year || CY,
      basic, hra, allowance, bonus, pf, tax, deduction, gross, net,
      status: p.status === 'paid' ? 'Paid' : 'Pending', paidOn: p.paidAt?.slice(0, 10) || '',
    };
  }), [apiPayslips]);

  const filtered = useMemo(() => {
    const list = filterYear === 'all' ? payslips : payslips.filter((p) => p.year === filterYear);
    return [...list].sort((a, b) => { const diff = (a.year - b.year) * 12 + (a.monthNum - b.monthNum); return sortDir === 'asc' ? diff : -diff; });
  }, [filterYear, sortDir, payslips]);

  const ytdYear = filterYear === 'all' ? CY : filterYear;
  const ytd = payslips.filter((p) => p.year === ytdYear).reduce((s, p) => s + p.net, 0);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="relative z-10">
          <p className="text-emerald-100 text-xs font-medium">Year-to-Date Earnings — {ytdYear}</p>
          <p className="text-3xl font-bold mt-1">{fmt(ytd)}</p>
          <p className="text-emerald-100 text-xs mt-1">{payslips.filter((p) => p.year === ytdYear).length} months paid · {user?.name} · {empId}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={filterYear === 'all' ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setFilterYear('all')}>All</Button>
          {YEARS.slice().reverse().map((y) => (
            <Button key={y} size="sm" variant={filterYear === y ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setFilterYear(y)}>{y}</Button>
          ))}
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>{sortDir === 'desc' ? '↓ Newest First' : '↑ Oldest First'}</Button>
          <span className="text-xs text-gray-400 ml-1">{filtered.length} payslip{filtered.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto flex items-center gap-2">
            <YearDownloadBtn years={YEARS} getRows={(yr: number) => payslips.filter((p) => p.year === yr)} name={user?.name || 'employee'} onDownload={downloadCSV} />
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs" onClick={() => downloadCSV(filtered, `zetaq_payslips_${filterYear === 'all' ? 'all' : filterYear}_${(user?.name || 'employee').replace(' ', '_')}.csv`)}>⬇ CSV</Button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{['Period', 'Payment Date', 'Basic', 'HRA', 'Allowance', 'Bonus', 'Deductions', 'Gross', 'Net Pay', 'Status', 'Actions'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="px-4 py-12 text-center"><span className="text-3xl">💰</span><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No payslips for {filterYear}</p></TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><p className="text-xs font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{p.month} {p.year}</p></TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{p.paidOn}</p>
                    <Badge variant="success">PAID</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(p.basic)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(p.hra)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(p.allowance)}</TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-medium">{p.bonus ? fmt(p.bonus) : '—'}</TableCell>
                  <TableCell className="text-red-500 dark:text-red-400 whitespace-nowrap">-{fmt(p.deduction)}</TableCell>
                  <TableCell className="font-semibold whitespace-nowrap">{fmt(p.gross)}</TableCell>
                  <TableCell className="font-bold text-gray-900 dark:text-white whitespace-nowrap">{fmt(p.net)}</TableCell>
                  <TableCell><Badge variant={p.status === 'Paid' ? 'success' : 'warning'}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" onClick={() => setView(p)}>View</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" onClick={() => printPayslip(p, user?.name || 'Employee', empId)}>⬇ PDF</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" onClick={() => downloadCSV([p], `payslip_${p.month}_${p.year}.csv`)}>CSV</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!view} onOpenChange={(o: boolean) => !o && setView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Payslip — {view?.month} {view?.year}</DialogTitle></DialogHeader>
          {view && (
            <div className="p-5 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{user?.name} · {empId}</p><p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">Period: {view.month} {view.year}</p></div>
                  <div className="text-right"><p className="text-[10px] text-blue-500 dark:text-blue-400">Payment Date</p><p className="text-xs font-bold text-blue-700 dark:text-blue-400">{view.paidOn}</p><Badge variant="success">PAID</Badge></div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings</p>
                {[['Basic Salary', view.basic], ['HRA', view.hra], ['Allowances', view.allowance], ...(view.bonus ? [['Bonus', view.bonus]] : [])].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{l as string}</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmt(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 bg-blue-50 dark:bg-blue-900/20 px-2 rounded-lg mt-1">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Gross Pay</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{fmt(view.gross)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Deductions</p>
                {[['Provident Fund', view.pf], ['Income Tax', view.tax]].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{l as string}</span>
                    <span className="text-xs font-semibold text-red-500">-{fmt(v as number)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Net Take-Home</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(view.net)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setView(null)}>Close</Button>
            {view && <Button variant="secondary" className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white" onClick={() => downloadCSV([view], `payslip_${view.month}_${view.year}.csv`)}>⬇ CSV</Button>}
            {view && <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => printPayslip(view, user?.name || 'Employee', empId)}>⬇ PDF</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function YearDownloadBtn({ years, getRows, name, onDownload }: { years: number[]; getRows: (yr: number) => Payslip[]; name: string; onDownload: (rows: Payslip[], filename: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs" onClick={() => setOpen((p) => !p)}>📥 Year ▾</Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
          {years.slice().reverse().map((y) => (
            <button key={y} onClick={() => {
              const rows = getRows(y);
              if (!rows.length) { toast.error(`No payslips for ${y}`); return; }
              onDownload(rows, `zetaq_payslips_${y}_${name.replace(' ', '_')}.csv`);
              setOpen(false);
            }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">⬇ Download {y}</button>
          ))}
        </div>
      )}
    </div>
  );
}
