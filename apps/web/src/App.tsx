import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import { Spinner } from './components/ui/index';

const Login          = lazy(()=>import('./pages/auth/Login'));
const ForgotPassword = lazy(()=>import('./pages/auth/ForgotPassword'));
const ResetPassword  = lazy(()=>import('./pages/auth/ResetPassword'));

// Admin
const AdminDashboard   = lazy(()=>import('./pages/admin/Dashboard'));
const AdminEmployees   = lazy(()=>import('./pages/admin/Employees'));
const AdminDepartments = lazy(()=>import('./pages/admin/Departments'));
const AdminDeptDetail  = lazy(()=>import('./pages/admin/DepartmentDetail'));
const AdminAttendance  = lazy(()=>import('./pages/admin/Attendance'));
const AdminTimesheets  = lazy(()=>import('./pages/admin/Timesheets'));
const AdminLeaves      = lazy(()=>import('./pages/admin/Leaves'));
const AdminTasks       = lazy(()=>import('./pages/admin/Tasks'));
const AdminPayroll     = lazy(()=>import('./pages/admin/Payroll'));
const AdminReports     = lazy(()=>import('./pages/admin/Reports'));
const AdminCalendar    = lazy(()=>import('./pages/admin/Calendar'));
const AdminAnalytics   = lazy(()=>import('./pages/admin/Analytics'));
const AdminSettings    = lazy(()=>import('./pages/admin/Settings'));
const AdminMessages    = lazy(()=>import('./pages/admin/Messages'));
const AdminDailyReport = lazy(()=>import('./pages/admin/DailyReport'));
const AdminProfile     = lazy(()=>import('./pages/admin/Profile'));

// Manager
const ManagerDashboard   = lazy(()=>import('./pages/manager/Dashboard'));
const ManagerTeam        = lazy(()=>import('./pages/manager/MyTeam'));
const ManagerAttendance  = lazy(()=>import('./pages/manager/TeamAttendance'));
const ManagerMyAttendance = lazy(()=>import('./pages/manager/MyAttendance'));
const ManagerLeaves      = lazy(()=>import('./pages/manager/LeaveApprovals'));
const ManagerTasks       = lazy(()=>import('./pages/manager/TaskReview'));
const ManagerPerformance = lazy(()=>import('./pages/manager/Performance'));
const ManagerReports     = lazy(()=>import('./pages/manager/Reports'));
const ManagerCalendar    = lazy(()=>import('./pages/manager/Calendar'));
const ManagerTimesheetApprovals = lazy(()=>import('./pages/manager/TimesheetApprovals'));
const ManagerSettings    = lazy(()=>import('./pages/manager/Settings'));
const ManagerDailyReport = lazy(()=>import('./pages/manager/DailyReport'));
const ManagerMessages    = lazy(()=>import('./pages/manager/Messages'));
const ManagerProfile     = lazy(()=>import('./pages/manager/Profile'));

// Employee
const EmployeeDashboard  = lazy(()=>import('./pages/employee/Dashboard'));
const EmployeeAttendance = lazy(()=>import('./pages/employee/MyAttendance'));
const EmployeeTasks      = lazy(()=>import('./pages/employee/MyTasks'));
const EmployeeLeaves     = lazy(()=>import('./pages/employee/MyLeaves'));
const EmployeeProfile    = lazy(()=>import('./pages/employee/Profile'));
const EmployeePayslips   = lazy(()=>import('./pages/employee/Payslips'));
const EmployeeCalendar   = lazy(()=>import('./pages/employee/Calendar'));
const EmployeeSettings   = lazy(()=>import('./pages/employee/Settings'));
const EmployeeNewTask      = lazy(()=>import('./pages/employee/NewTask'));
const EmployeeDailyReport  = lazy(()=>import('./pages/employee/DailyReport'));
const EmployeeUploadedFiles= lazy(()=>import('./pages/employee/UploadedFiles'));
const EmployeeTimesheet    = lazy(()=>import('./pages/employee/Timesheet'));
const EmployeeMessages     = lazy(()=>import('./pages/employee/Messages'));

// Shared
const Notifications = lazy(()=>import('./pages/shared/Notifications'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <Spinner size="lg"/>
  </div>
);

interface GuardProps { children: React.ReactNode; role?: 'admin'|'manager'|'employee'; }

const AuthGuard: React.FC<GuardProps> = ({ children, role }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace/>;
  if (role && user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace/>;
  return <>{children}</>;
};

const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to={`/${user.role}/dashboard`} replace/>;
  return <>{children}</>;
};

const App: React.FC = () => (
  <Suspense fallback={<Loading/>}>
    <Routes>
      {/* Public */}
      <Route path="/login"               element={<GuestGuard><Login/></GuestGuard>}/>
      <Route path="/forgot-password"     element={<GuestGuard><ForgotPassword/></GuestGuard>}/>
      <Route path="/reset-password/:token" element={<ResetPassword/>}/>

      {/* Admin */}
      <Route path="/admin" element={<AuthGuard role="admin"><Layout role="admin"/></AuthGuard>}>
        <Route index element={<Navigate to="dashboard" replace/>}/>
        <Route path="dashboard"          element={<AdminDashboard/>}/>
        <Route path="employees"          element={<AdminEmployees/>}/>
        <Route path="departments"        element={<AdminDepartments/>}/>
        <Route path="departments/:deptId" element={<AdminDeptDetail/>}/>
        <Route path="attendance"         element={<AdminAttendance/>}/>
        <Route path="timesheets"         element={<AdminTimesheets/>}/>
        <Route path="leaves"             element={<AdminLeaves/>}/>
        <Route path="tasks"              element={<AdminTasks/>}/>
        <Route path="payroll"            element={<AdminPayroll/>}/>
        <Route path="reports"            element={<AdminReports/>}/>
        <Route path="calendar"           element={<AdminCalendar/>}/>
        <Route path="analytics"          element={<AdminAnalytics/>}/>
        <Route path="settings"           element={<AdminSettings/>}/>
        <Route path="messages"            element={<AdminMessages/>}/>
        <Route path="daily-report"       element={<AdminDailyReport/>}/>
        <Route path="profile"            element={<AdminProfile/>}/>
        <Route path="notifications"      element={<Notifications/>}/>
      </Route>

      {/* Manager */}
      <Route path="/manager" element={<AuthGuard role="manager"><Layout role="manager"/></AuthGuard>}>
        <Route index element={<Navigate to="dashboard" replace/>}/>
        <Route path="dashboard"   element={<ManagerDashboard/>}/>
        <Route path="team"        element={<ManagerTeam/>}/>
        <Route path="attendance"  element={<ManagerAttendance/>}/>
        <Route path="my-attendance" element={<ManagerMyAttendance/>}/>
        <Route path="leaves"      element={<ManagerLeaves/>}/>
        <Route path="tasks"       element={<ManagerTasks/>}/>
        <Route path="performance" element={<ManagerPerformance/>}/>
        <Route path="reports"     element={<ManagerReports/>}/>
        <Route path="calendar"    element={<ManagerCalendar/>}/>
        <Route path="timesheet-approvals" element={<ManagerTimesheetApprovals/>}/>
        <Route path="settings"      element={<ManagerSettings/>}/>
        <Route path="daily-report"  element={<ManagerDailyReport/>}/>
        <Route path="messages"      element={<ManagerMessages/>}/>
        <Route path="profile"       element={<ManagerProfile/>}/>
        <Route path="notifications" element={<Notifications/>}/>
      </Route>

      {/* Employee */}
      <Route path="/employee" element={<AuthGuard role="employee"><Layout role="employee"/></AuthGuard>}>
        <Route index element={<Navigate to="dashboard" replace/>}/>
        <Route path="dashboard"  element={<EmployeeDashboard/>}/>
        <Route path="attendance" element={<EmployeeAttendance/>}/>
        <Route path="tasks"      element={<EmployeeTasks/>}/>
        <Route path="leaves"     element={<EmployeeLeaves/>}/>
        <Route path="profile"    element={<EmployeeProfile/>}/>
        <Route path="payslips"   element={<EmployeePayslips/>}/>
        <Route path="calendar"   element={<EmployeeCalendar/>}/>
        <Route path="settings"    element={<EmployeeSettings/>}/>
        <Route path="new-task"       element={<EmployeeNewTask/>}/>
        <Route path="daily-report"   element={<EmployeeDailyReport/>}/>
        <Route path="uploaded-files" element={<EmployeeUploadedFiles/>}/>
        <Route path="timesheet"      element={<EmployeeTimesheet/>}/>
        <Route path="messages"       element={<EmployeeMessages/>}/>
        <Route path="notifications" element={<Notifications/>}/>
      </Route>

      {/* Fallback */}
      <Route path="/"  element={<Navigate to="/login" replace/>}/>
      <Route path="*"  element={<Navigate to="/login" replace/>}/>
    </Routes>
  </Suspense>
);

export default App;
