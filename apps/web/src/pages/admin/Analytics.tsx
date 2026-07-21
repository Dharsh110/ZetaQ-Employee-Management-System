import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetLeavesQuery } from '../../store/api/leavesApi';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const STATUS_CLR_TASK: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-500',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
};

type Emp = { id: string; name: string; dept: string; role: string; salary: number; status: string; joined: string };
type DeptStat = { dept: string; count: number; active: number; inactive: number; avgSalary: number };
type TaskStat = { dept: string; total: number; completed: number; inProgress: number; pending: number };
type LeaveStat = { type: string; count: number };
type TaskRow = { title: string; assignee: string; status: string; priority: string; due: string };

type ModalType = 'total' | 'active' | 'inactive' | 'salary' | 'dept' | null;
type PageView = 'main' | 'earners' | 'task-detail' | 'emp-detail';

const ALL_LEAVE_TYPES = ['casual', 'sick', 'earned', 'maternity', 'paternity', 'half_day', 'unpaid'];

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { data: apiEmployees = [], isLoading: empLoading } = useGetEmployeesQuery();
  const { data: apiTasks = [], isLoading: taskLoading } = useGetTasksQuery();
  const { data: apiLeaves = [], isLoading: leaveLoading } = useGetLeavesQuery();
  const loading = empLoading || taskLoading || leaveLoading;

  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [modal, setModal] = useState<ModalType>(null);
  const [deptView, setDeptView] = useState('');
  const [pageView, setPageView] = useState<PageView>('main');
  const [earnerDeptF, setEarnerDeptF] = useState('');
  const [taskDept, setTaskDept] = useState('');

  const employees: Emp[] = useMemo(
    () =>
      apiEmployees.map((e) => ({
        id: e.employeeCode || e._id,
        name: `${e.firstName} ${e.lastName}`,
        dept: typeof e.department === 'object' ? e.department?.name || '' : '',
        role: e.designation || 'Employee',
        salary: e.salary || 0,
        status: e.status || 'active',
        joined: e.joiningDate?.slice(0, 10) || '',
      })),
    [apiEmployees]
  );

  const DEPTS = useMemo(() => Array.from(new Set(employees.map((e) => e.dept).filter(Boolean))), [employees]);

  const deptStats: DeptStat[] = useMemo(() => {
    const deptMap: Record<string, DeptStat> = {};
    employees.forEach((e) => {
      if (!e.dept) return;
      if (!deptMap[e.dept]) deptMap[e.dept] = { dept: e.dept, count: 0, active: 0, inactive: 0, avgSalary: 0 };
      deptMap[e.dept].count++;
      if (e.status === 'active') deptMap[e.dept].active++;
      else deptMap[e.dept].inactive++;
      deptMap[e.dept].avgSalary += e.salary;
    });
    Object.values(deptMap).forEach((d) => { if (d.count > 0) d.avgSalary = Math.round(d.avgSalary / d.count); });
    return Object.values(deptMap);
  }, [employees]);

  const { taskStats, taskDetail } = useMemo(() => {
    const tMap: Record<string, TaskStat> = {};
    const tDetail: Record<string, TaskRow[]> = {};
    apiTasks.forEach((t) => {
      const assignee = typeof t.assignedTo === 'object' ? t.assignedTo : null;
      const assigneeDept = assignee && typeof assignee.department === 'object' ? assignee.department?.name : '';
      const dept = (typeof t.department === 'object' ? t.department?.name : '') || assigneeDept || '';
      if (!dept) return;
      if (!tMap[dept]) tMap[dept] = { dept, total: 0, completed: 0, inProgress: 0, pending: 0 };
      tMap[dept].total++;
      if (t.status === 'completed') tMap[dept].completed++;
      else if (t.status === 'in_progress') tMap[dept].inProgress++;
      else tMap[dept].pending++;
      if (!tDetail[dept]) tDetail[dept] = [];
      tDetail[dept].push({
        title: t.title,
        assignee: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : '—',
        status: t.status || 'pending',
        priority: t.priority || 'medium',
        due: t.dueDate?.slice(0, 10) || '',
      });
    });
    return { taskStats: Object.values(tMap), taskDetail: tDetail };
  }, [apiTasks]);

  // Always include every leave type the backend supports (Leave.leaveType enum), even
  // ones with zero applications so far — not just types that happen to appear in the data.
  const leaveStats: LeaveStat[] = useMemo(() => {
    const lMap: Record<string, number> = Object.fromEntries(ALL_LEAVE_TYPES.map((t) => [t, 0]));
    apiLeaves.forEach((l) => { lMap[l.leaveType] = (lMap[l.leaveType] || 0) + 1; });
    return Object.entries(lMap).map(([type, count]) => ({ type, count }));
  }, [apiLeaves]);

  const totalEmp = employees.length;
  const activeEmp = employees.filter((e) => e.status === 'active').length;
  const inactiveEmp = employees.filter((e) => e.status === 'inactive').length;
  const avgSalary = totalEmp > 0 ? Math.round(employees.reduce((s, e) => s + e.salary, 0) / totalEmp) : 0;
  const totalTasks = taskStats.reduce((s, d) => s + d.total, 0);
  const doneTasks = taskStats.reduce((s, d) => s + d.completed, 0);

  const modalEmps = useMemo(() => {
    if (modal === 'total') return employees;
    if (modal === 'active') return employees.filter((e) => e.status === 'active');
    if (modal === 'inactive') return employees.filter((e) => e.status === 'inactive');
    if (modal === 'salary') return [...employees].sort((a, b) => b.salary - a.salary);
    if (modal === 'dept') return employees.filter((e) => e.dept === deptView);
    return [];
  }, [modal, deptView, employees]);

  const modalTitle = useMemo(() => {
    if (modal === 'total') return `All Employees (${totalEmp})`;
    if (modal === 'active') return `Active Employees (${activeEmp})`;
    if (modal === 'inactive') return `Inactive Employees (${inactiveEmp})`;
    if (modal === 'salary') return 'Salary Overview — All Employees';
    if (modal === 'dept') return `${deptView} Department`;
    return '';
  }, [modal, deptView, totalEmp, activeEmp, inactiveEmp]);

  const openDept = (dept: string) => { setDeptView(dept); setModal('dept'); };

  // ── EARNERS PAGE ──
  if (pageView === 'earners') {
    const earners = [...employees].sort((a, b) => b.salary - a.salary);
    const filteredEarners = earnerDeptF ? earners.filter((e) => e.dept === earnerDeptF) : earners;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" size="sm" className="text-xs" onClick={() => setPageView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">All Earners — Salary Overview</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={earnerDeptF || 'all'} onValueChange={(v: string) => setEarnerDeptF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-400">{filteredEarners.length} employee{filteredEarners.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {filteredEarners.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">💰</span><p className="text-sm text-gray-400 mt-2">No employees yet</p></div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>{['Rank', 'Employee', 'Department', 'Role', 'Salary / Month', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filteredEarners.map((e, i) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600">{e.name[0]}</div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.dept}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.role}</td>
                    <td className="px-4 py-3 font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">Rs.{e.salary.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.status === 'active' ? 'success' : 'gray'} className="text-[10px]">{e.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── TASK DETAIL PAGE ──
  if (pageView === 'task-detail') {
    const allTasks = taskDetail[taskDept] || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" size="sm" className="text-xs" onClick={() => setPageView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{taskDept} — All Tasks ({allTasks.length})</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {allTasks.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">📋</span><p className="text-sm text-gray-400 mt-2">No tasks</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>{['Task', 'Assignee', 'Status', 'Priority', 'Due Date'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap text-[10px]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {allTasks.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{t.title}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.assignee}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize whitespace-nowrap ${STATUS_CLR_TASK[t.status] || STATUS_CLR_TASK.pending}`}>{t.status.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.priority}</span></td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{t.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── EMPLOYEE DETAIL PAGE (full list, reached via "View All" when a KPI modal has >10 rows) ──
  if (pageView === 'emp-detail') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" size="sm" className="text-xs" onClick={() => setPageView('main')}>← Back</Button>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {modalEmps.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">👥</span><p className="text-sm text-gray-400 mt-2">No employees</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>{['ID', 'Name', 'Department', 'Role', 'Salary', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap text-[10px]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {modalEmps.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-400 font-mono">{e.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600">{e.name[0]}</div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.dept}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.role}</td>
                      <td className="px-4 py-3 font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">Rs.{e.salary.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3"><Badge variant={e.status === 'active' ? 'success' : 'gray'} className="text-[10px]">{e.status}</Badge></td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Task Dept Modal */}
      <Dialog open={!!taskDept} onOpenChange={(o: boolean) => !o && setTaskDept('')}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{taskDept} — Tasks ({(taskDetail[taskDept] || []).length})</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {(taskDetail[taskDept] || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No tasks for this department</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Task', 'Assignee', 'Status', 'Priority', 'Due Date'].map((h) => (
                      <th key={h} className="pb-2 text-left font-semibold text-gray-500 dark:text-gray-400 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {(taskDetail[taskDept] || []).slice(0, 10).map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2 pr-3 font-semibold text-gray-800 dark:text-gray-200">{t.title}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.assignee}</td>
                      <td className="py-2 pr-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize whitespace-nowrap ${STATUS_CLR_TASK[t.status] || STATUS_CLR_TASK.pending}`}>{t.status.replace('_', ' ')}</span></td>
                      <td className="py-2 pr-3"><span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.priority}</span></td>
                      <td className="py-2 text-gray-400 whitespace-nowrap">{t.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DialogBody>
          <DialogFooter>
            {(taskDetail[taskDept] || []).length > 10 && (
              <Button size="sm" className="text-xs" onClick={() => { setPageView('task-detail'); }}>View All →</Button>
            )}
            <Button variant="secondary" size="sm" className="text-xs" onClick={() => setTaskDept('')}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">Live data from your organisation</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'Total Employees', value: totalEmp, sub: 'across all departments', color: 'blue', key: 'total' as ModalType },
              { label: 'Active Employees', value: activeEmp, sub: totalEmp > 0 ? Math.round(activeEmp / totalEmp * 100) + '% of workforce' : '—', color: 'emerald', key: 'active' as ModalType },
              { label: 'Inactive', value: inactiveEmp, sub: 'deactivated accounts', color: 'amber', key: 'inactive' as ModalType },
              { label: 'Avg Salary', value: avgSalary > 0 ? 'Rs.' + avgSalary.toLocaleString('en-IN') : '—', sub: 'per month', color: 'purple', key: 'salary' as ModalType },
            ] as const).map((k) => (
              <div key={k.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex flex-col gap-1">
                <p className={`text-2xl font-bold text-${k.color}-600 dark:text-${k.color}-400`}>{k.value}</p>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{k.label}</p>
                <p className="text-[10px] text-gray-400">{k.sub}</p>
                {totalEmp > 0 && (
                  <button onClick={() => setModal(k.key)}
                    className={`mt-1 self-start text-[10px] px-2.5 py-0.5 rounded-lg font-semibold bg-${k.color}-50 dark:bg-${k.color}-900/20 text-${k.color}-600 dark:text-${k.color}-400 hover:opacity-80 transition-opacity`}>
                    View Details →
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Summary stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '📋', label: 'Total Tasks', value: totalTasks, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' },
              { icon: '✅', label: 'Tasks Done', value: doneTasks, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
              { icon: '📊', label: 'Completion', value: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) + '%' : '—', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
            ].map((s) => (
              <button key={s.label} onClick={() => navigate('/admin/tasks')} className={`text-left rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-all ${s.color}`}>
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] font-medium opacity-80">{s.label}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Dept breakdown */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Employee Count by Department</h2>
            {deptStats.length === 0 ? (
              <div className="py-8 text-center"><span className="text-2xl">👥</span><p className="text-sm text-gray-400 mt-2">No employees added yet</p></div>
            ) : (
              <div className="space-y-3">
                {deptStats.map((d) => {
                  const pct = totalEmp ? Math.round(d.count / totalEmp * 100) : 0;
                  return (
                    <div key={d.dept}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{d.dept}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{d.count} employees ({pct}%)</span>
                          <button onClick={() => openDept(d.dept)}
                            className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:opacity-80 font-semibold transition-opacity">
                            View
                          </button>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-emerald-600">{d.active} active</span>
                        {d.inactive > 0 && <span className="text-[10px] text-amber-600">{d.inactive} inactive</span>}
                        {d.avgSalary > 0 && <span className="text-[10px] text-gray-400">Avg Rs.{d.avgSalary.toLocaleString('en-IN')}/mo</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task completion by dept */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Task Completion by Department</h2>
            {taskStats.length === 0 ? (
              <div className="py-8 text-center"><span className="text-2xl">📋</span><p className="text-sm text-gray-400 mt-2">No tasks assigned yet</p></div>
            ) : (
              <div className="space-y-3">
                {taskStats.map((d) => {
                  const pct = d.total ? Math.round(d.completed / d.total * 100) : 0;
                  return (
                    <div key={d.dept}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{d.dept}</span>
                        <div className="flex items-center gap-2">
                          <span className={'text-xs font-semibold ' + (pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500')}>{pct}% done</span>
                          <button onClick={() => setTaskDept(d.dept)}
                            className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:opacity-80 font-semibold transition-opacity">
                            View
                          </button>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className={'h-2 rounded-full ' + (pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: pct + '%' }} />
                      </div>
                      <div className="flex gap-4 mt-1">
                        <span className="text-[10px] text-emerald-600">✓ {d.completed} done</span>
                        <span className="text-[10px] text-blue-500">⟳ {d.inProgress} active</span>
                        {d.pending > 0 && <span className="text-[10px] text-gray-400">⏸ {d.pending} pending</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leave type distribution */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Leave Type Distribution</h2>
            {apiLeaves.length === 0 ? (
              <div className="py-8 text-center"><span className="text-2xl">🗓️</span><p className="text-sm text-gray-400 mt-2">No leaves applied yet</p></div>
            ) : (
              <div className="space-y-2">
                {leaveStats.map((l) => {
                  const total = apiLeaves.length;
                  const pct = total ? Math.round(l.count / total * 100) : 0;
                  return (
                    <div key={l.type}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600 dark:text-gray-400 capitalize">{l.type.replace('_', ' ')}</span>
                        <span className="text-gray-500">{l.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: pct + '%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top earners */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top Earners</h2>
              {employees.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-purple-600 dark:text-purple-400" onClick={() => setPageView('earners')}>
                  View All Earners →
                </Button>
              )}
            </div>
            {employees.length === 0 ? (
              <div className="py-6 text-center"><span className="text-2xl">💰</span><p className="text-sm text-gray-400 mt-2">No employees yet</p></div>
            ) : (
              <div className="space-y-2">
                {[...employees].sort((a, b) => b.salary - a.salary).slice(0, 5).map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">{e.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.name}</p>
                      <p className="text-[10px] text-gray-400">{e.role} · {e.dept}</p>
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Rs.{e.salary.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Employee Detail Modal — capped preview; "View All" redirects to a dedicated full-list page */}
      <Dialog open={!!modal && pageView === 'main'} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {modalEmps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No employees</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['ID', 'Name', 'Department', 'Role', 'Salary', 'Status', 'Joined'].map((h) => (
                      <th key={h} className="pb-2 text-left font-semibold text-gray-500 dark:text-gray-400 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {modalEmps.slice(0, 10).map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2 pr-3 text-gray-400 font-mono">{e.id}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600">{e.name[0]}</div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{e.name}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{e.dept}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{e.role}</td>
                      <td className="py-2 pr-3 font-semibold text-purple-600 dark:text-purple-400">Rs.{e.salary.toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={e.status === 'active' ? 'success' : 'gray'} className="text-[10px]">{e.status}</Badge>
                      </td>
                      <td className="py-2 text-gray-400">{e.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DialogBody>
          <DialogFooter>
            {modalEmps.length > 10 && (
              <Button size="sm" className="text-xs" onClick={() => setPageView('emp-detail')}>View All ({modalEmps.length}) →</Button>
            )}
            <Button variant="secondary" size="sm" className="text-xs" onClick={() => setModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
