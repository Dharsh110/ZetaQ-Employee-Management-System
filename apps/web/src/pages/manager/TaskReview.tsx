import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useGetTasksQuery, useCreateTaskMutation, useUpdateTaskMutation } from '../../store/api/tasksApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useUploadFileMutation } from '../../store/api/uploadsApi';
import { mapApiTaskToRow, type TaskRow } from '../admin/tasks-columns';
import type { ApiTask } from '../../store/api/tasksApi';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayStr = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

type Period = 'all' | 'today' | 'month' | 'year';

const S_VARIANT: Record<ApiTask['status'], 'gray' | 'warning' | 'default' | 'success' | 'destructive'> = {
  pending: 'gray', in_progress: 'warning', completed: 'success', overdue: 'destructive', cancelled: 'gray',
};
const P_VARIANT: Record<ApiTask['priority'], 'gray' | 'default' | 'warning' | 'destructive'> = {
  low: 'gray', medium: 'default', high: 'warning', urgent: 'destructive',
};
const STATUS_LABELS: Record<ApiTask['status'], string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue', cancelled: 'Cancelled' };
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const BLANK_FORM = { title: '', description: '', dept: '', assignedTo: [] as string[], fullTeam: false, priority: 'medium', due: '', estHours: '', link: '' };

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ManagerTaskReview() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';

  const { data: apiTasks = [], isLoading } = useGetTasksQuery();
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [uploadFile] = useUploadFileMutation();

  const [deptF, setDeptF] = useState('');
  const [empF, setEmpF] = useState('');
  const effDept = myDept || deptF;
  // Departments visible in the page-level view filter and (for a scoped manager) the assign
  // modal are limited to their own department; the main manager (no myDept) sees all.
  const viewableDepts = useMemo(() => (myDept ? apiDepartments.filter((d) => d.name === myDept) : apiDepartments), [apiDepartments, myDept]);
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.filter((e) => !effDept || (typeof e.department === 'object' ? e.department?.name : e.department) === effDept).map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees, effDept]);

  const tasks = useMemo(
    () => apiTasks.map(mapApiTaskToRow).filter((t) => !effDept || t.dept === effDept),
    [apiTasks, effDept]
  );

  const [statusF, setStatusF] = useState<ApiTask['status'] | ''>('');
  const [priorityF, setPriorityF] = useState<ApiTask['priority'] | ''>('');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [showAdd, setShowAdd] = useState(false);
  const [viewTask, setViewTask] = useState<TaskRow | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [pendingFile, setPendingFile] = useState<{ file: File; base64: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inPeriod = (dateStr: string) => {
    if (!dateStr) return period === 'all';
    if (period === 'all') return true;
    if (period === 'today') return dateStr === todayStr;
    if (period === 'month') { const d = new Date(dateStr); return d.getMonth() === selMonth && d.getFullYear() === selYear; }
    if (period === 'year') return new Date(dateStr).getFullYear() === selYear;
    return true;
  };

  const cardBase = tasks.filter((t) => (!priorityF || t.priority === priorityF) && (!empF || t.assignee === empF) && inPeriod(t.due));
  const filtered = cardBase.filter((t) => !statusF || t.status === statusF);
  const counts: Record<string, number> = { '': cardBase.length };
  (['pending', 'in_progress', 'completed', 'overdue', 'cancelled'] as ApiTask['status'][]).forEach((s) => { counts[s] = cardBase.filter((t) => t.status === s).length; });

  const changeStatus = async (row: TaskRow, status: ApiTask['status']) => {
    try { await updateTask({ id: row.id, status }).unwrap(); toast.success(`Status updated to "${STATUS_LABELS[status]}"`); }
    catch { toast.error('Failed to update status'); }
  };

  // Employees available to assign to, scoped to the department chosen inside the modal itself
  // (defaults to the manager's own department if they're dept-scoped).
  const modalDeptEmployees = useMemo(
    () => apiEmployees.filter((e) => e.status === 'active' && (!form.dept || (typeof e.department === 'object' ? e.department?.name : e.department) === form.dept)),
    [apiEmployees, form.dept]
  );

  const toggleAssignee = (id: string) => setForm((p) => ({ ...p, assignedTo: p.assignedTo.includes(id) ? p.assignedTo.filter((x) => x !== id) : [...p.assignedTo, id], fullTeam: false }));
  const toggleFullTeam = () => setForm((p) => {
    const next = !p.fullTeam;
    return { ...p, fullTeam: next, assignedTo: next ? modalDeptEmployees.map((e) => e._id) : [] };
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile({ file, base64: await readFileAsBase64(file) });
    e.target.value = '';
  };

  const addTask = async () => {
    if (!form.title.trim() || form.assignedTo.length === 0 || !form.due) { toast.error('Fill required fields — title, at least one assignee, and due date'); return; }
    setSubmitting(true);
    try {
      let uploadId: string | undefined;
      let attachments: { name: string; size: number; type: string; uploadId?: string }[] | undefined;
      if (pendingFile) {
        try {
          const uploaded = await uploadFile({ originalName: pendingFile.file.name, mimeType: pendingFile.file.type, size: pendingFile.file.size, data: pendingFile.base64, category: 'document' }).unwrap();
          uploadId = uploaded._id;
          attachments = [{ name: pendingFile.file.name, size: pendingFile.file.size, type: pendingFile.file.type, uploadId }];
        } catch { toast.error('File upload failed — task will be created without the attachment'); }
      }
      await Promise.all(form.assignedTo.map((empId) =>
        createTask({
          title: form.title.trim(), assignedTo: empId, priority: form.priority, dueDate: form.due,
          description: form.description, hoursEstimated: Number(form.estHours) || 8,
          link: form.link.trim() || undefined, attachments,
        }).unwrap()
      ));
      toast.success(`Task assigned to ${form.assignedTo.length} employee${form.assignedTo.length !== 1 ? 's' : ''}`);
      setShowAdd(false);
      setForm(BLANK_FORM);
      setPendingFile(null);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to assign task');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<TaskRow>[] = [
    {
      accessorKey: 'title', header: 'Task', enableHiding: false,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{row.original.title}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full"><div className="h-full rounded-full bg-blue-500" style={{ width: `${row.original.progress}%` }} /></div>
            <span className="text-[10px] text-gray-400">{row.original.progress}%</span>
          </div>
        </div>
      ),
    },
    { accessorKey: 'assignee', header: 'Assigned To', cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{initials(row.original.assignee)}</div>
        <span className="text-xs text-gray-700 dark:text-gray-300">{row.original.assignee}</span>
      </div>
    ) },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={P_VARIANT[row.original.priority]} className="capitalize">{row.original.priority}</Badge> },
    { accessorKey: 'due', header: 'Due Date', cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-gray-300">{row.original.due}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={S_VARIANT[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge> },
    { id: 'actions', enableHiding: false, cell: ({ row }) => <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-blue-50 text-blue-600" onClick={() => setViewTask(row.original)}>View</Button> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {(['pending', 'in_progress', 'completed', 'overdue', 'cancelled'] as ApiTask['status'][]).map((s) => (
          <button key={s} onClick={() => setStatusF(s)} className={`border border-gray-200 dark:border-gray-700 rounded-2xl p-2.5 text-center hover:scale-105 transition-all ${s === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' : s === 'overdue' ? 'bg-red-50 dark:bg-red-900/10 text-red-500' : s === 'in_progress' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' : 'bg-gray-50 dark:bg-gray-700/30 text-gray-500'} ${statusF === s ? 'ring-2 ring-blue-500' : ''}`}>
            <p className="text-lg font-bold">{counts[s] ?? 0}</p>
            <p className="text-[9px] font-semibold leading-tight">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {(['all', 'today', 'month', 'year'] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} onClick={() => setPeriod(p)} className="capitalize">
                {p === 'all' ? 'All' : p === 'today' ? 'Today' : p}
              </Button>
            ))}
          </div>
          {period === 'month' && (
            <Select value={String(selMonth)} onValueChange={(v: string) => setSelMonth(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {(period === 'month' || period === 'year') && (
            <Select value={String(selYear)} onValueChange={(v: string) => setSelYear(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v as ApiTask['status'])}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem>{(['pending', 'in_progress', 'completed', 'overdue', 'cancelled'] as ApiTask['status'][]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priorityF || 'all'} onValueChange={(v: string) => setPriorityF(v === 'all' ? '' : v as ApiTask['priority'])}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Priority" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Priority</SelectItem>{['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
          {!myDept && (
            <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Departments</SelectItem>{viewableDepts.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-gray-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
          <Button size="sm" className="ml-auto" onClick={() => { setForm({ ...BLANK_FORM, dept: myDept || '' }); setPendingFile(null); setShowAdd(true); }}>+ Assign Task</Button>
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No tasks found" />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign New Task</DialogTitle></DialogHeader>
          <DialogBody>
            <div><Label>Title *</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Task title…" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>

            {!myDept && (
              <div>
                <Label>Department</Label>
                <Select value={form.dept || 'all'} onValueChange={(v: string) => setForm((p) => ({ ...p, dept: v === 'all' ? '' : v, assignedTo: [], fullTeam: false }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Assign To * <span className="text-gray-400 font-normal">(select one or more)</span></Label>
                <button type="button" onClick={toggleFullTeam} className={`text-[11px] px-2 py-1 rounded-lg font-semibold transition-colors ${form.fullTeam ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'}`}>
                  {form.fullTeam ? '✓ Full Team' : 'Select Full Team'}
                </button>
              </div>
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                {modalDeptEmployees.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No employees in this department</p>
                ) : modalDeptEmployees.map((e) => (
                  <label key={e._id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <Checkbox checked={form.assignedTo.includes(e._id)} onCheckedChange={() => toggleAssignee(e._id)} />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{e.firstName} {e.lastName}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{e.designation}</span>
                  </label>
                ))}
              </div>
              {form.assignedTo.length > 0 && <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">{form.assignedTo.length} employee{form.assignedTo.length !== 1 ? 's' : ''} selected</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: string) => setForm((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Due Date *</Label><Input className="mt-1" type="date" value={form.due} onChange={(e) => setForm((p) => ({ ...p, due: e.target.value }))} /></div>
            </div>
            <div><Label>Est. Hours</Label><Input className="mt-1" type="number" min="1" max="200" value={form.estHours} onChange={(e) => setForm((p) => ({ ...p, estHours: e.target.value }))} placeholder="8" /></div>

            <div className="border border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-3 space-y-2 bg-gray-50/50 dark:bg-gray-700/20">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Optional</p>
              <div><Label>Reference Link</Label><Input className="mt-1" type="url" value={form.link} placeholder="https://…" onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} /></div>
              <div>
                <Label>Attach File</Label>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                  <input type="file" onChange={handleFile} className="hidden" />
                  <span className="text-sm">📎</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{pendingFile ? pendingFile.file.name : 'Choose a file…'}</span>
                  {pendingFile && <button type="button" onClick={(e) => { e.preventDefault(); setPendingFile(null); }} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>}
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button className="flex-1" onClick={addTask} disabled={submitting}>{submitting ? 'Assigning…' : 'Assign Task'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTask} onOpenChange={(o: boolean) => !o && setViewTask(null)}>
        <DialogContent className="max-w-md">
          {viewTask && (
            <>
              <DialogHeader><DialogTitle className="truncate pr-4">{viewTask.title}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Assignee</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{viewTask.assignee}</p></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Due Date</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{viewTask.due}</p></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Priority</p><Badge variant={P_VARIANT[viewTask.priority]} className="capitalize mt-1">{viewTask.priority}</Badge></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase">Status</p><Badge variant={S_VARIANT[viewTask.status]} className="mt-1">{STATUS_LABELS[viewTask.status]}</Badge></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full"><div className="h-full rounded-full bg-blue-500" style={{ width: `${viewTask.progress}%` }} /></div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{viewTask.progress}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 leading-relaxed">{viewTask.description || 'No description'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['pending', 'in_progress', 'completed', 'cancelled'] as ApiTask['status'][]).map((s) => (
                      <Button key={s} size="sm" variant={viewTask.status === s ? 'default' : 'outline'} onClick={() => { changeStatus(viewTask, s); setViewTask(null); }}>
                        {viewTask.status === s ? '✓ ' : ''}{STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" className="w-full" onClick={() => setViewTask(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
