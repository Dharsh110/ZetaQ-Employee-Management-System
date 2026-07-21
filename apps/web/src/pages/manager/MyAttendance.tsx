import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetMyAttendanceQuery } from '../../store/api/attendanceApi';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MOS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type AttStatus = 'Present' | 'Late' | 'Absent' | 'Half Day' | 'Holiday' | 'Weekend';
type Period = 'month' | 'week';
type Record_ = { date: string; checkIn: string; checkOut: string; hours: string; status: AttStatus; notes: string };

const S_CLR: Record<AttStatus, string> = {
  Present: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  Late: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
  'Half Day': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  Holiday: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  Weekend: 'bg-gray-100 dark:bg-gray-700 text-gray-400',
};

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
};

// Managers get the exact same self-attendance history view employees get — the
// team-wide view lives separately at /manager/attendance (TeamAttendance.tsx).
export default function ManagerMyAttendance() {
  const { user } = useAuth();
  const designation = (user as any)?.designation || 'Manager';
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [period, setPeriod] = useState<Period>('month');
  const [statusF, setStatusF] = useState('');

  const weekRange = getWeekRange();
  const { data: attData } = useGetMyAttendanceQuery({ month: selMonth + 1, year: selYear });

  const records: Record_[] = (attData || []).filter((r) => (r.date?.slice(0, 10) || '') <= new Date().toISOString().slice(0, 10)).map((r) => {
    const fmt = (d?: string) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
    return {
      date: r.date?.slice(0, 10) || '',
      checkIn: fmt(r.checkIn),
      checkOut: fmt(r.checkOut),
      hours: r.totalHours ? `${Math.floor(r.totalHours)}h ${Math.round((r.totalHours % 1) * 60)}m` : '—',
      status: (r.status === 'present' && r.isLate ? 'Late' : r.status === 'present' ? 'Present' : r.status === 'absent' ? 'Absent' : r.status === 'leave' ? 'Absent' : r.status === 'half_day' ? 'Half Day' : r.status === 'holiday' ? 'Holiday' : r.status === 'weekend' ? 'Weekend' : 'Present') as AttStatus,
      notes: r.notes || '',
    };
  });

  const periodFiltered = records.filter((r) => {
    if (period === 'week') return r.date >= weekRange.from && r.date <= weekRange.to;
    const d = new Date(r.date);
    return d.getMonth() === selMonth && d.getFullYear() === selYear;
  });

  const filtered = periodFiltered.filter((r) => !statusF || r.status === statusF);

  const workingDays = periodFiltered.filter((r) => r.status !== 'Weekend').length;
  const holidays = periodFiltered.filter((r) => r.status === 'Holiday').length;
  const present = periodFiltered.filter((r) => r.status === 'Present').length;
  const late = periodFiltered.filter((r) => r.status === 'Late').length;
  const absent = periodFiltered.filter((r) => r.status === 'Absent').length;
  const halfday = periodFiltered.filter((r) => r.status === 'Half Day').length;
  const weekend = periodFiltered.filter((r) => r.status === 'Weekend').length;
  const attRate = workingDays - holidays > 0 ? Math.round(((present + late + halfday) / (workingDays - holidays)) * 100) : 0;

  const statCards = [
    { label: 'Working Days', val: workingDays, color: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700', text: 'text-gray-900 dark:text-white', sub: `${attRate}% rate`, statusKey: '' },
    { label: 'Holidays', val: holidays, color: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800', text: 'text-purple-600 dark:text-purple-400', sub: period === 'week' ? 'This week' : FULL_MOS[selMonth], statusKey: 'Holiday' },
    { label: 'Present', val: present, color: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', sub: `+${late} late`, statusKey: 'Present' },
    { label: 'Absent', val: absent, color: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800', text: 'text-red-500 dark:text-red-400', sub: period === 'week' ? 'This week' : FULL_MOS[selMonth], statusKey: 'Absent' },
    { label: 'Half Days', val: halfday, color: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', sub: period === 'week' ? 'This week' : FULL_MOS[selMonth], statusKey: 'Half Day' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={period === 'week' ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setPeriod('week')}>Current Week</Button>
          <Button size="sm" variant={period === 'month' ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setPeriod('month')}>Month View</Button>
          {period === 'month' && (
            <>
              <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(+v)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(+v)}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
          {period === 'week' && <span className="text-[10px] text-gray-400">{weekRange.from} – {weekRange.to}</span>}
          {statusF && (
            <Button size="sm" variant="ghost" className="text-[11px] text-red-500 hover:bg-red-50" onClick={() => setStatusF('')}>Clear: {statusF} ✕</Button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {statCards.map((s) => (
            <button key={s.label} onClick={() => setStatusF((p) => (p === s.statusKey ? '' : s.statusKey))}
              className={`rounded-xl p-3 text-center transition-all ${s.color} ${statusF === s.statusKey && s.statusKey ? 'ring-2 ring-blue-500 scale-105' : ''} hover:scale-105`}>
              <p className={`text-xl font-bold ${s.text}`}>{s.val}</p>
              <p className={`text-[10px] font-semibold ${s.text} mt-0.5`}>{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setStatusF((p) => (p === 'Late' ? '' : 'Late'))}
            className={`bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-2.5 flex items-center gap-3 hover:scale-[1.02] transition-all ${statusF === 'Late' ? 'ring-2 ring-blue-500' : ''}`}>
            <span className="text-lg">⏰</span>
            <div className="text-left">
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">{late}</p>
              <p className="text-[10px] text-amber-500 font-semibold">Late Check-ins</p>
            </div>
          </button>
          <button onClick={() => setStatusF((p) => (p === 'Weekend' ? '' : 'Weekend'))}
            className={`bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl p-2.5 flex items-center gap-3 hover:scale-[1.02] transition-all ${statusF === 'Weekend' ? 'ring-2 ring-blue-500' : ''}`}>
            <span className="text-lg">🏖️</span>
            <div className="text-left">
              <p className="text-base font-bold text-gray-500 dark:text-gray-400">{weekend}</p>
              <p className="text-[10px] text-gray-400 font-semibold">Weekends</p>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {period === 'week' ? `Current Week (${weekRange.from} – ${weekRange.to})` : `${FULL_MOS[selMonth]} ${selYear}`}
            {' — '}{user?.name}
            {statusF && <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">· Filtered: {statusF}</span>}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>{['Date', 'Day', 'Role / Designation', 'Check In', 'Check Out', 'Hours', 'Status', 'Notes'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No attendance data found</p>
                    <p className="text-xs text-gray-400">No records match the selected period or filter.</p>
                    {statusF && <Button size="sm" variant="secondary" onClick={() => setStatusF('')}>Clear filter</Button>}
                  </div>
                </TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.date} className={r.status === 'Weekend' ? 'opacity-50' : ''}>
                  <TableCell className="font-semibold whitespace-nowrap">{r.date}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}</TableCell>
                  <TableCell><Badge className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">{designation}</Badge></TableCell>
                  <TableCell>{r.checkIn ? <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg">{r.checkIn}</span> : <span className="text-xs text-gray-400">—</span>}</TableCell>
                  <TableCell>{r.checkOut ? <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg">{r.checkOut}</span> : <span className="text-xs text-gray-400">—</span>}</TableCell>
                  <TableCell className="font-bold">{r.hours}</TableCell>
                  <TableCell><Badge className={S_CLR[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-gray-400 italic max-w-[150px] truncate" title={r.notes}>{r.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
