import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetMyTasksQuery } from '../../store/api/tasksApi';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayStr = new Date().toISOString().slice(0, 10);

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type Period = 'all' | 'week' | 'month' | 'year';
type SortDir = 'newest' | 'oldest';

type Task = { id: string; title: string; desc: string; priority: Priority; status: TaskStatus; due: string; progress: number; assignedBy: string; completedAt?: string };

const S_CLR: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  in_progress: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
  cancelled: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400',
};
const P_CLR: Record<Priority, string> = {
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  high: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};
const PROGRESS_CLR: Record<TaskStatus, string> = {
  pending: 'bg-gray-300 dark:bg-gray-600', in_progress: 'bg-amber-500', completed: 'bg-emerald-500', overdue: 'bg-red-500', cancelled: 'bg-rose-400',
};
const CARD_ACCENT: Record<TaskStatus, string> = {
  pending: 'border-l-gray-300 dark:border-l-gray-600', in_progress: 'border-l-amber-400', completed: 'border-l-emerald-400', overdue: 'border-l-red-400', cancelled: 'border-l-rose-400',
};
const STATUS_LABEL: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue', cancelled: 'Cancelled' };
const STATUS_ICON: Record<TaskStatus, string> = { pending: '⏳', in_progress: '⚡', completed: '✅', overdue: '🚨', cancelled: '❌' };
const P_ICON: Record<Priority, string> = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };

function CircleProgress({ pct, status }: { pct: number; status: TaskStatus }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  const stroke = status === 'completed' ? '#10b981' : status === 'in_progress' ? '#f59e0b' : status === 'overdue' ? '#ef4444' : status === 'cancelled' ? '#f43f5e' : '#9ca3af';
  return (
    <div className="relative flex-shrink-0 w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#e5e7eb" strokeWidth="4" fill="none" className="dark:stroke-gray-700" />
        <circle cx="28" cy="28" r={r} stroke={stroke} strokeWidth="4" fill="none" strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <span className="absolute text-[11px] font-bold text-gray-700 dark:text-gray-300">{pct}%</span>
    </div>
  );
}

export default function MyTasks() {
  const [statusF, setStatusF] = useState('');
  const [priorityF, setPriorityF] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [sortDir, setSortDir] = useState<SortDir>('newest');
  const [expand, setExpand] = useState<string | null>(null);

  const { data: apiTasks, isLoading } = useGetMyTasksQuery();

  const dbTasks: Task[] = useMemo(() => (apiTasks || []).map((t) => ({
    id: t._id, title: t.title, desc: t.description || '',
    priority: (t.priority as Priority) || 'medium',
    status: (t.status as TaskStatus) || 'pending',
    due: t.dueDate?.slice(0, 10) || '',
    progress: t.status === 'completed' ? 100 : t.status === 'in_progress' ? 40 : 0,
    assignedBy: typeof t.assignedBy === 'object' ? (t.assignedBy as any)?.name || 'Manager' : (t.assignedBy as string) || 'Manager',
    completedAt: t.status === 'completed' ? t.createdAt : undefined,
  })), [apiTasks]);

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return dbTasks.filter((t) => {
      const dateStr = t.completedAt ? t.completedAt.slice(0, 10) : t.due;
      const inP = period === 'all' ? true
        : period === 'week' ? (dateStr >= weekAgo && dateStr <= todayStr)
        : period === 'month' ? ((d: Date) => d.getMonth() === selMonth && d.getFullYear() === selYear)(new Date(dateStr))
        : new Date(dateStr).getFullYear() === selYear;
      return inP && (!statusF || t.status === statusF) && (!priorityF || t.priority === priorityF);
    }).sort((a, b) => {
      const da = new Date(a.completedAt || a.due).getTime();
      const db = new Date(b.completedAt || b.due).getTime();
      return sortDir === 'newest' ? db - da : da - db;
    });
  }, [dbTasks, period, selMonth, selYear, weekAgo, statusF, priorityF, sortDir]);

  const counts: Record<TaskStatus | 'total', number> = {
    total: dbTasks.length,
    pending: dbTasks.filter((t) => t.status === 'pending').length,
    in_progress: dbTasks.filter((t) => t.status === 'in_progress').length,
    completed: dbTasks.filter((t) => t.status === 'completed').length,
    overdue: dbTasks.filter((t) => t.status === 'overdue').length,
    cancelled: dbTasks.filter((t) => t.status === 'cancelled').length,
  };

  const summaryCards = [
    { key: '', label: 'Total', val: counts.total, icon: '📋', text: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
    { key: 'completed', label: 'Completed', val: counts.completed, icon: '✅', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
    { key: 'in_progress', label: 'In Progress', val: counts.in_progress, icon: '⚡', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    { key: 'pending', label: 'Pending', val: counts.pending, icon: '⏳', text: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700' },
    { key: 'overdue', label: 'Overdue', val: counts.overdue, icon: '🚨', text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    { key: 'cancelled', label: 'Cancelled', val: counts.cancelled, icon: '❌', text: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
  ];

  const isOverdue = (t: Task) => t.due < todayStr && t.status !== 'completed' && t.status !== 'cancelled';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {summaryCards.map((s) => (
          <button key={s.key} onClick={() => setStatusF((p) => (p === s.key ? '' : s.key))}
            className={`${s.bg} border rounded-2xl p-3 text-center transition-all hover:scale-105 ${statusF === s.key ? 'ring-2 ring-blue-500 scale-105' : ''}`}>
            <span className="text-lg">{s.icon}</span>
            <p className={`text-xl font-bold mt-0.5 ${s.text}`}>{s.val}</p>
            <p className={`text-[9px] font-semibold ${s.text} leading-tight`}>{s.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {(['all', 'week', 'month', 'year'] as Period[]).map((v) => (
              <Button key={v} size="sm" variant={period === v ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setPeriod(v)}>
                {v === 'all' ? 'All' : v === 'week' ? 'This Week' : v === 'month' ? 'Month' : 'Year'}
              </Button>
            ))}
          </div>
          {period === 'month' && (
            <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(+v)}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {(period === 'month' || period === 'year') && (
            <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(+v)}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setSortDir((d) => (d === 'newest' ? 'oldest' : 'newest'))}>
            {sortDir === 'newest' ? '↓ Newest' : '↑ Oldest'}
          </Button>
          <Select value={priorityF || 'all'} onValueChange={(v: string) => setPriorityF(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(['pending', 'in_progress', 'completed', 'overdue', 'cancelled'] as TaskStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          {(statusF || priorityF) && <Button size="sm" variant="ghost" className="text-[11px] text-red-500" onClick={() => { setStatusF(''); setPriorityF(''); }}>Clear ✕</Button>}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-16 text-center">
          <span className="text-4xl">📋</span>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No tasks found for selected filters</p>
          {(statusF || priorityF) && <button onClick={() => { setStatusF(''); setPriorityF(''); }} className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">Clear filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const overdue = isOverdue(t);
            return (
              <div key={t.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-l-4 ${CARD_ACCENT[t.status]} rounded-2xl overflow-hidden hover:shadow-md transition-all`}>
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-start gap-3">
                    <CircleProgress pct={t.progress} status={t.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <Badge className={`capitalize ${P_CLR[t.priority]}`}>{P_ICON[t.priority]} {t.priority}</Badge>
                        <Badge className={S_CLR[t.status]}>{STATUS_ICON[t.status]} {STATUS_LABEL[t.status]}</Badge>
                        {overdue && <Badge variant="destructive">OVERDUE</Badge>}
                      </div>
                      <p className={`text-sm font-bold leading-snug ${t.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-100'}`}>{t.title}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-1">
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${PROGRESS_CLR[t.status]}`} style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
                <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">👤 <span className="font-medium text-gray-500 dark:text-gray-400">{t.assignedBy}</span></span>
                  <span className={`flex items-center gap-1 font-medium ${overdue ? 'text-red-400' : 'text-gray-400'}`}>📅 Due: {t.due}</span>
                  {t.completedAt && <span className="flex items-center gap-1 text-emerald-500">✓ {t.completedAt.slice(0, 10)}</span>}
                </div>
                <button onClick={() => setExpand(expand === t.id ? null : t.id)}
                  className="w-full px-4 pb-3 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-left">
                  <span>{expand === t.id ? '▴ Hide' : '▾ Show'} description</span>
                </button>
                {expand === t.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-50 dark:border-gray-700/50">
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-2">{t.desc || 'No description provided.'}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
