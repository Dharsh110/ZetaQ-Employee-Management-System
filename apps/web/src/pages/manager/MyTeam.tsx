import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useGetEmployeesQuery, useUpdateEmployeeMutation } from '../../store/api/employeesApi';
import { useGetAllAttendanceQuery } from '../../store/api/attendanceApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { mapApiEmployeeToRow, type EmployeeRow } from '../admin/employees-columns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2022 }, (_, i) => 2023 + i);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AVAIL_CLR = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ManagerMyTeam() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';

  const { data: apiEmployees = [], isLoading } = useGetEmployeesQuery();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery(undefined, { skip: !!myDept });
  const [updateEmployee] = useUpdateEmployeeMutation();

  const members = useMemo(
    () => apiEmployees.filter((e) => !myDept || (typeof e.department === 'object' ? e.department?.name : e.department) === myDept).map(mapApiEmployeeToRow),
    [apiEmployees, myDept]
  );

  const [viewMember, setViewMember] = useState<EmployeeRow | null>(null);
  const [editMember, setEditMember] = useState<EmployeeRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<EmployeeRow>>({});
  const [attMonth, setAttMonth] = useState(new Date().getMonth());
  const [attYear, setAttYear] = useState(CY);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<'' | 'Active' | 'Inactive'>('');
  const [deptF, setDeptF] = useState('');

  const filtered = useMemo(() => members.filter((m) =>
    (!statusF || m.status === statusF) &&
    (!deptF || m.dept === deptF) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase()) || m.dept.toLowerCase().includes(search.toLowerCase()))
  ), [members, statusF, deptF, search]);

  const toggleStatus = async (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    try {
      await updateEmployee({ id, status: m.status === 'Active' ? 'inactive' : 'active' }).unwrap();
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const openEdit = (m: EmployeeRow) => { setEditMember(m); setEditForm({ phone: m.phone, designation: m.designation, salary: m.salary }); };

  const saveEdit = async () => {
    if (!editMember) return;
    try {
      await updateEmployee({ id: editMember.id, phone: editForm.phone, designation: editForm.designation, salary: Number(editForm.salary) || undefined }).unwrap();
      setEditMember(null);
      toast.success('Details updated');
    } catch { toast.error('Failed to update'); }
  };

  const attRange = useMemo(() => {
    const from = new Date(attYear, attMonth, 1);
    const to = new Date(attYear, attMonth + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [attMonth, attYear]);
  const { data: monthlyRecords = [], isFetching: attLoading } = useGetAllAttendanceQuery({ from: attRange.from, to: attRange.to, limit: 2000 }, { skip: !viewMember });
  const attEntries = useMemo(
    () => monthlyRecords.filter((r) => (typeof r.employee === 'object' ? r.employee._id : r.employee) === viewMember?.id),
    [monthlyRecords, viewMember]
  );

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, dept…" className="h-8 text-xs w-52" />
          {(['', 'Active', 'Inactive'] as const).map((s) => (
            <Button key={s} size="sm" variant={statusF === s ? 'default' : 'secondary'} onClick={() => setStatusF(s)} className="capitalize">
              {s === '' ? 'All' : s} ({s === '' ? members.length : members.filter((m) => m.status === s).length})
            </Button>
          ))}
          {!myDept && (
            <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Departments</SelectItem>{apiDepartments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">Loading {myDept} team…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-16 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
            <span className="text-4xl">👥</span>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3">
              {search || statusF ? 'No members match your filter' : `No team members found for ${myDept || 'your department'}`}
            </p>
          </div>
        ) : filtered.map((m, i) => (
          <div key={m.id} className={'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-all ' + (m.status === 'Inactive' ? 'opacity-60' : '')}>
            <div className="flex items-start gap-3">
              <Avatar className={'w-11 h-11 rounded-2xl ' + AVAIL_CLR[i % AVAIL_CLR.length]}>
                {m.avatar ? <AvatarImage src={m.avatar} alt={m.name} /> : null}
                <AvatarFallback className="rounded-2xl bg-transparent">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{m.name}</p>
                <p className="text-[11px] text-gray-400">{m.designation}</p>
                <p className="text-[10px] text-gray-400">{m.code} &middot; {m.dept}</p>
              </div>
              <Badge variant={m.status === 'Active' ? 'success' : 'gray'} className="flex-shrink-0">{m.status}</Badge>
            </div>
            <div className="mt-3 flex gap-1.5">
              <Button size="sm" variant="secondary" className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600" onClick={() => setViewMember(m)}>View</Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(m)}>Edit</Button>
              <Button size="sm" variant="secondary" className={'flex-1 ' + (m.status === 'Active' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')} onClick={() => toggleStatus(m.id)}>
                {m.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!viewMember} onOpenChange={(o: boolean) => !o && setViewMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
          {viewMember && (
            <>
              <DialogBody>
                <div className="flex items-center gap-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">{initials(viewMember.name)}</div>
                  <div>
                    <p className="text-white font-bold text-base">{viewMember.name}</p>
                    <p className="text-white/80 text-xs">{viewMember.designation}</p>
                    <Badge variant={viewMember.status === 'Active' ? 'success' : 'gray'} className="mt-1">{viewMember.status}</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Employee Information</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([['Employee ID', viewMember.code], ['Name', viewMember.name], ['Department', viewMember.dept], ['Designation', viewMember.designation], ['Email', viewMember.email], ['Phone', viewMember.phone], ['Joined', viewMember.joined], ['Salary', viewMember.salary ? `₹${Number(viewMember.salary).toLocaleString()}` : 'Not disclosed']] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-2.5">
                        <p className="text-[10px] text-gray-400">{k}</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5 break-all">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Attendance Management</p>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Select value={String(attMonth)} onValueChange={(v: string) => setAttMonth(Number(v))}>
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(attYear)} onValueChange={(v: string) => setAttYear(Number(v))}>
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-[10px] text-gray-400">{attLoading ? 'Loading…' : `${attEntries.length} record${attEntries.length !== 1 ? 's' : ''}`}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>{['Date', 'Check In', 'Check Out', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {attEntries.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">No records found</td></tr>
                        ) : attEntries.map((a) => (
                          <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.date?.slice(0, 10)}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.checkIn ? new Date(a.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.checkOut ? new Date(a.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                            <td className="px-3 py-2"><Badge variant={a.status === 'present' ? 'success' : a.status === 'absent' ? 'destructive' : 'warning'} className="capitalize">{a.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button className="flex-1" onClick={() => { openEdit(viewMember); setViewMember(null); }}>Edit</Button>
                <Button variant="secondary" className={'flex-1 ' + (viewMember.status === 'Active' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')} onClick={() => { toggleStatus(viewMember.id); setViewMember(null); }}>
                  {viewMember.status === 'Active' ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setViewMember(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMember} onOpenChange={(o: boolean) => !o && setEditMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          <DialogBody>
            <div><Label>Phone</Label><Input className="mt-1" value={editForm.phone ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Designation</Label><Input className="mt-1" value={editForm.designation ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, designation: e.target.value }))} /></div>
            <div><Label>Salary (₹)</Label><Input className="mt-1" type="number" value={editForm.salary ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, salary: e.target.value }))} /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
