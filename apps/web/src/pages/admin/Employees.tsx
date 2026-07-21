import React, { useState, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  type NewEmployeeCredentials,
} from '../../store/api/employeesApi';
import { DataTable } from '../../components/data-table/data-table';
import { buildEmployeeColumns, mapApiEmployeeToRow, type EmployeeRow } from './employees-columns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

const DESIG = ['Software Engineer', 'Senior Engineer', 'Team Lead', 'Manager', 'HR Executive', 'Accountant', 'Marketing Executive', 'Operations Manager', 'Designer', 'QA Engineer'];
const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Intern'];
const GENDERS = ['Male', 'Female', 'Other'];

type FD = { empId: string; name: string; email: string; phone: string; dept: string; designation: string; type: string; status: string; joined: string; salary: string; gender: string; avatar: string; role: 'employee' | 'manager' };
const BLANK: FD = { empId: '', name: '', email: '', phone: '', dept: 'Engineering', designation: 'Software Engineer', type: 'Full-Time', status: 'Active', joined: '', salary: '', gender: 'Male', avatar: '', role: 'employee' };
const NO_DEPT = '__none__';
const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

const typeToApi: Record<string, string> = { 'Full-Time': 'full_time', 'Part-Time': 'part_time', Contract: 'contract', Intern: 'intern' };

export default function AdminEmployees() {
  const { data: apiEmployees = [], isLoading, isFetching } = useGetEmployeesQuery();
  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const DEPTS = useMemo(() => apiDepartments.map((d) => d.name), [apiDepartments]);

  const emps = useMemo(() => apiEmployees.map(mapApiEmployeeToRow), [apiEmployees]);

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FD>(BLANK);
  const [search, setSearch] = useState('');
  const [deptF, setDeptF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [newCreds, setNewCreds] = useState<NewEmployeeCredentials | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((field: keyof FD, value: string) => setForm((p) => ({ ...p, [field]: value })), []);
  const openAdd = () => { setForm(BLANK); setEditId(null); setModal('add'); };
  const openEdit = (e: EmployeeRow) => {
    setForm({ empId: e.code, name: e.name, email: e.email, phone: e.phone, dept: e.dept, designation: e.designation, type: e.type, status: e.status, joined: e.joined, salary: e.salary, gender: e.gender, avatar: e.avatar, role: 'employee' });
    setEditId(e.id); setViewing(null); setModal('edit');
  };

  const pickAvatar = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return; }
    const r = new FileReader();
    r.onload = (e) => handleChange('avatar', e.target?.result as string);
    r.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (!form.email.trim()) { toast.error('Email required'); return; }
    if (!form.joined) { toast.error('Joining date required'); return; }
    if (modal === 'add' && !form.empId.trim()) { toast.error('Employee ID required'); return; }

    if (modal === 'add') {
      try {
        const [first, ...rest] = form.name.trim().split(' ');
        const result = await createEmployee({
          employeeCode: form.empId.trim(),
          firstName: first, lastName: rest.join(' ') || first,
          email: form.email, phone: form.phone,
          department: form.dept === NO_DEPT ? '' : form.dept, designation: form.designation,
          employmentType: typeToApi[form.type], status: form.status === 'Active' ? 'active' : 'inactive',
          joiningDate: form.joined, salary: Number(form.salary) || 0, gender: form.gender,
          role: form.role,
        }).unwrap();
        toast.success(form.name + ' added!');
        if (result.credentials) setNewCreds(result.credentials);
      } catch (err: any) {
        toast.error(err?.data?.message || 'Failed to add employee');
        return;
      }
    } else {
      try {
        await updateEmployee({
          id: editId!, phone: form.phone, designation: form.designation,
          employmentType: typeToApi[form.type], status: form.status === 'Active' ? 'active' : 'inactive',
          salary: Number(form.salary) || 0, gender: form.gender,
        }).unwrap();
        toast.success('Employee updated!');
      } catch (err: any) {
        toast.error(err?.data?.message || 'Failed to update employee');
        return;
      }
    }
    setModal(null);
  };

  const toggleStatus = async (row: EmployeeRow) => {
    const newStatus = row.status === 'Active' ? 'inactive' : 'active';
    try {
      await updateEmployee({ id: row.id, status: newStatus }).unwrap();
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id).unwrap();
      toast.success('Employee deactivated');
    } catch {
      toast.error('Failed to delete employee');
    }
    setDeleteTarget(null);
  };

  const q = search.toLowerCase();
  const filtered = emps.filter((e) =>
    (!search || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)) &&
    (!deptF || e.dept === deptF) &&
    (!statusF || e.status === statusF)
  );
  const dc: Record<string, number> = {};
  emps.forEach((e) => { dc[e.dept] = (dc[e.dept] || 0) + 1; });

  const columns = useMemo(
    () => buildEmployeeColumns({ onView: setViewing, onEdit: openEdit, onToggleStatus: toggleStatus, onDelete: setDeleteTarget }),
    []
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {DEPTS.map((d) => (
          <button key={d} onClick={() => setDeptF(deptF === d ? '' : d)}
            className={'rounded-xl px-3 py-2.5 text-left border transition-all ' + (deptF === d ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300')}>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{d}</p>
            <p className="text-sm font-bold text-blue-600">{dc[d] || 0} <span className="text-[10px] font-normal text-gray-400">employees</span></p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, ID..." className="h-8 text-xs pl-8 w-52" />
        </div>
        <Select value={deptF || 'all'} onValueChange={(v: string) => setDeptF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-1">
          {isFetching ? 'Refreshing…' : `${filtered.length} employee${filtered.length !== 1 ? 's' : ''}`}
        </span>
        <Button onClick={openAdd} size="sm" className="ml-auto text-xs">+ Add Employee</Button>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No employees found" />

      {/* Add / Edit dialog */}
      <Dialog open={!!modal} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal === 'add' ? 'Add New Employee' : 'Edit Employee'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Avatar className="w-14 h-14 rounded-xl">
                {form.avatar ? <AvatarImage src={form.avatar} alt="avatar" /> : null}
                <AvatarFallback className="rounded-xl text-lg">{form.name ? ini(form.name) : '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Profile Picture</p>
                <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG max 5 MB (optional)</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="mt-1.5 text-xs">
                  {form.avatar ? 'Change' : 'Upload'} Photo
                </Button>
                {form.avatar && <button type="button" onClick={() => handleChange('avatar', '')} className="ml-2 text-xs text-red-500 hover:underline">Remove</button>}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {modal === 'add' ? (
                <div>
                  <Label>Employee ID *</Label>
                  <Input className="mt-1 uppercase" value={form.empId} onChange={(e) => handleChange('empId', e.target.value.toUpperCase())} placeholder="e.g. EMP031" />
                  <p className="text-[10px] text-gray-400 mt-1">This ID (or their email) is what they'll use to log in.</p>
                </div>
              ) : (
                <div><Label>Employee ID</Label><Input className="mt-1" value={form.empId} disabled /></div>
              )}
              <div><Label>Full Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Arjun Kumar" /></div>
              <div><Label>Email *</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="name@co.com" /></div>
              <div><Label>Phone</Label><Input className="mt-1" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+91 98765 43210" /></div>
              <div><Label>Joining Date *</Label><Input className="mt-1" type="date" value={form.joined} onChange={(e) => handleChange('joined', e.target.value)} /></div>

              {modal === 'add' && (
                <div>
                  <Label>Account Role *</Label>
                  <Select value={form.role} onValueChange={(v: string) => handleChange('role', v as FD['role'])}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Department {form.role === 'manager' ? '' : '*'}</Label>
                <Select value={form.dept} onValueChange={(v: string) => handleChange('dept', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.role === 'manager' && <SelectItem value={NO_DEPT}>— All Departments (Main Manager) —</SelectItem>}
                    {DEPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Designation *</Label>
                <Select value={form.designation} onValueChange={(v: string) => handleChange('designation', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DESIG.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment Type *</Label>
                <Select value={form.type} onValueChange={(v: string) => handleChange('type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v: string) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v: string) => handleChange('gender', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Salary (per month)</Label><Input className="mt-1" type="number" value={form.salary} onChange={(e) => handleChange('salary', e.target.value)} placeholder="e.g. 60000" /></div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{modal === 'add' ? 'Add Employee' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o: boolean) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
          {viewing && (
            <>
              <DialogBody>
                <div className="flex items-center gap-4 mb-2">
                  <Avatar className="w-16 h-16 rounded-2xl">
                    {viewing.avatar ? <AvatarImage src={viewing.avatar} alt={viewing.name} /> : null}
                    <AvatarFallback className="rounded-2xl text-xl">{ini(viewing.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{viewing.name}</p>
                    <p className="text-xs text-gray-500">{viewing.designation} &middot; {viewing.dept}</p>
                    <p className="text-[10px] text-gray-400">{viewing.code}</p>
                    <Badge variant={viewing.status === 'Active' ? 'success' : 'gray'} className="mt-1">{viewing.status}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([['Emp ID', viewing.code], ['Email', viewing.email], ['Phone', viewing.phone || 'Not added'], ['Department', viewing.dept], ['Designation', viewing.designation], ['Type', viewing.type], ['Gender', viewing.gender], ['Joined', viewing.joined], ['Salary', viewing.salary ? 'Rs.' + Number(viewing.salary).toLocaleString('en-IN') + '/mo' : 'Confidential'], ['Status', viewing.status]] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400">{l}</p>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>Close</Button>
                <Button className="flex-1" onClick={() => openEdit(viewing)}>Edit</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">🗑️</span>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>This deactivates {deleteTarget?.name} in the system.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>OK, Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New-account credentials — shown because the welcome email may not be deliverable
          in this environment (SMTP not configured); the admin needs another way to hand
          the new hire their login details. */}
      <Dialog open={!!newCreds} onOpenChange={(o: boolean) => !o && setNewCreds(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Account Created — Share These Login Details</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              A welcome email was attempted, but may not have been delivered. Copy these credentials and share them with the new hire directly — they'll be asked to change the password after first login.
            </p>
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Employee ID</p>
                <p className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">{newCreds?.employeeCode}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Login Email</p>
                <p className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">{newCreds?.email}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                <p className="text-[10px] text-amber-600 dark:text-amber-400">Temporary Password</p>
                <p className="text-sm font-bold font-mono text-amber-700 dark:text-amber-300">{newCreds?.tempPassword}</p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                if (newCreds) navigator.clipboard?.writeText(`Employee ID: ${newCreds.employeeCode}\nLogin Email: ${newCreds.email}\nTemporary Password: ${newCreds.tempPassword}`);
                toast.success('Copied to clipboard');
                setNewCreds(null);
              }}
            >
              Copy & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
