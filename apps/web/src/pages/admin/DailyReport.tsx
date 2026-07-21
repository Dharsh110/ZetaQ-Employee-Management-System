import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetDailyReportsQuery, useAddDailyReportCommentMutation, type ApiComment, type ApiDailyReport, type ApiFileAttachment } from '../../store/api/dailyReportsApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const todayStr = new Date().toISOString().slice(0, 10);
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
type StatFilter = 'all' | 'today' | 'files' | 'comments';
type ReportEntry = { id: string; empName: string; dept: string; date: string; tasks: string; achievements: string; challenges: string; nextPlan: string; mood: Mood; files: ApiFileAttachment[]; comments: ApiComment[] };

const MOOD_EMOJI: Record<Mood, string> = { great: '😄', good: '🙂', neutral: '😐', tired: '😴', stressed: '😰' };
const AVAIL_CLR = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const getWeekRange = () => {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
};
const inPeriod = (dateStr: string, period: Period, selMonth: number, selYear: number) => {
  const wr = getWeekRange();
  if (period === 'all') return true;
  if (period === 'today') return dateStr === todayStr;
  if (period === 'week') return dateStr >= wr.from && dateStr <= wr.to;
  if (period === 'month') return new Date(dateStr).getMonth() === selMonth && new Date(dateStr).getFullYear() === selYear;
  if (period === 'year') return new Date(dateStr).getFullYear() === selYear;
  return true;
};
const dateDisplay = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };
const timeDisplay = (iso: string) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const mapReportToEntry = (r: ApiDailyReport): ReportEntry => ({
  id: r._id,
  empName: r.empName || (typeof r.employee === 'object' ? `${r.employee.firstName} ${r.employee.lastName}` : ''),
  dept: r.department || (typeof r.employee === 'object' && typeof r.employee.department === 'object' ? r.employee.department?.name || '' : '') || '',
  date: r.date?.slice(0, 10) || '',
  tasks: r.taskTitle || r.description || '',
  achievements: r.achievements || '',
  challenges: r.challenges || '',
  nextPlan: r.nextPlan || '',
  mood: (r.mood || 'good') as Mood,
  files: r.files || [],
  comments: r.comments || [],
});

function ReportCard({ r, i, onView }: { r: ReportEntry; i: number; onView: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-2xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{initials(r.empName)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{r.empName}</p>
            <Badge variant="gray">{r.dept}</Badge>
            <Badge variant={r.date === todayStr ? 'success' : 'default'}>{r.date === todayStr ? 'Today' : dateDisplay(r.date)}</Badge>
            <span className="text-base" title={r.mood}>{MOOD_EMOJI[r.mood]}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{r.tasks}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
            {r.files.length > 0 && <span>📎 {r.files.length} file{r.files.length > 1 ? 's' : ''}</span>}
            {r.comments.length > 0 && <span>💬 {r.comments.length} comment{r.comments.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <Button size="sm" variant="secondary" className="bg-blue-50 text-blue-600 flex-shrink-0" onClick={onView}>View</Button>
      </div>
    </div>
  );
}

export default function AdminDailyReport() {
  const { data: apiReports = [] } = useGetDailyReportsQuery();
  const [addDailyReportComment] = useAddDailyReportCommentMutation();
  const reports: ReportEntry[] = useMemo(() => apiReports.map(mapReportToEntry), [apiReports]);

  // Sourced live from the Departments collection (not just depts that happen to have a report
  // already) so newly-added departments always appear in every filter, including the summary
  // card sub-view below.
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const allDeptNames = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  // Full alphabetical roster for the "filter by employee" dropdown — never truncated.
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees]);

  const [search, setSearch] = useState('');
  const [dateF, setDateF] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const [viewR, setViewR] = useState<ReportEntry | null>(null);
  const [viewFile, setViewFile] = useState<ApiFileAttachment | null>(null);
  const [comment, setComment] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null);
  const [sfPeriod, setSfPeriod] = useState<'all' | 'month' | 'year'>('all');
  const [sfMonth, setSfMonth] = useState(new Date().getMonth());
  const [sfYear, setSfYear] = useState(CY);
  const [sfDept, setSfDept] = useState('');

  const reportsWithComments = reports;
  const allDepts = allDeptNames;

  const filtered = useMemo(() => reportsWithComments.filter((r) => {
    const matchP = dateF ? r.date === dateF : inPeriod(r.date, period, selMonth, selYear);
    const matchS = !search || r.empName.toLowerCase().includes(search.toLowerCase()) || r.tasks.toLowerCase().includes(search.toLowerCase());
    const matchD = !deptF || r.dept === deptF;
    const matchE = !empF || r.empName === empF;
    return matchP && matchS && matchD && matchE;
  }), [reportsWithComments, search, dateF, period, selMonth, selYear, deptF, empF]);

  const addComment = async () => {
    if (!comment.trim() || !viewR) return;
    try {
      const updated = await addDailyReportComment({ id: viewR.id, text: comment.trim() }).unwrap();
      setViewR(mapReportToEntry(updated));
      setComment('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const clearFilters = () => { setSearch(''); setDateF(''); setPeriod('all'); setDeptF(''); setEmpF(''); };

  const totalReports = reportsWithComments.length;
  const todayReports = reportsWithComments.filter((r) => r.date === todayStr).length;
  const withFiles = reportsWithComments.filter((r) => r.files.length > 0).length;
  const withComments = reportsWithComments.filter((r) => r.comments.length > 0).length;

  const filterBar = (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 space-y-2.5">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by employee name, department or task…" />
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'today', 'week', 'month', 'year'] as Period[]).map((p) => (
          <Button key={p} size="sm" variant={period === p && !dateF ? 'default' : 'secondary'} className="capitalize" onClick={() => { setPeriod(p); setDateF(''); }}>
            {p === 'all' ? `All (${reportsWithComments.length})` : p === 'today' ? `Today (${todayReports})` : p}
          </Button>
        ))}
        {period === 'month' && !dateF && (
          <>
            <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          </>
        )}
        {period === 'year' && !dateF && <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>}
        <input type="date" value={dateF} onChange={(e) => { setDateF(e.target.value); if (e.target.value) setPeriod('all'); }} className="h-8 text-xs border border-border dark:border-gray-600 rounded-lg px-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer" />
        <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Departments</SelectItem>{allDepts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
        </Select>
        {(search || dateF || deptF || empF || period !== 'all') && <button onClick={clearFilters} className="text-[10px] text-blue-500 hover:underline whitespace-nowrap">Clear</button>}
        <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{filtered.length} report{filtered.length !== 1 ? 's' : ''}{filtered.length !== totalReports && <span className="text-gray-400 font-normal"> of {totalReports}</span>}</span>
      </div>
    </div>
  );

  const detailModal = (
    <Dialog open={!!viewR} onOpenChange={(o: boolean) => !o && setViewR(null)}>
      <DialogContent className="max-w-lg">
        {viewR && (
          <>
            <DialogHeader><div><DialogTitle>{viewR.empName}'s Daily Report</DialogTitle><p className="text-xs text-gray-400">{dateDisplay(viewR.date)} &middot; {viewR.dept} {MOOD_EMOJI[viewR.mood]}</p></div></DialogHeader>
            <DialogBody>
              {[{ l: 'Tasks Completed', v: viewR.tasks }, { l: 'Achievements', v: viewR.achievements }, { l: 'Challenges', v: viewR.challenges }, { l: 'Plan for Tomorrow', v: viewR.nextPlan }].map((s) => (
                <div key={s.l}><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{s.l}</p><div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{s.v || '—'}</div></div>
              ))}
              {viewR.files.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Uploaded Files ({viewR.files.length})</p>
                  <div className="space-y-1.5">
                    {viewR.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <span className="text-lg flex-shrink-0">{f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📎'}</span>
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{f.name}</p><p className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(1)} KB</p></div>
                        {(f.type.startsWith('image/') || f.type === 'application/pdf' || f.type.startsWith('text/')) && <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewFile(f)}>View</Button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Comments ({viewR.comments.length})</p>
                {viewR.comments.length === 0 ? <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/20 rounded-xl p-3">No comments yet.</p> : (
                  <div className="space-y-2 mb-3">
                    {viewR.comments.map((c) => (
                      <div key={c.id} className={`rounded-xl p-3 ${c.role === 'admin' ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-purple-50 dark:bg-purple-900/10'}`}>
                        <div className="flex items-center gap-1.5 mb-1"><span className={`text-[10px] font-bold ${c.role === 'admin' ? 'text-blue-600' : 'text-purple-600'}`}>{c.by}</span><Badge variant="gray" className="capitalize">{c.role}</Badge><span className="text-[10px] text-gray-400">{timeDisplay(c.at)} &middot; {dateDisplay(c.at.slice(0, 10))}</span></div>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment()} placeholder="Add a comment as Admin… (Enter to submit)" />
                  <Button onClick={addComment} disabled={!comment.trim()}>Post</Button>
                </div>
              </div>
            </DialogBody>
            <DialogFooter><Button variant="outline" className="w-full" onClick={() => setViewR(null)}>Close</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const fileModal = (
    <Dialog open={!!viewFile} onOpenChange={(o: boolean) => !o && setViewFile(null)}>
      <DialogContent className="max-w-2xl">
        {viewFile && (
          <>
            <DialogHeader><DialogTitle className="truncate pr-4">{viewFile.name}</DialogTitle></DialogHeader>
            <DialogBody>
              {viewFile.type.startsWith('image/') && <img src={viewFile.data} alt={viewFile.name} className="max-w-full mx-auto rounded-xl" />}
              {viewFile.type === 'application/pdf' && <iframe src={viewFile.data} title={viewFile.name} className="w-full h-96 rounded-xl border-0" />}
              {viewFile.type.startsWith('text/') && <pre className="text-xs bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 whitespace-pre-wrap overflow-auto max-h-80">{atob((viewFile.data || '').split(',')[1] || '')}</pre>}
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  if (statFilter) {
    const DEPTS_SF = allDeptNames;
    const statFiltered = reportsWithComments.filter((r) => {
      if (statFilter === 'today' && r.date !== todayStr) return false;
      if (statFilter === 'files' && r.files.length === 0) return false;
      if (statFilter === 'comments' && r.comments.length === 0) return false;
      if (sfDept && r.dept !== sfDept) return false;
      if (sfPeriod === 'month') { const d = new Date(r.date); if (d.getMonth() !== sfMonth || d.getFullYear() !== sfYear) return false; }
      if (sfPeriod === 'year') { if (new Date(r.date).getFullYear() !== sfYear) return false; }
      return true;
    });
    const statTitle = statFilter === 'today' ? "Today's Reports" : statFilter === 'files' ? 'Reports with Files' : statFilter === 'comments' ? 'Reports with Comments' : 'All Reports';
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setStatFilter(null)}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{statTitle} ({statFiltered.length})</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'month', 'year'] as const).map((p) => <Button key={p} size="sm" variant={sfPeriod === p ? 'default' : 'secondary'} onClick={() => setSfPeriod(p)} className="capitalize">{p}</Button>)}
            {sfPeriod === 'month' && <Select value={String(sfMonth)} onValueChange={(v: string) => setSfMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>}
            {(sfPeriod === 'month' || sfPeriod === 'year') && <Select value={String(sfYear)} onValueChange={(v: string) => setSfYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>}
            <Select value={sfDept || 'all'} onValueChange={(v: string) => setSfDept(v === 'all' ? '' : v)}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPTS_SF.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        {statFiltered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center"><span className="text-4xl block mb-3">📋</span><p className="text-sm text-gray-500">No reports match this filter</p></div>
        ) : <div className="space-y-3">{statFiltered.map((r, i) => <ReportCard key={r.id} r={r} i={i} onView={() => setViewR(r)} />)}</div>}
        {detailModal}{fileModal}
      </div>
    );
  }

  if (showAll) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => setShowAll(false)}>← Back</Button>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Full Daily Report</h2>
      </div>
      {filterBar}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center"><span className="text-4xl block mb-3">📋</span><p className="text-sm text-gray-500">No daily reports match the current filters</p><button onClick={clearFilters} className="text-xs text-blue-500 hover:underline mt-2">Clear filters</button></div>
      ) : <div className="space-y-3">{filtered.map((r, i) => <ReportCard key={r.id} r={r} i={i} onView={() => setViewR(r)} />)}</div>}
      {detailModal}{fileModal}
    </div>
  );

  const top10 = filtered.slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Reports', v: totalReports, c: 'from-blue-500 to-blue-600', sf: 'all' as StatFilter },
          { l: 'Today', v: todayReports, c: 'from-emerald-500 to-emerald-600', sf: 'today' as StatFilter },
          { l: 'With Files', v: withFiles, c: 'from-purple-500 to-purple-600', sf: 'files' as StatFilter },
          { l: 'With Comments', v: withComments, c: 'from-amber-500 to-amber-600', sf: 'comments' as StatFilter },
        ].map((s) => (
          <button key={s.l} onClick={() => setStatFilter(s.sf)} className={`bg-gradient-to-br ${s.c} rounded-2xl p-4 text-white text-left hover:opacity-90 hover:shadow-lg transition-all`}>
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-[10px] opacity-80 mt-0.5 font-semibold">{s.l}</p>
            <p className="text-[10px] opacity-60 mt-1">Click to filter →</p>
          </button>
        ))}
      </div>
      {filterBar}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center"><span className="text-4xl block mb-3">📋</span><p className="text-sm text-gray-500">No daily reports match the current filters</p><button onClick={clearFilters} className="text-xs text-blue-500 hover:underline mt-2">Clear filters</button></div>
      ) : <div className="space-y-3">{top10.map((r, i) => <ReportCard key={r.id} r={r} i={i} onView={() => setViewR(r)} />)}</div>}
      {filtered.length > 10 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">Showing 10 of {filtered.length} reports</p>
          <button onClick={() => setShowAll(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold">View Full Report ({filtered.length}) →</button>
        </div>
      )}
      {detailModal}{fileModal}
    </div>
  );
}
