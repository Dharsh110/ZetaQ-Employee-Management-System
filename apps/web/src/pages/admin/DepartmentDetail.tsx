import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useGetEmployeesQuery, useUpdateEmployeeMutation, useDeleteEmployeeMutation } from '../../store/api/employeesApi';
import { mapApiEmployeeToRow, buildEmployeeColumns, type EmployeeRow } from './employees-columns';
import { DataTable } from '../../components/data-table/data-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export default function DepartmentDetail() {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const deptName = decodeURIComponent(deptId || '');

  const { data: apiEmployees = [], isLoading } = useGetEmployeesQuery();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);

  const deptEmployees = useMemo(
    () => apiEmployees.filter((e) => (typeof e.department === 'object' ? e.department?.name : e.department) === deptName).map(mapApiEmployeeToRow),
    [apiEmployees, deptName]
  );

  const q = search.toLowerCase();
  const filtered = deptEmployees.filter((e) =>
    (!q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)) && (!statusF || e.status === statusF)
  );

  const toggleStatus = async (row: EmployeeRow) => {
    try {
      await updateEmployee({ id: row.id, status: row.status === 'Active' ? 'inactive' : 'active' }).unwrap();
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id).unwrap();
      toast.success('Employee deactivated');
    } catch { toast.error('Failed to delete employee'); }
    setDeleteTarget(null);
  };

  const columns = useMemo(
    () => buildEmployeeColumns({
      onView: setViewing,
      onEdit: () => navigate('/admin/employees'),
      onToggleStatus: toggleStatus,
      onDelete: setDeleteTarget,
    }),
    []
  );

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/departments')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400">{deptName[0]}</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{deptName} Department</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {filtered.length} employee{filtered.length !== 1 ? 's' : ''} shown &middot; {deptEmployees.filter((e) => e.status === 'Active').length} active
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 text-xs w-48" />
        <Select value={statusF || 'all'} onValueChange={(v: string) => setStatusF(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No employees found" />

      <Dialog open={!!viewing} onOpenChange={(o: boolean) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
          {viewing && (
            <>
              <DialogBody>
                <div className="flex items-center gap-4 mb-2">
                  <Avatar className="w-14 h-14 rounded-2xl">
                    {viewing.avatar ? <AvatarImage src={viewing.avatar} alt={viewing.name} /> : null}
                    <AvatarFallback className="rounded-2xl text-lg">{ini(viewing.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{viewing.name}</p>
                    <p className="text-xs text-gray-500">{viewing.designation}</p>
                    <Badge variant={viewing.status === 'Active' ? 'success' : 'gray'} className="mt-1">{viewing.status}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([['Code', viewing.code], ['Email', viewing.email], ['Phone', viewing.phone || '—'], ['Type', viewing.type], ['Joined', viewing.joined], ['Salary', viewing.salary ? 'Rs.' + Number(viewing.salary).toLocaleString('en-IN') : '—']] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400">{l}</p>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">🗑️</span>
            <AlertDialogTitle>Deactivate Employee?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate {deleteTarget?.name}. You can reactivate them later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
