import ProfilePage from '../shared/ProfilePage';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetTodayQuery } from '../../store/api/attendanceApi';

export default function AdminProfile() {
  const { data: employees = [] } = useGetEmployeesQuery();
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: tasks = [] } = useGetTasksQuery();
  const { data: today } = useGetTodayQuery();

  const attendanceRate = today?.summary?.totalEmployees
    ? Math.round((today.summary.present / today.summary.totalEmployees) * 100)
    : 0;

  return (
    <ProfilePage
      roleLabel="Administrator"
      gradient="from-purple-600 to-indigo-700"
      accent="text-purple-600"
      quickStats={[
        { l: 'Employees Managed', v: String(employees.length), icon: '👥', c: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
        { l: 'Departments', v: String(departments.length), icon: '🏢', c: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' },
        { l: 'Tasks Assigned', v: String(tasks.length), icon: '📋', c: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
        { l: 'Attendance Rate', v: `${attendanceRate}%`, icon: '✅', c: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
      ]}
      skills={['System Administration', 'Network Security', 'Cloud Infrastructure', 'Database Management', 'ITIL Certified', 'AWS Solutions Architect', 'HR Operations', 'Compliance']}
      emergencyContact={[['Name', 'Meena Raj'], ['Relationship', 'Spouse'], ['Phone', '+91 98765 00002']]}
    />
  );
}
