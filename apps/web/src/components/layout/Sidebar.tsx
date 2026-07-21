import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/index';

interface NavItem { label: string; path: string; icon: React.ReactNode; badge?: number | string; }
interface SectionItem { section: string; items: NavItem[]; }

const Icon = ({ d }: { d: string }) => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const ICONS = {
  dashboard:   <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  employees:   <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  attendance:  <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  leaves:      <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  tasks:       <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />,
  payroll:     <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  reports:     <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  calendar:    <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  departments: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  settings:    <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  profile:     <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  analytics:   <Icon d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  payslip:     <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  team:        <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  performance: <Icon d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
  bell:        <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  newtask:     <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  dailyreport: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  files:       <Icon d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
  messages:    <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
};

const NAV_CONFIG: Record<string, SectionItem[]> = {
  admin: [
    { section:'Overview', items:[
      { label:'Dashboard',   path:'/admin/dashboard',   icon:ICONS.dashboard },
      { label:'Analytics',   path:'/admin/analytics',   icon:ICONS.analytics },
    ]},
    { section:'People & HR', items:[
      { label:'Employees',      path:'/admin/employees',   icon:ICONS.employees },
      { label:'Departments',    path:'/admin/departments', icon:ICONS.departments },
      { label:'Leave Requests', path:'/admin/leaves',      icon:ICONS.leaves },
    ]},
    { section:'Operations', items:[
      { label:'Attendance',   path:'/admin/attendance', icon:ICONS.attendance },
      { label:'Timesheets',   path:'/admin/timesheets', icon:ICONS.dailyreport },
      { label:'Task Tracker', path:'/admin/tasks',      icon:ICONS.tasks },
      { label:'Payroll',      path:'/admin/payroll',    icon:ICONS.payroll },
    ]},
    { section:'Reports & Data', items:[
      { label:'Team Reports',      path:'/admin/reports',      icon:ICONS.reports },
      { label:'Daily Reports',     path:'/admin/daily-report', icon:ICONS.dailyreport },
      { label:'Calendar',          path:'/admin/calendar',     icon:ICONS.calendar },
    ]},
    { section:'Account', items:[
      { label:'My Profile',    path:'/admin/profile',       icon:ICONS.profile },
      { label:'Messages',      path:'/admin/messages',      icon:ICONS.messages },
      { label:'Notifications', path:'/admin/notifications', icon:ICONS.bell },
      { label:'Settings',      path:'/admin/settings',      icon:ICONS.settings },
    ]},
  ],
  manager: [
    { section:'Overview', items:[
      { label:'Dashboard',       path:'/manager/dashboard',  icon:ICONS.dashboard },
      { label:'Team Attendance', path:'/manager/attendance', icon:ICONS.attendance },
    ]},
    { section:'Team Management', items:[
      { label:'My Team',              path:'/manager/team',               icon:ICONS.team },
      { label:'Task Review',          path:'/manager/tasks',              icon:ICONS.tasks },
      { label:'Timesheet Approvals',  path:'/manager/timesheet-approvals', icon:ICONS.dailyreport },
      { label:'Performance',          path:'/manager/performance',        icon:ICONS.performance },
    ]},
    { section:'Leave & HR', items:[
      { label:'Leave Requests', path:'/manager/leaves', icon:ICONS.leaves },
    ]},
    { section:'Reports & Data', items:[
      { label:'Team Reports',  path:'/manager/reports',      icon:ICONS.reports },
      { label:'Daily Reports', path:'/manager/daily-report', icon:ICONS.dailyreport },
      { label:'Calendar',      path:'/manager/calendar',     icon:ICONS.calendar },
    ]},
    { section:'Account', items:[
      { label:'My Profile',    path:'/manager/profile',        icon:ICONS.profile },
      { label:'My Attendance', path:'/manager/my-attendance',  icon:ICONS.attendance },
      { label:'Messages',      path:'/manager/messages',       icon:ICONS.messages },
      { label:'Notifications', path:'/manager/notifications',  icon:ICONS.bell },
      { label:'Settings',      path:'/manager/settings',       icon:ICONS.settings },
    ]},
  ],
  employee: [
    { section:'My Workspace', items:[
      { label:'Dashboard',     path:'/employee/dashboard',  icon:ICONS.dashboard },
      { label:'My Attendance', path:'/employee/attendance', icon:ICONS.attendance },
    ]},
    { section:'Tasks', items:[
      { label:'My Tasks',    path:'/employee/tasks',    icon:ICONS.tasks },
      { label:'Submit Task', path:'/employee/new-task', icon:ICONS.newtask },
    ]},
    { section:'Work Reports', items:[
      { label:'Timesheet',     path:'/employee/timesheet',      icon:ICONS.dailyreport },
      { label:'Daily Report',   path:'/employee/daily-report',   icon:ICONS.dailyreport },
      { label:'Uploaded Files', path:'/employee/uploaded-files', icon:ICONS.files },
    ]},
    { section:'Requests', items:[
      { label:'Leave Requests', path:'/employee/leaves',  icon:ICONS.leaves },
    ]},
    { section:'Schedule & Pay', items:[
      { label:'Calendar', path:'/employee/calendar', icon:ICONS.calendar },
      { label:'Payslips', path:'/employee/payslips', icon:ICONS.payslip },
    ]},
    { section:'Account', items:[
      { label:'My Profile',    path:'/employee/profile',       icon:ICONS.profile },
      { label:'Messages',      path:'/employee/messages',      icon:ICONS.messages },
      { label:'Notifications', path:'/employee/notifications', icon:ICONS.bell },
      { label:'Settings',      path:'/employee/settings',      icon:ICONS.settings },
    ]},
  ],
};

interface SidebarProps { onClose?: () => void; }

const ROLE_COLOR: Record<string, string> = {
  admin:    'bg-purple-600',
  manager:  'bg-blue-600',
  employee: 'bg-emerald-600',
};

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sections = NAV_CONFIG[user?.role || 'employee'] || [];
  const handleLogout = () => { logout(); navigate('/login'); };
  const roleBg = ROLE_COLOR[user?.role || 'employee'] || 'bg-brand-600';

  return (
    <aside className="sidebar h-full flex flex-col">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className={`w-8 h-8 ${roleBg} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">ZetaQ EMS</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{user?.role} Portal</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon lg:hidden flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Department / Manager ID badge (manager only) */}
      {user?.role === 'manager' && (user as any).department && (
        <div className="mx-3 mt-2 mb-0.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-blue-400 dark:text-blue-500 font-medium uppercase tracking-wide">Department</p>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">{(user as any).department}</p>
            </div>
            {(user as any).managerId && (
              <span className="flex-shrink-0 text-[9px] font-mono px-2 py-0.5 bg-blue-600 text-white rounded-full">{(user as any).managerId}</span>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {sections.map(section => (
          <div key={section.section}>
            <p className="section-title">{section.section}</p>
            {section.items.map(item => (
              <NavLink key={item.path} to={item.path} onClick={onClose}
                className={({ isActive }) => clsx(isActive ? 'nav-item-active' : 'nav-item', 'mb-0.5')}>
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 px-3 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
        <Avatar name={user?.name || 'User'} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.name}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
        </div>
        <button onClick={handleLogout} title="Sign out" className="btn-icon flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
