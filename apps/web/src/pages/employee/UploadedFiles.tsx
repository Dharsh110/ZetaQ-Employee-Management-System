import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useGetMyUploadsQuery, useUploadFileMutation, useUpdateUploadMutation, useDeleteUploadMutation, useLazyGetUploadByIdQuery } from '../../store/api/uploadsApi';

type UploadedFile = { id: string; name: string; size: number; type: string; base64?: string; uploadedAt: string; notes?: string };
type Period = 'all' | 'today' | 'month' | 'year';
type StatView = 'main' | 'total' | 'thismonth' | 'size';

const CY = new Date().getFullYear();
const YEARS_LIST = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
const fmtDT = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const FILE_ICON: Record<string, string> = {
  'application/pdf': '📄', 'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️', 'image/webp': '🖼️',
  'application/msword': '📝', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'text/plain': '📃', 'text/csv': '📊', 'application/zip': '🗜️', 'application/x-zip-compressed': '🗜️',
};
const TYPE_LABEL: Record<string, string> = {
  'application/pdf': 'PDF', 'image/jpeg': 'Image', 'image/png': 'Image', 'image/gif': 'Image', 'image/webp': 'Image',
  'application/msword': 'Word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'text/plain': 'Text', 'text/csv': 'CSV', 'application/zip': 'ZIP', 'application/x-zip-compressed': 'ZIP',
};
const isViewable = (type: string) => type.startsWith('image/') || type === 'application/pdf' || type === 'text/plain' || type === 'text/csv';
const getTypeKey = (type: string) => TYPE_LABEL[type] || 'Other';

export default function UploadedFiles() {
  const { data: apiFiles } = useGetMyUploadsQuery();
  const [uploadFileMut] = useUploadFileMutation();
  const [updateUpload] = useUpdateUploadMutation();
  const [deleteUploadMut] = useDeleteUploadMutation();
  const [fetchUpload] = useLazyGetUploadByIdQuery();

  const [localCache, setLocalCache] = useState<Record<string, string>>({});
  const files: UploadedFile[] = useMemo(() => (apiFiles || []).map((u) => ({
    id: u._id, name: u.originalName, size: u.size || 0, type: u.mimeType || 'application/octet-stream',
    base64: localCache[u._id], uploadedAt: u.uploadedAt || u.createdAt || '', notes: u.notes,
  })), [apiFiles, localCache]);

  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [typeF, setTypeF] = useState('');
  const [search, setSearch] = useState('');
  const [viewFile, setViewFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statView, setStatView] = useState<StatView>('main');
  const [svPeriod, setSvPeriod] = useState<'all' | 'month' | 'year'>('all');
  const [svMonth, setSvMonth] = useState(new Date().getMonth());
  const [svYear, setSvYear] = useState(CY);
  const [editFile, setEditFile] = useState<UploadedFile | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [svView, setSvView] = useState<UploadedFile | null>(null);
  const [svEdit, setSvEdit] = useState<UploadedFile | null>(null);
  const [svEditName, setSvEditName] = useState('');
  const [svDelId, setSvDelId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = new Date();
    return files.filter((f) => {
      const d = new Date(f.uploadedAt);
      let matchP = true;
      if (period === 'today') matchP = d.toDateString() === n.toDateString();
      else if (period === 'month') matchP = d.getFullYear() === selYear && d.getMonth() === selMonth;
      else if (period === 'year') matchP = d.getFullYear() === selYear;
      return matchP && (!typeF || f.type === typeF) && (!search || f.name.toLowerCase().includes(search.toLowerCase()));
    });
  }, [files, period, selMonth, selYear, typeF, search]);

  const thisMonthFiles = useMemo(() => files.filter((f) => { const d = new Date(f.uploadedAt); return d.getFullYear() === CY && d.getMonth() === new Date().getMonth(); }), [files]);

  const getTypeBreakdown = (list: UploadedFile[]) => {
    const map: Record<string, { count: number; size: number }> = {};
    list.forEach((f) => { const k = getTypeKey(f.type); if (!map[k]) map[k] = { count: 0, size: 0 }; map[k].count++; map[k].size += f.size; });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  };

  // List responses omit `data` (base64) for performance — fetch on demand and cache locally.
  const fetchFileData = async (f: UploadedFile): Promise<string | undefined> => {
    if (f.base64) return f.base64;
    const upload = await fetchUpload(f.id).unwrap();
    if (upload?.data) setLocalCache((prev) => ({ ...prev, [f.id]: upload.data as string }));
    return upload?.data;
  };

  const download = async (f: UploadedFile) => {
    try {
      const base64 = await fetchFileData(f);
      if (!base64) { toast.error('File data not available'); return; }
      const a = Object.assign(document.createElement('a'), { href: base64, download: f.name });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success(`Downloading ${f.name}`);
    } catch { toast.error('Download failed'); }
  };

  const openView = async (f: UploadedFile) => {
    try { const base64 = await fetchFileData(f); if (!base64) { toast.error('File data not available'); return; } setViewFile({ ...f, base64 }); }
    catch { toast.error('Failed to load file'); }
  };
  const openSvView = async (f: UploadedFile) => {
    try { const base64 = await fetchFileData(f); if (!base64) { toast.error('File data not available'); return; } setSvView({ ...f, base64 }); }
    catch { toast.error('Failed to load file'); }
  };

  const doDelete = async (targetId = deleteConfirmId) => {
    if (!targetId) return;
    try { await deleteUploadMut(targetId).unwrap(); toast.success('File deleted'); }
    catch { toast.error('Delete failed'); }
    setDeleteConfirmId(null); setSvDelId(null);
  };

  const openEdit = (f: UploadedFile) => { setEditFile(f); setEditName(f.name); setEditNotes(f.notes || ''); };

  const saveEdit = async () => {
    if (!editFile || !editName.trim()) { toast.error('File name cannot be empty'); return; }
    try { await updateUpload({ id: editFile.id, originalName: editName.trim(), notes: editNotes.trim() }).unwrap(); setEditFile(null); toast.success('File updated'); }
    catch { toast.error('Update failed'); }
  };
  const saveSvEdit = async () => {
    if (!svEdit || !svEditName.trim()) return;
    try { await updateUpload({ id: svEdit.id, originalName: svEditName.trim() }).unwrap(); setSvEdit(null); toast.success('File renamed'); }
    catch { toast.error('Rename failed'); }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    Promise.all(picked.map((file) => new Promise<void>((resolve, reject) => {
      const r = new FileReader();
      r.onload = async (ev) => {
        try {
          const base64 = ev.target?.result as string;
          const cat = file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') || file.type.includes('word') || file.type.includes('text') ? 'document' : 'other';
          await uploadFileMut({ originalName: file.name, mimeType: file.type, size: file.size, data: base64, category: cat }).unwrap();
          resolve();
        } catch (err) { reject(err); }
      };
      r.readAsDataURL(file);
    }))).then(() => { setUploading(false); toast.success(`${picked.length} file${picked.length !== 1 ? 's' : ''} uploaded & saved to DB`); })
      .catch(() => { setUploading(false); toast.error('Upload failed'); });
    e.target.value = '';
  };

  const uniqueTypes = [...new Set(files.map((f) => f.type))].filter(Boolean);

  // ── STAT BREAKDOWN VIEW ──
  if (statView !== 'main') {
    const baseList = statView === 'thismonth' ? thisMonthFiles : files;
    const svList = baseList.filter((f) => {
      if (svPeriod === 'month') { const d = new Date(f.uploadedAt); return d.getMonth() === svMonth && d.getFullYear() === svYear; }
      if (svPeriod === 'year') return new Date(f.uploadedAt).getFullYear() === svYear;
      return true;
    });
    const titleMap: Record<StatView, string> = { main: '', total: 'Total Files', thismonth: 'This Month', size: 'Total Size' };
    const breakdown = getTypeBreakdown(svList);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setStatView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{titleMap[statView]} ({svList.length})</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'month', 'year'] as const).map((p) => (
              <Button key={p} size="sm" variant={svPeriod === p ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setSvPeriod(p)}>{p === 'all' ? 'All Time' : p === 'month' ? 'Month' : 'Year'}</Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {breakdown.length === 0 ? (
            <div className="col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center"><span className="text-3xl">📁</span><p className="text-sm text-gray-500 mt-2">No files here</p></div>
          ) : breakdown.map(([type, data]) => (
            <div key={type} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-2xl mb-2">{FILE_ICON[Object.keys(FILE_ICON).find((k) => TYPE_LABEL[k] === type) || ''] || '📎'}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{type}</p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">{data.count} file{data.count !== 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtBytes(data.size)}</p>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700"><p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Files ({svList.length})</p></div>
          {svList.length === 0 ? (
            <div className="p-8 text-center"><span className="text-3xl">📁</span><p className="text-sm text-gray-500 mt-2">No files</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {svList.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <span className="text-xl">{FILE_ICON[f.type] || '📎'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-400">{getTypeKey(f.type)} · {fmtBytes(f.size)} · {fmtDT(f.uploadedAt)}</p>
                    {f.notes && <p className="text-[10px] text-blue-500 mt-0.5">📝 {f.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isViewable(f.type) && <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" onClick={() => openSvView(f)}>👁 View</Button>}
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600" onClick={() => download(f)}>⬇ DL</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600" onClick={() => { setSvEdit(f); setSvEditName(f.name); }}>✏️ Edit</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-500" onClick={() => setSvDelId(f.id)}>🗑 Del</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!svView} onOpenChange={(o: boolean) => !o && setSvView(null)}>
          <DialogContent className="max-w-3xl">
            {svView && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{FILE_ICON[svView.type] || '📎'}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[280px]">{svView.name}</p>
                      <p className="text-[10px] text-gray-400">{TYPE_LABEL[svView.type] || 'File'} · {fmtBytes(svView.size)} · {fmtDT(svView.uploadedAt)}</p>
                    </div>
                  </div>
                  {svView.base64 && <Button size="sm" onClick={() => download(svView)}>⬇ Download</Button>}
                </DialogHeader>
                <div className="flex-1 overflow-auto p-4">
                  {svView.type.startsWith('image/') && svView.base64 && <img src={svView.base64} alt={svView.name} className="max-w-full max-h-full mx-auto rounded-lg object-contain" />}
                  {svView.type === 'application/pdf' && svView.base64 && <iframe src={svView.base64} title={svView.name} className="w-full h-[60vh] rounded-lg border border-gray-200" />}
                  {(svView.type === 'text/plain' || svView.type === 'text/csv') && svView.base64 && <TextFileViewer base64={svView.base64} />}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!svEdit} onOpenChange={(o: boolean) => !o && setSvEdit(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit File Name</DialogTitle></DialogHeader>
            <div className="p-5"><Label className="mb-1 block">File Name *</Label><Input value={svEditName} onChange={(e) => setSvEditName(e.target.value)} /></div>
            <DialogFooter><Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSvEdit(null)}>Cancel</Button><Button className="flex-1 rounded-xl" onClick={saveSvEdit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!svDelId} onOpenChange={(o: boolean) => !o && setSvDelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><span className="text-4xl">🗑️</span><AlertDialogTitle>Remove File?</AlertDialogTitle><AlertDialogDescription>This file will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => setSvDelId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => doDelete(svDelId!)}>Remove</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── MAIN VIEW ──
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'total' as StatView, label: 'Total Files', value: filtered.length, icon: '📁', color: 'from-blue-500 to-blue-600' },
          { key: 'thismonth' as StatView, label: 'This Month', value: filtered.filter((f) => { const d = new Date(f.uploadedAt); return d.getFullYear() === CY && d.getMonth() === new Date().getMonth(); }).length, icon: '📅', color: 'from-purple-500 to-purple-600' },
          { key: 'size' as StatView, label: 'Total Size', value: fmtBytes(filtered.reduce((s, f) => s + f.size, 0)), icon: '💾', color: 'from-emerald-500 to-emerald-600' },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white`}>
            <span className="text-xl block mb-1">{s.icon}</span>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] opacity-80 font-semibold">{s.label}</p>
            <button onClick={() => setStatView(s.key)} className="mt-2 text-[9px] px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all">View breakdown →</button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by name…" className="w-44 h-8 text-xs" />
          {(['all', 'today', 'month', 'year'] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} className="rounded-lg text-[11px] capitalize" onClick={() => setPeriod(p)}>{p === 'all' ? 'All Time' : p}</Button>
          ))}
          {period === 'month' && <select value={selMonth} onChange={(e) => setSelMonth(+e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">{MOS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>}
          {(period === 'month' || period === 'year') && <select value={selYear} onChange={(e) => setSelYear(+e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">{YEARS_LIST.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            <option value="">All Types</option>
            {uniqueTypes.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
          </select>
          <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">{filtered.length} file{filtered.length !== 1 ? 's' : ''} · {fmtBytes(filtered.reduce((s, f) => s + f.size, 0))}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">📤 Upload Files</p>
        <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer font-semibold text-sm transition-all shadow ${uploading ? 'bg-blue-100 text-blue-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={handleUpload} className="hidden" />
          <span>{uploading ? '⏳' : '⬆️'}</span>{uploading ? 'Uploading…' : 'Upload File'}
        </label>
        <p className="text-[10px] text-gray-400 mt-2">PDF, Image, Word, Excel, CSV, ZIP — multiple files allowed</p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700"><p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Files ({filtered.length})</p></div>
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="text-4xl">📁</span>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-3">{files.length === 0 ? 'No files uploaded yet' : 'No files match this filter'}</p>
            <p className="text-xs text-gray-400 mt-1">{files.length === 0 ? 'Use the Upload section above or attach files in Daily Report.' : 'Try a different filter.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map((f) => (
              <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl flex-shrink-0">{FILE_ICON[f.type] || '📎'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{f.name}</p>
                  <span className="text-[10px] text-gray-400">{TYPE_LABEL[f.type] || 'File'} · {fmtBytes(f.size)} · {fmtDT(f.uploadedAt)}</span>
                  {f.notes && <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">📝 {f.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isViewable(f.type) && <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" onClick={() => openView(f)}>👁 View</Button>}
                  <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" onClick={() => openEdit(f)}>✏️ Edit</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" onClick={() => download(f)}>⬇ Download</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2.5 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400" onClick={() => setDeleteConfirmId(f.id)}>🗑 Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editFile} onOpenChange={(o: boolean) => !o && setEditFile(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit File Details</DialogTitle></DialogHeader>
          <div className="p-5 space-y-3">
            {editFile && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <span className="text-2xl">{FILE_ICON[editFile.type] || '📎'}</span>
                <div><p className="text-[10px] text-gray-400">{TYPE_LABEL[editFile.type] || 'File'} · {fmtBytes(editFile.size)}</p><p className="text-[10px] text-gray-400">Uploaded {fmtDT(editFile.uploadedAt)}</p></div>
              </div>
            )}
            <div><Label className="mb-1 block">File Name *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label className="mb-1 block">Notes (optional)</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Add a note about this file…" /></div>
          </div>
          <DialogFooter><Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditFile(null)}>Cancel</Button><Button className="flex-1 rounded-xl" onClick={saveEdit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o: boolean) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><span className="text-4xl">🗑️</span><AlertDialogTitle>Remove File?</AlertDialogTitle><AlertDialogDescription>This file will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => doDelete()}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewFile} onOpenChange={(o: boolean) => !o && setViewFile(null)}>
        <DialogContent className="max-w-3xl">
          {viewFile && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{FILE_ICON[viewFile.type] || '📎'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[300px]">{viewFile.name}</p>
                    <p className="text-[10px] text-gray-400">{TYPE_LABEL[viewFile.type] || 'File'} · {fmtBytes(viewFile.size)} · {fmtDT(viewFile.uploadedAt)}</p>
                  </div>
                </div>
                {viewFile.base64 && <Button size="sm" onClick={() => download(viewFile)}>⬇ Download</Button>}
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4">
                {viewFile.type.startsWith('image/') && viewFile.base64 && <img src={viewFile.base64} alt={viewFile.name} className="max-w-full max-h-full mx-auto rounded-lg object-contain" />}
                {viewFile.type === 'application/pdf' && viewFile.base64 && <iframe src={viewFile.base64} title={viewFile.name} className="w-full h-[60vh] rounded-lg border border-gray-200 dark:border-gray-600" />}
                {(viewFile.type === 'text/plain' || viewFile.type === 'text/csv') && viewFile.base64 && <TextFileViewer base64={viewFile.base64} />}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TextFileViewer({ base64 }: { base64: string }) {
  const [content, setContent] = React.useState('');
  React.useEffect(() => {
    try { setContent(atob(base64.split(',')[1])); } catch { setContent('Unable to decode file content.'); }
  }, [base64]);
  return <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words font-mono">{content || 'Loading…'}</pre>;
}
