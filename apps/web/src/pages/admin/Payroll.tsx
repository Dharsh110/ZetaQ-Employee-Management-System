import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetPayrollQuery, useGeneratePayrollMutation, useProcessPaymentMutation } from '../../store/api/payrollApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { mapApiPayrollToRow, buildPayrollColumns, fmt, type PayrollRow } from './payroll-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Period = 'all' | 'month' | 'year';

export default function AdminPayroll() {
  const { data: apiPayroll = [], isLoading } = useGetPayrollQuery();
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const [generatePayroll] = useGeneratePayrollMutation();
  const [processPayment] = useProcessPaymentMutation();

  // Always sourced live from the Departments collection so newly-added departments
  // show up here automatically without a code change.
  const deptNames = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);
  const deptIdToName = useMemo(() => new Map(apiDepartments.map((d) => [d._id, d.name])), [apiDepartments]);
  const codeToDept = useMemo(() => new Map(apiEmployees.map((e) => [e.employeeCode, typeof e.department === 'object' ? e.department?.name : e.department])), [apiEmployees]);

  const records = useMemo(() => apiPayroll.map((p) => {
    const row = mapApiPayrollToRow(p);
    // Legacy records may store a raw department ObjectId that no longer exists (re-seeded DB) —
    // resolve it if possible, otherwise fall back to the employee's current department, and
    // never show a raw ObjectId hash to the user.
    if (row.dept && deptIdToName.has(row.dept)) row.dept = deptIdToName.get(row.dept)!;
    else if (!row.dept || !deptNames.includes(row.dept)) row.dept = codeToDept.get(row.code) || '—';
    return row;
  }), [apiPayroll, deptIdToName, deptNames, codeToDept]);

  const [period, setPeriod] = useState<Period>('all');
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(CY);
  const [deptF, setDeptF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [empF, setEmpF] = useState('');
  const empNames = useMemo(() => Array.from(new Set(apiEmployees.map((e) => `${e.firstName} ${e.lastName}`))).sort((a, b) => a.localeCompare(b)), [apiEmployees]);
  const [genModal, setGenModal] = useState(false);
  const [genMonth, setGenMonth] = useState(new Date().getMonth());
  const [genYear, setGenYear] = useState(CY);
  const [generating, setGenerating] = useState(false);

  const filtered = records.filter((r) => {
    const inP = period === 'all' ? true : period === 'month' ? (r.month === MOS[selMonth] && r.year === selYear) : r.year === selYear;
    const statusMatch = !statusF || (statusF === '__unpaid__' ? r.status !== 'paid' : r.status === statusF);
    return inP && (!deptF || r.dept === deptF) && (!empF || r.name === empF) && statusMatch;
  });

  const markPaid = async (row: PayrollRow) => {
    try { await processPayment(row.id).unwrap(); toast.success('Marked as paid!'); }
    catch { toast.error('Failed to update payment'); }
  };

  const columns = useMemo(() => buildPayrollColumns({ onMarkPaid: markPaid }), []);

  // Employees who don't yet have a payroll record for the selected generate month/year.
  // `p.employee` may be null on legacy/denormalized records — fall back to matching on
  // employeeCode (typeof null === 'object' in JS, so this must be checked explicitly).
  const genMonthNum = genMonth + 1;
  const pending = apiEmployees.filter((e) => e.status === 'active' && !apiPayroll.some((p) => {
    const pid = p.employee && typeof p.employee === 'object' ? p.employee._id : p.employee;
    const matches = pid ? pid === e._id : p.employeeCode === e.employeeCode;
    return matches && p.month === genMonthNum && p.year === genYear;
  }));

  const runGenerate = async () => {
    if (pending.length === 0) { toast.error('All active employees already have payroll for this period'); return; }
    setGenerating(true);
    try {
      await Promise.all(pending.map((e) => generatePayroll({ employeeId: e._id, month: genMonthNum, year: genYear, basicSalary: e.salary || 50000 }).unwrap()));
      toast.success(`Payroll generated for ${pending.length} employee${pending.length !== 1 ? 's' : ''}!`);
      setGenModal(false);
    } catch {
      toast.error('Some payroll records failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const totalPaid = filtered.filter((r) => r.status === 'paid').reduce((s, r) => s + r.net, 0);
  const totalUnpaid = filtered.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.net, 0);
  const totalAll = filtered.reduce((s, r) => s + r.net, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setStatusF('')} className={`text-left bg-white dark:bg-gray-800 border rounded-2xl p-4 hover:shadow-md transition-all ${statusF === '' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <p className="text-xs text-gray-400 font-medium">Total Payroll</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(totalAll)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{filtered.length} records</p>
        </button>
        <button onClick={() => setStatusF('paid')} className={`text-left bg-emerald-50 dark:bg-emerald-900/20 border rounded-2xl p-4 hover:shadow-md transition-all ${statusF === 'paid' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-emerald-200 dark:border-emerald-800'}`}>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalPaid)}</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">{filtered.filter((r) => r.status === 'paid').length} paid</p>
        </button>
        <button onClick={() => setStatusF('__unpaid__')} className={`text-left bg-red-50 dark:bg-red-900/20 border rounded-2xl p-4 hover:shadow-md transition-all ${statusF === '__unpaid__' ? 'border-red-500 ring-1 ring-red-500' : 'border-red-200 dark:border-red-800'}`}>
          <p className="text-xs text-red-500 font-medium">Pending Payout</p>
          <p className="text-xl font-bold text-red-500 mt-1">{fmt(totalUnpaid)}</p>
          <p className="text-[10px] text-red-400 mt-0.5">{filtered.filter((r) => r.status !== 'paid').length} unpaid</p>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'month', 'year'] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'secondary'} onClick={() => setPeriod(p)} className="capitalize">{p}</Button>
          ))}
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
          <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Depts" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Depts</SelectItem>{deptNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem>{['pending', 'processed', 'paid'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={empF || 'all'} onValueChange={(v: string) => setEmpF(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Employees</SelectItem>{empNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-gray-400">{filtered.length} records</span>
          <Button size="sm" className="ml-auto bg-emerald-600 hover:bg-emerald-700" onClick={() => setGenModal(true)}>💰 Generate Payroll</Button>
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No payroll records found" />

      <Dialog open={genModal} onOpenChange={setGenModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Pay Month</label>
                <Select value={String(genMonth)} onValueChange={(v: string) => setGenMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Year</label>
                <Select value={String(genYear)} onValueChange={(v: string) => setGenYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{pending.length} employee{pending.length !== 1 ? 's' : ''} pending for {MOS[genMonth]} {genYear}</p>
              <p className="text-[10px] text-blue-500 mt-1">HRA, PF and tax are auto-calculated from each employee's salary.</p>
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pending.map((e) => (
                    <span key={e._id} className="text-[10px] bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">{e.firstName} {e.lastName}</span>
                  ))}
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setGenModal(false)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={runGenerate} disabled={generating || pending.length === 0}>
              {generating ? 'Generating…' : `Generate for ${pending.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
