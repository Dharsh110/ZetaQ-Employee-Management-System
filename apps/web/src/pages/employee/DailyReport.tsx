import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useGetMyDailyReportsQuery, useCreateDailyReportMutation, useUpdateDailyReportMutation, useDeleteDailyReportMutation, DailyReportStatus } from '../../store/api/dailyReportsApi';
import { useUploadFileMutation, useLazyGetUploadByIdQuery } from '../../store/api/uploadsApi';

type Recipient = 'manager' | 'admin' | 'team';
type FilterPeriod = 'all' | 'month' | 'year';
type PageView = 'main' | 'full';
type EmpStatView = 'main' | 'total' | 'today' | 'files' | 'deleted';

type DailyEntry = {
  id: string; date: string; taskTitle: string; description: string; hoursWorked: number; status: DailyReportStatus;
  recipients: Recipient[]; files: UploadedFile[]; submittedAt: string;
};
type UploadedFile = { id: string; name: string; size: number; type: string; base64?: string; uploadId?: string };

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DL_STATUS_CLR: Record<DailyReportStatus, string> = {
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
  blocked: 'bg-red-100 dark:bg-red-900/30 text-red-500', pending_review: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
};
const DL_STATUS_LABELS: Record<DailyReportStatus, string> = { in_progress: 'In Progress', completed: 'Completed', blocked: 'Blocked', pending_review: 'Pending Review' };
const RECIPIENT_INFO: Record<Recipient, { label: string; icon: string; desc: string }> = {
  manager: { label: 'Manager', icon: '👔', desc: 'Dept Manager & Main Manager' },
  admin: { label: 'Admin / HR', icon: '🛡️', desc: 'HR Department' },
  team: { label: 'Team Members', icon: '👥', desc: 'All members in your department' },
};
type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
const MOOD_INFO: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: '😄', label: 'Great' }, good: { emoji: '🙂', label: 'Good' }, neutral: { emoji: '😐', label: 'Neutral' },
  tired: { emoji: '😴', label: 'Tired' }, stressed: { emoji: '😰', label: 'Stressed' },
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const todayStr = new Date().toISOString().slice(0, 10);
const fmtBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
const FILE_ICON: Record<string, string> = {
  'application/pdf': '📄', 'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️', 'image/webp': '🖼️',
  'application/msword': '📝', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'text/plain': '📃', 'text/csv': '📊', 'application/zip': '🗜️', 'application/x-zip-compressed': '🗜️',
};
const isViewableFile = (type: string) => type.startsWith('image/') || type === 'application/pdf' || type === 'text/plain' || type === 'text/csv';

export default function DailyReport() {
  const { data: apiReports } = useGetMyDailyReportsQuery();
  const [createReport] = useCreateDailyReportMutation();
  const [updateReport] = useUpdateDailyReportMutation();
  const [deleteReportMut] = useDeleteDailyReportMutation();
  const [uploadFile] = useUploadFileMutation();
  const [fetchUpload] = useLazyGetUploadByIdQuery();

  const entries: DailyEntry[] = useMemo(() => (apiReports || []).map((r) => ({
    id: r._id, date: r.date?.slice(0, 10) || todayStr, taskTitle: r.taskTitle || '', description: r.description || '',
    hoursWorked: r.hoursWorked || 0, status: (r.status || 'in_progress') as DailyReportStatus,
    recipients: (r.recipients as Recipient[]) || ['manager'],
    files: (r.files || []).map((f, i) => ({ id: f.uploadId || `${r._id}-file-${i}`, name: f.name, size: f.size, type: f.type, uploadId: f.uploadId })),
    submittedAt: r.submittedAt || r.createdAt || r.date,
  })), [apiReports]);

  const [deletedEntries, setDeletedEntries] = useState<DailyEntry[]>([]);

  const [form, setForm] = useState({ date: todayStr, taskTitle: '', description: '', achievements: '', challenges: '', nextPlan: '', mood: 'good' as Mood, hoursWorked: '' as unknown as number, status: 'in_progress' as DailyReportStatus, recipients: ['manager'] as Recipient[], link: '' });
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(CY);
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest');

  const [pageView, setPageView] = useState<PageView>('main');
  const [empStatView, setEmpStatView] = useState<EmpStatView>('main');
  const [svPeriod, setSvPeriod] = useState<FilterPeriod>('all');
  const [svMonth, setSvMonth] = useState(new Date().getMonth());
  const [svYear, setSvYear] = useState(CY);

  const [viewEntry, setViewEntry] = useState<DailyEntry | null>(null);
  const [viewFileInModal, setViewFileInModal] = useState<UploadedFile | null>(null);
  const [editEntry, setEditEntry] = useState<DailyEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<DailyEntry>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleRecipient = (r: Recipient) => setForm((p) => ({ ...p, recipients: p.recipients.includes(r) ? p.recipients.filter((x) => x !== r) : [...p.recipients, r] }));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const oversized = picked.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length) { toast.error(`Files must be under 20 MB: ${oversized.map((f) => f.name).join(', ')}`); return; }
    setUploading(true);
    Promise.all(picked.map((file) => new Promise<UploadedFile & { base64: string }>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ id: Date.now().toString() + Math.random().toString(36).slice(2), name: file.name, size: file.size, type: file.type, base64: ev.target?.result as string });
      reader.readAsDataURL(file);
    }))).then((results) => {
      setPendingFiles((prev) => [...prev, ...results]);
      setUploading(false);
      toast.success(`${results.length} file${results.length !== 1 ? 's' : ''} ready to attach`);
    });
    e.target.value = '';
  };
  const removeFile = (id: string) => setPendingFiles((p) => p.filter((f) => f.id !== id));

  const submit = async () => {
    if (!form.taskTitle.trim()) { toast.error('Task title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.hoursWorked || +form.hoursWorked <= 0 || +form.hoursWorked > 24) { toast.error('Enter valid hours (0.5–24)'); return; }
    if (form.recipients.length === 0) { toast.error('Select at least one recipient'); return; }
    setSubmitting(true);
    try {
      const uploadedFiles = await Promise.all(pendingFiles.map(async (f: any) => {
        try {
          const res = await uploadFile({ originalName: f.name, mimeType: f.type, size: f.size, data: f.base64, category: 'report' }).unwrap();
          return { name: f.name, size: f.size, type: f.type, uploadId: res._id };
        } catch { return { name: f.name, size: f.size, type: f.type }; }
      }));
      await createReport({
        date: form.date, taskTitle: form.taskTitle.trim(), description: form.description.trim(),
        achievements: form.achievements.trim() || undefined, challenges: form.challenges.trim() || undefined, nextPlan: form.nextPlan.trim() || undefined, mood: form.mood,
        hoursWorked: +form.hoursWorked, status: form.status, recipients: form.recipients, link: form.link.trim() || undefined, files: uploadedFiles,
      }).unwrap();
      setForm({ date: todayStr, taskTitle: '', description: '', achievements: '', challenges: '', nextPlan: '', mood: 'good', hoursWorked: '' as unknown as number, status: 'in_progress', recipients: ['manager'], link: '' });
      setPendingFiles([]);
      toast.success(`Daily report submitted and sent to ${form.recipients.map((r) => RECIPIENT_INFO[r].label).join(', ')} ✅`);
    } catch {
      toast.error('Failed to submit report — it was not saved. Please try again.');
    } finally { setSubmitting(false); }
  };

  const filteredEntries = useMemo(() => entries.filter((e) => {
    if (filterPeriod === 'month') return new Date(e.date).getMonth() === filterMonth && new Date(e.date).getFullYear() === filterYear;
    if (filterPeriod === 'year') return new Date(e.date).getFullYear() === filterYear;
    return true;
  }).sort((a, b) => (sortDir === 'newest' ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime() : new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())), [entries, filterPeriod, filterMonth, filterYear, sortDir]);

  const doDelete = async (id: string) => {
    const target = entries.find((e) => e.id === id);
    try {
      await deleteReportMut(id).unwrap();
      if (target) setDeletedEntries((prev) => [target, ...prev]);
      toast.success('Report deleted');
    } catch { toast.error('Failed to delete report'); }
    setDeleteConfirm(null);
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      await updateReport({ id: editEntry.id, ...editForm }).unwrap();
      setEditEntry(null);
      toast.success('Report updated');
    } catch { toast.error('Failed to update report — changes were not saved.'); }
  };

  const toggleFileView = async (f: UploadedFile) => {
    if (viewFileInModal?.id === f.id) { setViewFileInModal(null); return; }
    if (f.base64) { setViewFileInModal(f); return; }
    if (!f.uploadId) { toast.error('File content not available'); return; }
    try {
      const upload = await fetchUpload(f.uploadId).unwrap();
      if (!upload?.data) { toast.error('File content not available'); return; }
      setViewFileInModal({ ...f, base64: upload.data });
    } catch { toast.error('Failed to load file'); }
  };

  // Shared entry card renderer
  const EntryCard = ({ e }: { e: DailyEntry }) => (
    <div className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{e.taskTitle}</p>
            <Badge className={`capitalize ${DL_STATUS_CLR[e.status]}`}>{e.status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{e.description}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400">📅 {e.date}</span>
            <span className="text-[10px] text-gray-400">⏱ {e.hoursWorked}h</span>
            <span className="text-[10px] text-gray-400">📨 {e.recipients.map((r) => RECIPIENT_INFO[r].label).join(', ')}</span>
            {e.files.length > 0 && <span className="text-[10px] text-blue-500">📎 {e.files.length} file{e.files.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" onClick={() => setViewEntry(e)}>👁 View</Button>
          <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" onClick={() => { setEditEntry(e); setEditForm({ taskTitle: e.taskTitle, description: e.description, hoursWorked: e.hoursWorked, status: e.status }); }}>✏ Edit</Button>
          <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400" onClick={() => setDeleteConfirm(e.id)}>🗑 Delete</Button>
        </div>
      </div>
    </div>
  );

  const ViewModal = () => (
    <Dialog open={!!viewEntry} onOpenChange={(o: boolean) => !o && setViewEntry(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Report — {viewEntry?.taskTitle}</DialogTitle></DialogHeader>
        {viewEntry && (
          <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Date</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{viewEntry.date}</p></div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Hours</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{viewEntry.hoursWorked}h</p></div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Status</p><Badge className={`capitalize ${DL_STATUS_CLR[viewEntry.status]}`}>{viewEntry.status.replace('_', ' ')}</Badge></div>
            </div>
            <div><p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">{viewEntry.description}</p></div>
            <div><p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Sent To</p><div className="flex gap-2 flex-wrap">{viewEntry.recipients.map((r) => (<span key={r} className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-semibold">{RECIPIENT_INFO[r].icon} {RECIPIENT_INFO[r].label}</span>))}</div></div>
            {viewEntry.files.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Attachments ({viewEntry.files.length})</p>
                <div className="space-y-2">
                  {viewEntry.files.map((f) => (
                    <div key={f.id}>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-base">{FILE_ICON[f.type] || '📎'}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-400">{fmtBytes(f.size)}</span>
                        {isViewableFile(f.type) && <button onClick={() => toggleFileView(f)} className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 font-semibold">{viewFileInModal?.id === f.id ? 'Hide' : 'View'}</button>}
                      </div>
                      {viewFileInModal?.id === f.id && viewFileInModal?.base64 && (
                        <div className="mt-1 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                          {f.type.startsWith('image/') && <img src={viewFileInModal.base64} alt={f.name} className="max-w-full max-h-64 mx-auto object-contain" />}
                          {f.type === 'application/pdf' && <iframe src={viewFileInModal.base64} title={f.name} className="w-full h-64" />}
                          {(f.type === 'text/plain' || f.type === 'text/csv') && <pre className="text-[10px] p-3 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap font-mono">{atob(viewFileInModal.base64.split(',')[1] || '')}</pre>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" className="w-full rounded-xl" onClick={() => setViewEntry(null)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const EditModal = () => (
    <Dialog open={!!editEntry} onOpenChange={(o: boolean) => !o && setEditEntry(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Report</DialogTitle></DialogHeader>
        <div className="p-5 space-y-3">
          <div><Label className="mb-1 block">Task Title</Label><Input value={editForm.taskTitle || ''} onChange={(e) => setEditForm((p) => ({ ...p, taskTitle: e.target.value }))} /></div>
          <div><Label className="mb-1 block">Description</Label><Textarea rows={3} value={editForm.description || ''} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} /></div>
          <div><Label className="mb-1 block">Hours Worked</Label><Input type="number" min="0.5" max="24" step="0.5" value={editForm.hoursWorked || ''} onChange={(e) => setEditForm((p) => ({ ...p, hoursWorked: +e.target.value }))} /></div>
          <div>
            <Label className="mb-1.5 block">Status</Label>
            <div className="flex flex-wrap gap-2">
              {(['in_progress', 'pending_review', 'completed', 'blocked'] as DailyReportStatus[]).map((s) => (
                <button key={s} onClick={() => setEditForm((p) => ({ ...p, status: s }))} className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${editForm.status === s ? DL_STATUS_CLR[s] + ' border-current shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{DL_STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditEntry(null)}>Cancel</Button>
          <Button className="flex-1 rounded-xl" onClick={saveEdit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const DeleteConfirmDialog = ({ desc }: { desc: string }) => (
    <AlertDialog open={!!deleteConfirm} onOpenChange={(o: boolean) => !o && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="text-4xl">🗑️</span>
          <AlertDialogTitle>Delete Report?</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteConfirm && doDelete(deleteConfirm)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ── STAT VIEW (including deleted) ──
  if (empStatView !== 'main') {
    const isDeleted = empStatView === 'deleted';
    const svBaseList = isDeleted ? deletedEntries
      : empStatView === 'today' ? entries.filter((e) => e.date === todayStr)
      : empStatView === 'files' ? entries.filter((e) => e.files.length > 0)
      : entries;
    const svFiltered = isDeleted ? svBaseList : svBaseList.filter((e) => {
      if (svPeriod === 'month') { const d = new Date(e.date); return d.getMonth() === svMonth && d.getFullYear() === svYear; }
      if (svPeriod === 'year') return new Date(e.date).getFullYear() === svYear;
      return true;
    });
    const titleMap: Record<EmpStatView, string> = { main: '', total: 'All Reports', today: "Today's Reports", files: 'Reports with Files', deleted: 'Deleted Reports' };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setEmpStatView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{titleMap[empStatView]} ({svFiltered.length})</h2>
        </div>
        {!isDeleted && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'month', 'year'] as FilterPeriod[]).map((p) => (
                <Button key={p} size="sm" variant={svPeriod === p ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setSvPeriod(p)}>{p === 'all' ? 'All Time' : p === 'month' ? 'Month' : 'Year'}</Button>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {svFiltered.length === 0 ? (
            <div className="p-12 text-center"><span className="text-4xl">{isDeleted ? '🗑️' : '📋'}</span><p className="text-sm text-gray-500 mt-2">{isDeleted ? 'No deleted reports' : 'No reports match this filter'}</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {isDeleted ? svFiltered.map((e) => (
                <div key={e.id} className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap hover:bg-gray-50 dark:hover:bg-gray-700/20">
                  <div className="flex-1 min-w-0"><p className="text-xs font-bold text-gray-600 dark:text-gray-300 line-through">{e.taskTitle}</p><p className="text-[10px] text-gray-400 mt-0.5">{e.date} · {e.hoursWorked}h</p></div>
                </div>
              )) : svFiltered.map((e) => <EntryCard key={e.id} e={e} />)}
            </div>
          )}
        </div>
        <ViewModal /><EditModal /><DeleteConfirmDialog desc="Report will be moved to Deleted section." />
      </div>
    );
  }

  // ── Full Report page ──
  if (pageView === 'full') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setPageView('main')}>← Back</Button>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">All Submitted Reports</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filteredEntries.length} of {entries.length} reports</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        {(['all', 'month', 'year'] as FilterPeriod[]).map((p) => (
          <Button key={p} size="sm" variant={filterPeriod === p ? 'default' : 'secondary'} className="rounded-lg text-[11px] capitalize" onClick={() => setFilterPeriod(p)}>{p === 'all' ? 'All Time' : p}</Button>
        ))}
        {filterPeriod === 'month' && (
          <select value={filterMonth} onChange={(e) => setFilterMonth(+e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {MOS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        )}
        {(filterPeriod === 'month' || filterPeriod === 'year') && (
          <select value={filterYear} onChange={(e) => setFilterYear(+e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setSortDir((d) => (d === 'newest' ? 'oldest' : 'newest'))}>{sortDir === 'newest' ? '↓ Newest First' : '↑ Oldest First'}</Button>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="px-5 py-10 text-center"><span className="text-3xl">📋</span><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No reports match this filter</p></div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">{filteredEntries.map((e) => <EntryCard key={e.id} e={e} />)}</div>
        )}
      </div>
      <ViewModal /><EditModal /><DeleteConfirmDialog desc="This action cannot be undone." />
    </div>
  );

  // ── Main view ──
  const todayCount = entries.filter((e) => e.date === todayStr).length;
  const filesCount = entries.filter((e) => e.files.length > 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'total' as EmpStatView, label: 'Total Reports', value: entries.length, color: 'from-blue-500 to-blue-600' },
          { key: 'today' as EmpStatView, label: "Today's", value: todayCount, color: 'from-emerald-500 to-emerald-600' },
          { key: 'files' as EmpStatView, label: 'With Files', value: filesCount, color: 'from-purple-500 to-purple-600' },
          { key: 'deleted' as EmpStatView, label: 'Deleted', value: deletedEntries.length, color: 'from-red-400 to-red-500' },
        ].map((s) => (
          <button key={s.key} onClick={() => setEmpStatView(s.key)} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white text-left hover:opacity-90 hover:shadow-lg transition-all`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs opacity-80 mt-0.5">{s.label}</p>
            <p className="text-[10px] opacity-60 mt-0.5">View all →</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Submit Daily Work Report</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Record your work, attach files, and send to your manager or team</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label className="mb-1 block">Date <span className="text-red-500">*</span></Label><Input type="date" value={form.date} max={todayStr} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
            <div><Label className="mb-1 block">Hours Worked <span className="text-red-500">*</span></Label><Input type="number" min="0.5" max="24" step="0.5" value={form.hoursWorked || ''} placeholder="e.g. 7.5" onChange={(e) => setForm((p) => ({ ...p, hoursWorked: +e.target.value }))} /></div>
          </div>
          <div><Label className="mb-1 block">Task / Work Title <span className="text-red-500">*</span></Label><Input value={form.taskTitle} placeholder="Brief title of what you worked on…" onChange={(e) => setForm((p) => ({ ...p, taskTitle: e.target.value }))} /></div>
          <div><Label className="mb-1 block">Description <span className="text-red-500">*</span></Label><Textarea value={form.description} rows={3} placeholder="Describe what you accomplished, blockers encountered, and next steps…" onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label className="mb-1 block">Achievements <span className="text-gray-400 font-normal">(optional)</span></Label><Textarea value={form.achievements} rows={2} placeholder="What went well today…" onChange={(e) => setForm((p) => ({ ...p, achievements: e.target.value }))} /></div>
            <div><Label className="mb-1 block">Challenges <span className="text-gray-400 font-normal">(optional)</span></Label><Textarea value={form.challenges} rows={2} placeholder="Any blockers or difficulties…" onChange={(e) => setForm((p) => ({ ...p, challenges: e.target.value }))} /></div>
            <div><Label className="mb-1 block">Plan for Tomorrow <span className="text-gray-400 font-normal">(optional)</span></Label><Textarea value={form.nextPlan} rows={2} placeholder="What's next…" onChange={(e) => setForm((p) => ({ ...p, nextPlan: e.target.value }))} /></div>
          </div>
          <div>
            <Label className="mb-1.5 block">How was your day?</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(MOOD_INFO) as [Mood, { emoji: string; label: string }][]).map(([key, info]) => (
                <button key={key} onClick={() => setForm((p) => ({ ...p, mood: key }))} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${form.mood === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <span>{info.emoji}</span><span>{info.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Work Status</Label>
            <div className="flex flex-wrap gap-2">
              {(['in_progress', 'pending_review', 'completed', 'blocked'] as DailyReportStatus[]).map((s) => (
                <button key={s} onClick={() => setForm((p) => ({ ...p, status: s }))} className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${form.status === s ? DL_STATUS_CLR[s] + ' border-current shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{DL_STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Send Report To <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(RECIPIENT_INFO) as [Recipient, { label: string; icon: string; desc: string }][]).map(([key, info]) => (
                <button key={key} onClick={() => toggleRecipient(key)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${form.recipients.includes(key) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <span>{info.icon}</span>
                  <div className="text-left"><p>{info.label}</p><p className="text-[10px] opacity-70">{info.desc}</p></div>
                  {form.recipients.includes(key) && <span className="ml-1 text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="border border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">📎 Attachments & Link <span className="text-gray-400 font-normal">(optional)</span></p>
            <div><Label className="mb-1 block">Reference Link</Label><Input type="url" value={form.link} placeholder="https://… (optional)" onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} /></div>
            <div>
              <Label className="mb-1 block">Upload Files</Label>
              <label className={`flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}`}>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={handleFiles} className="hidden" />
                <span className="text-xl">{uploading ? '⏳' : '📎'}</span>
                <div><p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{uploading ? 'Processing…' : 'Click to attach files'}</p><p className="text-[10px] text-gray-400">PDF, JPG, PNG, DOC, XLS, ZIP · max 20 MB each</p></div>
              </label>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pendingFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl">
                      <span className="text-sm flex-shrink-0">{FILE_ICON[f.type] || '📎'}</span>
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{f.name}</p><p className="text-[10px] text-gray-400">{fmtBytes(f.size)}</p></div>
                      <button onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500 text-sm font-bold">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto rounded-xl">{submitting ? '⏳ Submitting…' : '✈️ Submit Daily Report'}</Button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Reports</h3><p className="text-xs text-gray-400 mt-0.5">Latest 5 of {entries.length} reports</p></div>
              <Button size="sm" className="rounded-xl" onClick={() => { setFilterPeriod('all'); setPageView('full'); }}>View Full Report →</Button>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">{entries.slice(0, 5).map((e) => <EntryCard key={e.id} e={e} />)}</div>
          <div className="px-5 py-2.5 border-t border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-400">{entries.length} total report{entries.length !== 1 ? 's' : ''}</p></div>
        </div>
      )}

      <ViewModal /><EditModal /><DeleteConfirmDialog desc="This action cannot be undone." />
    </div>
  );
}
