import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  type ApiDepartment,
  type NewManagerCredentials,
} from '../../store/api/departmentsApi';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { mapApiEmployeeToRow } from './employees-columns';
import { DataTable } from '../../components/data-table/data-table';
import { buildDepartmentColumns } from './departments-columns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

type FD = { name: string; code: string; location: string; description: string; isActive: boolean; head: string; headEmail: string };
const BLANK: FD = { name: '', code: '', location: 'HQ', description: '', isActive: true, head: '', headEmail: '' };

export default function AdminDepartments() {
  const navigate = useNavigate();
  const { data: depts = [], isLoading } = useGetDepartmentsQuery();
  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const [createDepartment] = useCreateDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FD>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<ApiDepartment | null>(null);
  const [membersDept, setMembersDept] = useState<ApiDepartment | null>(null);
  const [newCreds, setNewCreds] = useState<(NewManagerCredentials & { deptName: string }) | null>(null);

  const openAdd = () => { setForm(BLANK); setEditId(null); setModal('add'); };
  const openEdit = (d: ApiDepartment) => {
    const headId = typeof d.head === 'object' && d.head ? d.head._id : (d.head as string) || '';
    setForm({ name: d.name, code: d.code, location: d.location || '', description: d.description || '', isActive: d.isActive, head: headId, headEmail: '' });
    setEditId(d._id); setModal('edit');
  };

  // Every employee is selectable as a department head — picking one who isn't
  // already a manager promotes them (see the badge shown per option below).
  const headOptions = useMemo(
    () => [...apiEmployees]
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map((e) => ({
        value: e._id,
        label: `${e.firstName} ${e.lastName}`,
        sublabel: e.email,
        badge: e.role === 'manager'
          ? { text: '👔 Manager', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' }
          : { text: '⭐ Will be promoted', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
      })),
    [apiEmployees]
  );
  const selectedHeadEmployee = useMemo(() => apiEmployees.find((e) => e._id === form.head), [apiEmployees, form.head]);
  // e.g. "vivek.marketing.manager@zetaq.com" — first name + the department's own
  // name, so the convention actually reflects which department is being managed.
  const suggestedHeadEmail = useMemo(() => {
    if (!selectedHeadEmployee || !form.name.trim()) return '';
    const first = selectedHeadEmployee.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dept = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return first && dept ? `${first}.${dept}.manager@zetaq.com` : '';
  }, [selectedHeadEmployee, form.name]);

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code required'); return; }
    try {
      let result;
      if (modal === 'add') {
        result = await createDepartment({ name: form.name, code: form.code, location: form.location, description: form.description, head: form.head || undefined, headEmail: form.headEmail || undefined }).unwrap();
        toast.success('Department added');
      } else {
        result = await updateDepartment({ id: editId!, name: form.name, code: form.code, location: form.location, description: form.description, isActive: form.isActive, head: form.head || undefined, headEmail: form.headEmail || undefined }).unwrap();
        toast.success('Department updated');
      }
      if (result.credentials) setNewCreds({ ...result.credentials, deptName: form.name });
      if (result.headError) toast.error(`Department saved, but head assignment failed: ${result.headError}`);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to save');
      return;
    }
    setModal(null);
  };

  const toggleStatus = async (d: ApiDepartment) => {
    try {
      await updateDepartment({ id: d._id, isActive: !d.isActive }).unwrap();
      toast.success('Status updated');
    } catch { toast.error('Failed to update'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDepartment(deleteTarget._id).unwrap();
      toast.success('Department removed');
    } catch { toast.error('Failed to delete'); }
    setDeleteTarget(null);
  };

  const deptMembers = useMemo(() => {
    if (!membersDept) return [];
    return apiEmployees.filter((e) => (typeof e.department === 'object' ? e.department?.name : e.department) === membersDept.name).map(mapApiEmployeeToRow);
  }, [membersDept, apiEmployees]);

  const total = depts.length;
  const active = depts.filter((d) => d.isActive).length;
  const totalHC = depts.reduce((s, d) => s + (d.employeeCount || 0), 0);

  const columns = useMemo(
    () => buildDepartmentColumns({
      onViewMembers: setMembersDept,
      onViewDetail: (d) => navigate(`/admin/departments/${encodeURIComponent(d.name)}`),
      onEdit: openEdit,
      onToggleStatus: toggleStatus,
      onDelete: setDeleteTarget,
    }),
    []
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Total Departments', v: total, c: 'from-blue-500 to-blue-600', icon: '🏢' },
          { l: 'Active', v: active, c: 'from-emerald-500 to-emerald-600', icon: '✅' },
          { l: 'Total Employees', v: totalHC, c: 'from-purple-500 to-purple-600', icon: '👥' },
        ].map((s) => (
          <div key={s.l} className={`bg-gradient-to-br ${s.c} rounded-2xl p-4 text-white`}>
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-xs opacity-80 mt-0.5 font-semibold">{s.icon} {s.l}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          All Departments <span className="text-gray-400 font-normal">({depts.length})</span>
        </h3>
        <Button onClick={openAdd} size="sm" className="text-xs">+ Add Department</Button>
      </div>

      <DataTable columns={columns} data={depts} isLoading={isLoading} emptyMessage="No departments yet" />

      {/* Add / Edit dialog */}
      <Dialog open={!!modal} onOpenChange={(o: boolean) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal === 'add' ? 'Add Department' : 'Edit Department'}</DialogTitle></DialogHeader>
          <DialogBody>
            <div><Label>Department Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Code *</Label><Input className="mt-1" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="ENG" /></div>
            <div><Label>Location</Label><Input className="mt-1" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} /></div>
            <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div>
              <Label>Department Head <span className="text-gray-400 font-normal">(optional — pick any employee)</span></Label>
              <SearchableSelect
                className="mt-1"
                options={headOptions}
                value={form.head}
                onChange={(v) => setForm((p) => ({ ...p, head: v, headEmail: v ? p.headEmail : '' }))}
                placeholder="Search by name or email…"
                emptyOptionLabel="— None —"
              />
            </div>
            {form.head && selectedHeadEmployee && selectedHeadEmployee.role !== 'manager' && (
              <div>
                <Label>New Login Email <span className="text-gray-400 font-normal">(optional — promotes to Manager)</span></Label>
                <div className="mt-1 flex gap-1.5">
                  <Input
                    className="flex-1"
                    value={form.headEmail}
                    onChange={(e) => setForm((p) => ({ ...p, headEmail: e.target.value }))}
                    placeholder={suggestedHeadEmail || 'e.g. name.department.manager@zetaq.com'}
                  />
                  {suggestedHeadEmail && (
                    <Button type="button" size="sm" variant="outline" className="flex-shrink-0" onClick={() => setForm((p) => ({ ...p, headEmail: suggestedHeadEmail }))}>
                      Use
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {selectedHeadEmployee.firstName} {selectedHeadEmployee.lastName} will become {form.name || 'this department'}'s manager, with a new manager-style Employee ID. Leave blank to keep their current login email.
                </p>
              </div>
            )}
            {modal === 'edit' && (
              <div>
                <Label>Status</Label>
                <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={(v: string) => setForm((p) => ({ ...p, isActive: v === 'active' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{modal === 'add' ? 'Add' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={!!membersDept} onOpenChange={(o: boolean) => !o && setMembersDept(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>👥 {membersDept?.name} — Members</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {deptMembers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No employees in this department yet.</p>
            ) : (
              <div className="space-y-2">
                {deptMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{m.name}</p>
                      <p className="text-[10px] text-gray-400">{m.designation} &middot; {m.email}</p>
                    </div>
                    <Badge variant={m.status === 'Active' ? 'success' : 'gray'}>{m.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setMembersDept(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">🗑️</span>
            <AlertDialogTitle>Delete Department?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes {deleteTarget?.name} from the system. This cannot be undone — departments with active employees can't be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>OK, Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New department-manager credentials — shown when setting a department's head
          promoted a non-manager employee. Same pattern as Employees.tsx's new-hire dialog. */}
      <Dialog open={!!newCreds} onOpenChange={(o: boolean) => !o && setNewCreds(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Manager Account Created — Share These Login Details</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              This employee is now the manager of <span className="font-semibold">{newCreds?.deptName}</span>. Their previous login no longer works — copy these credentials and share them directly.
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
