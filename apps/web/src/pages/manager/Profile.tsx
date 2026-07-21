import ProfilePage from '../shared/ProfilePage';
import { useAuth } from '../../context/AuthContext';
import { useGetEmployeesQuery } from '../../store/api/employeesApi';
import { useGetTasksQuery } from '../../store/api/tasksApi';
import { useGetTodayQuery } from '../../store/api/attendanceApi';
import { mapApiTaskToRow } from '../admin/tasks-columns';

export default function ManagerProfile() {
  const { user } = useAuth();
  const myDept = (user as any)?.department || '';

  const { data: apiEmployees = [] } = useGetEmployeesQuery();
  const { data: apiTasks = [] } = useGetTasksQuery();
  const { data: today } = useGetTodayQuery();

  const teamCount = apiEmployees.filter((e) => !myDept || (typeof e.department === 'object' ? e.department?.name : e.department) === myDept).length;
  const teamTasks = apiTasks.map(mapApiTaskToRow).filter((t) => !myDept || t.dept === myDept);
  const completionRate = teamTasks.length ? Math.round((teamTasks.filter((t) => t.status === 'completed').length / teamTasks.length) * 100) : 0;
  const teamAttendanceRate = today?.summary?.totalEmployees
    ? Math.round((today.summary.present / today.summary.totalEmployees) * 100)
    : 0;

  return (
    <ProfilePage
      roleLabel="Manager"
      gradient="from-blue-600 to-indigo-700"
      accent="text-blue-600"
      quickStats={[
        { l: 'Team Members', v: String(teamCount), icon: '👥', c: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
        { l: 'Tasks Assigned', v: String(teamTasks.length), icon: '📋', c: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' },
        { l: 'Task Completion', v: `${completionRate}%`, icon: '🎯', c: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
        { l: 'Attendance Rate', v: `${teamAttendanceRate}%`, icon: '✅', c: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
      ]}
      skills={['Team Leadership', 'Agile/Scrum', 'Project Management', 'Code Review', 'Performance Management', 'Mentoring', 'Sprint Planning', 'Stakeholder Communication']}
      emergencyContact={[['Name', 'Lakshmi Kumar'], ['Relationship', 'Spouse'], ['Phone', '+91 98765 43211']]}
    />
  );
}
