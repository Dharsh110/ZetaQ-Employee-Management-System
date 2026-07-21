import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGetMyTasksQuery, useSubmitTaskUpdateMutation } from '../../store/api/tasksApi';
import { useUploadFileMutation } from '../../store/api/uploadsApi';

type PendingFile = { file: File; base64: string };
type SubmittedFile = { name: string; size: number; type: string; uploadId?: string };

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Must match the backend Task model's status enum exactly (apps/api/src/models/Task.ts) —
// any value outside this list fails Mongoose validation and silently never persists.
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

type AssignedTask = { id: string; title: string; description: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; assignedBy: string; dueDate: string; myStatus: TaskStatus };

const STATUSES: { value: TaskStatus; label: string; pct: number; color: string }[] = [
  { value: 'pending', label: 'Pending', pct: 0, color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  { value: 'in_progress', label: 'In Progress', pct: 40, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  { value: 'overdue', label: 'Overdue', pct: 0, color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  { value: 'cancelled', label: 'Cancelled', pct: 0, color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400' },
];

const P_CLR: Record<string, string> = {
  Urgent: 'bg-red-100 dark:bg-red-900/30 text-red-600', High: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  Medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', Low: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
};

const todayStr = new Date().toISOString().slice(0, 10);

const autoOverdue = (tasks: AssignedTask[]): AssignedTask[] =>
  tasks.map((t) => (t.dueDate < todayStr && t.myStatus !== 'completed' && t.myStatus !== 'cancelled' && t.myStatus !== 'overdue' ? { ...t, myStatus: 'overdue' as TaskStatus } : t));

export default function NewTask() {
  const { data: apiTasks } = useGetMyTasksQuery();
  const [submitTaskUpdate] = useSubmitTaskUpdateMutation();
  const [uploadFile] = useUploadFileMutation();

  const [filterS, setFilterS] = useState<TaskStatus | 'all'>('all');
  const [confirm, setConfirm] = useState<AssignedTask | null>(null);
  const [note, setNote] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelTask, setCancelTask] = useState<AssignedTask | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const tasks: AssignedTask[] = autoOverdue((apiTasks || []).map((t) => ({
    id: t._id, title: t.title, description: t.description || '',
    priority: (t.priority ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : 'Medium') as AssignedTask['priority'],
    assignedBy: typeof t.assignedBy === 'object' ? (t.assignedBy as any)?.name || 'Admin' : 'Admin',
    dueDate: t.dueDate?.slice(0, 10) || '',
    myStatus: (t.status || 'pending') as TaskStatus,
  })));

  const updateStatus = useCallback(async (id: string, status: TaskStatus) => {
    const label = STATUSES.find((s) => s.value === status)?.label || status;
    try {
      await submitTaskUpdate({ id, status }).unwrap();
      toast.success(`Status updated to "${label}"`);
    } catch {
      toast.error(`Failed to update status to "${label}"`);
    }
  }, [submitTaskUpdate]);

  const confirmComplete = (task: AssignedTask) => { setConfirm(task); setNote(''); setPendingFiles([]); };

  const doCancel = async () => {
    if (!cancelTask || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await submitTaskUpdate({ id: cancelTask.id, status: 'cancelled', submittedDescription: cancelReason.trim() }).unwrap();
      toast.success(`"${cancelTask.title}" cancelled — admin & manager notified.`);
      setCancelTask(null);
      setCancelReason('');
    } catch {
      toast.error('Failed to cancel task');
    } finally {
      setCancelling(false);
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const read = await Promise.all(Array.from(fileList).map(async (file) => ({ file, base64: await readFileAsBase64(file) })));
    setPendingFiles((p) => [...p, ...read]);
  };
  const removeFile = (idx: number) => setPendingFiles((p) => p.filter((_, i) => i !== idx));

  const doComplete = async () => {
    if (!confirm) return;
    setSubmitting(true);
    try {
      const submittedFiles: SubmittedFile[] = [];
      for (const pf of pendingFiles) {
        try {
          const uploaded = await uploadFile({ originalName: pf.file.name, mimeType: pf.file.type, size: pf.file.size, data: pf.base64, category: 'report' }).unwrap();
          submittedFiles.push({ name: pf.file.name, size: pf.file.size, type: pf.file.type, uploadId: uploaded._id });
        } catch {
          submittedFiles.push({ name: pf.file.name, size: pf.file.size, type: pf.file.type });
        }
      }
      await submitTaskUpdate({ id: confirm.id, status: 'completed', hoursWorked: 0, submittedDescription: note.trim() || undefined, submittedFiles }).unwrap();
      toast.success(`"${confirm.title}" marked as completed! ✅`);
      setConfirm(null);
    } catch {
      toast.error('Failed to submit task update');
    } finally {
      setSubmitting(false);
    }
  };

  const activeTasks = tasks.filter((t) => t.myStatus !== 'completed');
  const displayed = filterS === 'all' ? activeTasks : activeTasks.filter((t) => t.myStatus === filterS);
  const completedCount = tasks.filter((t) => t.myStatus === 'completed').length;
  const getStatusInfo = (s: TaskStatus) => STATUSES.find((x) => x.value === s) || STATUSES[0];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="relative z-10">
          <h2 className="text-sm font-bold">My New Tasks</h2>
          <p className="text-blue-100 text-xs mt-0.5">Update task status — mark completed when done</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl">{activeTasks.length} active</span>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl">{completedCount} completed (moved to My Tasks)</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={filterS === 'all' ? 'default' : 'secondary'} className="rounded-lg text-[11px]" onClick={() => setFilterS('all')}>All ({activeTasks.length})</Button>
          {STATUSES.map((s) => (
            <Button key={s.value} size="sm" variant={filterS === s.value ? 'default' : 'secondary'} className={`rounded-lg text-[11px] ${filterS !== s.value ? s.color : ''}`} onClick={() => setFilterS(s.value)}>
              {s.label} ({activeTasks.filter((t) => t.myStatus === s.value).length})
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-14 text-center">
            <span className="text-4xl">✅</span>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3">
              {filterS === 'all' ? 'No active tasks! Great work.' : `No tasks with status "${STATUSES.find((s) => s.value === filterS)?.label}"`}
            </p>
            <p className="text-xs text-gray-400 mt-1">Completed tasks are moved to My Tasks page.</p>
          </div>
        ) : displayed.map((task) => {
          const si = getStatusInfo(task.myStatus);
          const pct = si.pct;
          return (
            <div key={task.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{task.title}</p>
                    <Badge className={P_CLR[task.priority]}>{task.priority}</Badge>
                    <Badge className={si.color}>{si.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{task.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="text-[10px] text-gray-400">👤 {task.assignedBy}</span>
                    <span className={`text-[10px] font-semibold ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>📅 Due: {task.dueDate}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct === 0 ? 'bg-red-400' : pct >= 80 ? 'bg-purple-500' : pct >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-500 w-8 text-right">{pct}%</span>
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col gap-1.5 min-w-[160px]">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Update Status</p>
                  {STATUSES.map((s) => (
                    <button key={s.value} onClick={() => { if (s.value === 'cancelled') { setCancelTask(task); setCancelReason(''); } else { updateStatus(task.id, s.value); } }}
                      className={`text-[11px] px-3 py-1.5 rounded-xl border font-semibold text-left transition-all ${task.myStatus === s.value ? s.color + ' border-current shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {task.myStatus === s.value ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                  <Button onClick={() => confirmComplete(task)} className="mt-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[11px]">✅ Mark Complete</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o: boolean) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="flex-col items-center text-center border-0 pt-6">
            <span className="text-4xl">✅</span>
            <DialogTitle className="mt-3">Mark as Completed?</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-2 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              Are you sure you want to mark <strong>"{confirm?.title}"</strong> as completed?
              It will be removed from New Tasks and saved in <strong>My Tasks → Completed</strong>.
            </p>
            <div>
              <Label className="mb-1 block">Submission note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What did you complete? Any notes for your manager…" />
            </div>
            <div>
              <Label className="mb-1 block">Attach files (optional)</Label>
              <input type="file" multiple onChange={(e) => handleFiles(e.target.files)}
                className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900/20 file:text-emerald-600 dark:file:text-emerald-400 hover:file:opacity-80" />
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pendingFiles.map((pf, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="text-sm flex-shrink-0">📎</span>
                      <span className="flex-1 min-w-0 text-[11px] text-gray-600 dark:text-gray-300 truncate">{pf.file.name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{(pf.file.size / 1024).toFixed(1)} KB</span>
                      <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1 rounded-xl" disabled={submitting} onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={submitting} onClick={doComplete}>{submitting ? 'Submitting…' : 'Yes, Complete It'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTask} onOpenChange={(o: boolean) => !o && setCancelTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="flex-col items-center text-center border-0 pt-6">
            <span className="text-4xl">❌</span>
            <DialogTitle className="mt-3">Cancel this task?</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-2 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              Please explain why you're cancelling <strong>"{cancelTask?.title}"</strong>. Your admin and manager will be notified with this reason.
            </p>
            <div>
              <Label className="mb-1 block">Reason for cancellation <span className="text-red-500">*</span></Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="e.g. Task is no longer needed, duplicate of another task…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1 rounded-xl" disabled={cancelling} onClick={() => setCancelTask(null)}>Back</Button>
            <Button variant="destructive" className="flex-1 rounded-xl" disabled={cancelling || !cancelReason.trim()} onClick={doCancel}>{cancelling ? 'Cancelling…' : 'Confirm Cancel'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
