import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetTasksQuery, useCreateTaskMutation, useUpdateTaskMutation } from '../../store/api/tasksApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { mapApiTaskToRow, buildTaskColumns, type TaskRow } from './tasks-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayStr = new Date().toISOString().slice(0, 10);
const twoWeeksAgo = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
type PageView = 'main' | 'completed' | 'all';
type FD = { title: string; assignedTo: string; priority: string; due: string; description: string };
const BLANK: FD = { title: '', assignedTo: '', priority: 'medium', due: '', description: '' };

export default function AdminTasks() {
  const { data: apiTasks = [], isLoading } = useGetTasksQuery();
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const DEPT_NAMES = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);

  const tasks = useMemo(() => apiTasks.map(mapApiTaskToRow), [apiTasks]);

  const [pageView, setPageView] = useState<PageView>('main');
  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [deptF, setDeptF] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FD>(BLANK);
  const [compDateF, setCompDateF] = useState('');
  const [compDeptF, setCompDeptF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [empF, setEmpF] = useState('');
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees]);

  const saveTask = async () => {
    if (!form.title.trim() || !form.assignedTo || !form.due) { toast.error('Fill required fields'); return; }
    try {
      await createTask({ title: form.title, assignedTo: form.assignedTo, priority: form.priority, dueDate: form.due, description: form.description }).unwrap();
      toast.success('Task assigned!');
      setModal(false); setForm(BLANK);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to assign task');
    }
  };

  const changeStatus = async (row: TaskRow, status: string) => {
    try { await updateTask({ id: row.id, status }).unwrap(); toast.success('Status updated'); }
    catch { toast.error('Failed to update status'); }
  };

  const columns = useMemo(() => buildTaskColumns({ onStatusChange: changeStatus }), []);
  const SelBox = (props: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; className?: string }) => (
    <Select value={props.value || 'all'} onValueChange={(v: string) => props.onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className={props.className || 'h-8 w-36 text-xs'}><SelectValue placeholder={props.placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value="all">{props.placeholder}</SelectItem>{props.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );

  const recentTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && (t.due >= twoWeeksAgo || t.created >= twoWeeksAgo)), [tasks]);
  const recentFiltered = useMemo(() => recentTasks.filter((t) => (!deptF || t.dept === deptF) && (!empF || t.assignee === empF)), [recentTasks, deptF, empF]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks]);
  const filteredCompleted = useMemo(() => completedTasks.filter((t) => (!compDateF || t.due === compDateF) && (!compDeptF || t.dept === compDeptF)), [completedTasks, compDateF, compDeptF]);
  const remainingTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due < twoWeeksAgo && t.created < twoWeeksAgo), [tasks]);

  const allFiltered = useMemo(() => {
    const base = tasks.filter((t) => t.status !== 'completed');
    return base.filter((t) => {
      const inPeriod = period === 'all' ? true
        : period === 'today' ? t.due === todayStr
        : period === 'week' ? (t.due >= twoWeeksAgo && t.due <= todayStr)
        : period === 'month' ? (() => { const d = new Date(t.due); return d.getMonth() === selMonth && d.getFullYear() === selYear; })()
        : (() => { const d = new Date(t.due); return d.getFullYear() === selYear; })();
      return inPeriod && (!deptF || t.dept === deptF) && (!statusF || t.status === statusF) && (!empF || t.assignee === empF);
    });
  }, [tasks, period, selMonth, selYear, deptF, statusF, empF]);

  const goToAll = (status: string) => { setStatusF(status); setPeriod('all'); setPageView('all'); };

  const AssignDialog = (
    <Dialog open={modal} onOpenChange={setModal}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign New Task</DialogTitle></DialogHeader>
        <DialogBody>
          <div><Label>Task Title *</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Implement login flow" /></div>
          <div>
            <Label>Assignee *</Label>
            <Select value={form.assignedTo} onValueChange={(v: string) => setForm((p) => ({ ...p, assignedTo: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{apiEmployees.map((e) => <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Due Date *</Label><Input className="mt-1" type="date" value={form.due} onChange={(e) => setForm((p) => ({ ...p, due: e.target.value }))} /></div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v: string) => setForm((p) => ({ ...p, priority: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Task details…" /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
          <Button className="flex-1" onClick={saveTask}>Assign Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (pageView === 'completed') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => setPageView('main')}><ArrowLeft className="w-3.5 h-3.5" /> Back to Tasks</Button>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Completed Tasks ({completedTasks.length})</h2>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Filter:</span>
        <Input type="date" value={compDateF} onChange={(e) => setCompDateF(e.target.value)} className="h-8 text-xs w-36" />
        <SelBox value={compDeptF} onChange={setCompDeptF} options={DEPT_NAMES} placeholder="All Departments" />
        {(compDateF || compDeptF) && <button onClick={() => { setCompDateF(''); setCompDeptF(''); }} className="text-[10px] text-blue-500 hover:underline">Clear</button>}
        <span className="ml-auto text-xs text-gray-400">{filteredCompleted.length} task{filteredCompleted.length !== 1 ? 's' : ''}</span>
      </div>
      <DataTable columns={columns} data={filteredCompleted} isLoading={isLoading} emptyMessage={completedTasks.length === 0 ? 'No completed tasks yet' : 'No tasks match the filter'} />
    </div>
  );

  if (pageView === 'all') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => setPageView('main')}><ArrowLeft className="w-3.5 h-3.5" /> Back to Tasks</Button>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">All Active Tasks</h2>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {([['all', 'All'], ['today', 'Today'], ['week', 'This Week'], ['month', 'Month'], ['year', 'Year']] as [Period, string][]).map(([v, l]) => (
            <Button key={v} size="sm" variant={period === v ? 'default' : 'secondary'} onClick={() => setPeriod(v)}>{l}</Button>
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
        <SelBox value={deptF} onChange={setDeptF} options={DEPT_NAMES} placeholder="All Depts" />
        <SelBox value={statusF} onChange={setStatusF} options={['pending', 'in_progress', 'overdue']} placeholder="All Status" />
        <SelBox value={empF} onChange={setEmpF} options={empNames} placeholder="All Employees" className="h-8 w-44 text-xs" />
        <span className="text-xs text-gray-400">{allFiltered.length} task{allFiltered.length !== 1 ? 's' : ''}</span>
      </div>
      <DataTable columns={columns} data={allFiltered} isLoading={isLoading} emptyMessage="No tasks found for selected filter" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Task Tracker</h2>
          <p className="text-xs text-gray-400 mt-0.5">Showing tasks created or due within the last 2 weeks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setPageView('completed')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100">✅ Completed Tasks ({completedTasks.length})</Button>
          <Button variant="secondary" size="sm" onClick={() => { setStatusF(''); setPageView('all'); }} className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100">📋 All Active Tasks →</Button>
          <Button size="sm" onClick={() => setModal(true)}>+ Assign Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Tasks', v: tasks.length, c: 'blue', action: () => goToAll('') },
          { l: 'In Progress', v: tasks.filter((t) => t.status === 'in_progress').length, c: 'blue', action: () => goToAll('in_progress') },
          { l: 'Overdue', v: tasks.filter((t) => t.status === 'overdue').length, c: 'red', action: () => goToAll('overdue') },
          { l: 'Completed', v: tasks.filter((t) => t.status === 'completed').length, c: 'emerald', action: () => setPageView('completed') },
        ].map((s) => (
          <button key={s.l} onClick={s.action} className={`text-center bg-${s.c}-50 dark:bg-${s.c}-900/20 border border-${s.c}-100 dark:border-${s.c}-800 rounded-2xl p-3.5 hover:shadow-md transition-all`}>
            <p className={`text-2xl font-bold text-${s.c}-600 dark:text-${s.c}-400`}>{s.v}</p>
            <p className={`text-[10px] font-semibold text-${s.c}-600 dark:text-${s.c}-400 mt-0.5`}>{s.l}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Department-wise Task Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>{['Department', 'Assigned', 'In Progress', 'Completed', 'Pending', 'Overdue'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {DEPT_NAMES.map((dept) => {
                const dTasks = tasks.filter((t) => t.dept === dept);
                const ip = dTasks.filter((t) => t.status === 'in_progress').length;
                const cp = dTasks.filter((t) => t.status === 'completed').length;
                const pd = dTasks.filter((t) => t.status === 'pending').length;
                const ov = dTasks.filter((t) => t.status === 'overdue').length;
                return (
                  <tr key={dept} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{dept}</span></td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-300">{dTasks.length}</td>
                    <td className="px-4 py-3"><span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold ' + (ip > 0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>{ip}</span></td>
                    <td className="px-4 py-3"><span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold ' + (cp > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>{cp}</span></td>
                    <td className="px-4 py-3"><span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold ' + (pd > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>{pd}</span></td>
                    <td className="px-4 py-3"><span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold ' + (ov > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>{ov}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Recent Tasks — Last 2 Weeks</p>
        <div className="flex items-center gap-2">
          <SelBox value={deptF} onChange={setDeptF} options={DEPT_NAMES} placeholder="All Departments" />
          <SelBox value={empF} onChange={setEmpF} options={empNames} placeholder="All Employees" className="h-8 w-44 text-xs" />
          <span className="text-xs text-gray-400">{recentFiltered.length} task{recentFiltered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <DataTable columns={columns} data={recentFiltered} isLoading={isLoading} emptyMessage="No recent tasks match the filter" />
      {remainingTasks.length > 0 && (
        <button onClick={() => setPageView('all')} className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium">
          + {remainingTasks.length} more older task{remainingTasks.length !== 1 ? 's' : ''} — View all active tasks →
        </button>
      )}

      {AssignDialog}
    </div>
  );
}
