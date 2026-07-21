import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useGetDailyReportsQuery, useAddDailyReportCommentMutation, type ApiComment, type ApiDailyReport, type ApiFileAttachment } from '../../store/api/dailyReportsApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

const todayStr = new Date().toISOString().slice(0, 10);
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
type StatView = 'main' | 'all' | 'today' | 'files' | 'comments' | 'deleted';
type ReportEntry = { id: string; empName: string; dept: string; date: string; tasks: string; achievements: string; challenges: string; nextPlan: string; mood: Mood; files: ApiFileAttachment[]; comments: ApiComment[] };

const MOOD_EMOJI: Record<Mood, string> = { great: '😄', good: '🙂', neutral: '😐', tired: '😴', stressed: '😰' };
const AVAIL_CLR = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const isViewable = (f: ApiFileAttachment) => ['image/', 'application/pdf', 'text/'].some((t) => f.type.startsWith(t));
const dateDisplay = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };
const timeDisplay = (iso: string) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const getWeekRange = () => {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
};

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

export default function ManagerDailyReport() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';
  const { data: apiReports = [] } = useGetDailyReportsQuery(myDept ? { department: myDept } : undefined);
  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!myDept });
  const [addDailyReportComment] = useAddDailyReportCommentMutation();

  const reports: ReportEntry[] = useMemo(() => apiReports.map(mapReportToEntry), [apiReports]);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dateF, setDateF] = useState('');
  const [deptF, setDeptF] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [viewR, setViewR] = useState<ReportEntry | null>(null);
  const [viewFile, setViewFile] = useState<ApiFileAttachment | null>(null);
  const [comment, setComment] = useState('');
  const [statView, setStatView] = useState<StatView>('main');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeReports = reports.filter((r) => !deletedIds.has(r.id));
  const deletedReports = reports.filter((r) => deletedIds.has(r.id));

  const inPeriod = (dateStr: string) => {
    const wr = getWeekRange();
    if (period === 'all') return true;
    if (period === 'today') return dateStr === todayStr;
    if (period === 'week') return dateStr >= wr.from && dateStr <= wr.to;
    if (period === 'month') return new Date(dateStr).getMonth() === selMonth && new Date(dateStr).getFullYear() === selYear;
    if (period === 'year') return new Date(dateStr).getFullYear() === selYear;
    return true;
  };
  const todayCount = activeReports.filter((r) => r.date === todayStr).length;
  const filtered = useMemo(() => activeReports.filter((r) => {
    const matchP = dateF ? r.date === dateF : inPeriod(r.date);
    const matchD = !deptF || r.dept === deptF;
    const matchS = !search || r.empName.toLowerCase().includes(search.toLowerCase()) || r.dept.toLowerCase().includes(search.toLowerCase()) || r.tasks.toLowerCase().includes(search.toLowerCase());
    return matchP && matchD && matchS;
  }), [activeReports, search, dateF, deptF, period, selMonth, selYear]);

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

  const doDeleteReport = (id: string) => {
    setDeletedIds((p) => new Set([...p, id]));
    setDeleteId(null); setViewR(null);
    toast.success('Report moved to Deleted');
  };
  const doRestoreReport = (id: string) => {
    setDeletedIds((p) => { const next = new Set(p); next.delete(id); return next; });
    toast.success('Report restored');
  };

  const filterBar = (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 space-y-2.5">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by employee, department or task…" />
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'today', 'week', 'month', 'year'] as Period[]).map((p) => (
          <Button key={p} size="sm" variant={period === p && !dateF ? 'default' : 'secondary'} className="capitalize" onClick={() => { setPeriod(p); setDateF(''); }}>
            {p === 'all' ? `All (${activeReports.length})` : p === 'today' ? `Today (${todayCount})` : p}
          </Button>
        ))}
        {period === 'month' && !dateF && (<>
          <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
          <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        </>)}
        {period === 'year' && !dateF && <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>}
        <input type="date" value={dateF} onChange={(e) => { setDateF(e.target.value); if (e.target.value) setPeriod('all'); }} className="h-8 text-xs border border-border dark:border-gray-600 rounded-lg px-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer" />
        {!myDept && (
          <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {(search || dateF || deptF || period !== 'all') && <button onClick={() => { setSearch(''); setDateF(''); setDeptF(''); setPeriod('all'); }} className="text-[10px] text-blue-500 hover:underline">Clear</button>}
        <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
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
                        {isViewable(f) && <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewFile(f)}>View</Button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Manager Comments ({viewR.comments.length})</p>
                {viewR.comments.length === 0 ? <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/20 rounded-xl p-3">No comments yet.</p> : (
                  <div className="space-y-2 mb-3">
                    {viewR.comments.map((c) => (
                      <div key={c.id} className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-bold text-blue-600">{c.by}</span><span className="text-[10px] text-gray-400">{timeDisplay(c.at)} &middot; {dateDisplay(c.at.slice(0, 10))}</span></div>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment()} placeholder="Add a comment… (Enter to submit)" />
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

  const deleteAlert = (
    <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="text-4xl">🗑️</span>
          <AlertDialogTitle>Delete Report?</AlertDialogTitle>
          <AlertDialogDescription>Report will be moved to Deleted section.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteId && doDeleteReport(deleteId)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (statView !== 'main') {
    const isDeleted = statView === 'deleted';
    const statList = isDeleted ? deletedReports
      : statView === 'today' ? activeReports.filter((r) => r.date === todayStr)
        : statView === 'files' ? activeReports.filter((r) => r.files.length > 0)
          : statView === 'comments' ? activeReports.filter((r) => r.comments.length > 0)
            : activeReports;
    const titleMap: Record<StatView, string> = { main: '', all: `All Reports (${activeReports.length})`, today: "Today's Reports", files: 'Reports with Files', comments: 'Reports with Comments', deleted: 'Deleted Reports' };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setStatView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{titleMap[statView]}</h2>
        </div>
        {!isDeleted && filterBar}
        {statList.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-10 text-center"><span className="text-3xl">{isDeleted ? '🗑️' : '📋'}</span><p className="text-sm text-gray-500 mt-2">{isDeleted ? 'No deleted reports' : 'No reports here'}</p></div>
        ) : (
          <div className="space-y-3">
            {statList.map((r, i) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials(r.empName)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${isDeleted ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{r.empName}</p>
                    <p className="text-[10px] text-gray-400">{r.dept} &middot; {r.date}</p>
                    {!isDeleted && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.tasks}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isDeleted ? (
                      <Button size="sm" variant="secondary" className="bg-emerald-50 text-emerald-600" onClick={() => doRestoreReport(r.id)}>↩ Restore</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" className="bg-blue-50 text-blue-600" onClick={() => setViewR(r)}>View</Button>
                        <Button size="sm" variant="secondary" className="bg-red-50 text-red-500" onClick={() => setDeleteId(r.id)}>Del</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {deleteAlert}{detailModal}{fileModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { k: 'all' as StatView, l: 'Total Reports', v: activeReports.length, c: 'from-blue-500 to-blue-600' },
          { k: 'today' as StatView, l: 'Today', v: activeReports.filter((r) => r.date === todayStr).length, c: 'from-emerald-500 to-emerald-600' },
          { k: 'files' as StatView, l: 'With Files', v: activeReports.filter((r) => r.files.length > 0).length, c: 'from-purple-500 to-purple-600' },
          { k: 'comments' as StatView, l: 'With Comments', v: activeReports.filter((r) => r.comments.length > 0).length, c: 'from-amber-500 to-amber-600' },
          { k: 'deleted' as StatView, l: 'Deleted', v: deletedReports.length, c: 'from-red-400 to-red-500' },
        ].map((s) => (
          <button key={s.l} onClick={() => setStatView(s.k)} className={`bg-gradient-to-br ${s.c} rounded-2xl p-4 text-white text-left hover:opacity-90 hover:shadow-lg transition-all`}>
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-[10px] opacity-80 mt-0.5 font-semibold">{s.l}</p>
            <p className="text-[10px] opacity-60 mt-1">View →</p>
          </button>
        ))}
      </div>

      {filterBar}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center"><span className="text-4xl">📋</span><p className="text-sm text-gray-500 mt-3">No daily reports found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl ${AVAIL_CLR[i % AVAIL_CLR.length]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{initials(r.empName)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{r.empName}</p>
                    <Badge variant="gray">{r.dept}</Badge>
                    <Badge variant={r.date === todayStr ? 'success' : 'default'}>{r.date === todayStr ? 'Today' : dateDisplay(r.date)}</Badge>
                    <span className="text-base" title={r.mood}>{MOOD_EMOJI[r.mood]}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.tasks}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    {r.files.length > 0 && <span>📎 {r.files.length} file{r.files.length > 1 ? 's' : ''}</span>}
                    {r.comments.length > 0 && <span>💬 {r.comments.length} comment{r.comments.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="secondary" className="bg-blue-50 text-blue-600" onClick={() => setViewR(r)}>View</Button>
                  <Button size="sm" variant="secondary" className="bg-red-50 text-red-500" onClick={() => setDeleteId(r.id)}>Del</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleteAlert}{detailModal}{fileModal}
    </div>
  );
}
