import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', analytics: 'Analytics', employees: 'Employees',
  departments: 'Departments', attendance: 'Attendance', leaves: 'Leave Requests',
  tasks: 'Task Tracker', payroll: 'Payroll', reports: 'Reports', calendar: 'Calendar',
  settings: 'Settings', profile: 'My Profile', payslips: 'Payslips',
  'daily-report': 'Daily Reports', messages: 'Messages',
  team: 'My Team', performance: 'Performance', notifications: 'Notifications',
};

const Layout: React.FC<{ role?: string }> = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [location.pathname]);
  const segment = location.pathname.split('/').pop() || 'dashboard';
  const title = PAGE_TITLES[segment] || 'ZetaQ EMS';
  const now = new Date();
  const subtitle = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — fixed on mobile (drawer), static on desktop */}
      <div className={`fixed inset-y-0 left-0 z-40 w-56 transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title={title} subtitle={subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 animation-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
