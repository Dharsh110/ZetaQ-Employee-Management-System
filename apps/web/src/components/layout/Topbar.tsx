import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/index';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../../services/api';

interface TopbarProps { title: string; subtitle?: string; onMenuClick: () => void; }

type NotifType = 'leave'|'task'|'payroll'|'attendance'|'message'|'system';
type DbNotif = { id:string; title:string; message:string; type:NotifType; isRead:boolean; createdAt:string; link?:string; };

const TYPE_COLOR: Record<string,string> = {
  leave:      'bg-amber-500',
  task:       'bg-blue-500',
  payroll:    'bg-purple-500',
  attendance: 'bg-red-500',
  message:    'bg-emerald-500',
  system:     'bg-gray-500',
};

const fmtTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
};

export default function Topbar({ title, subtitle, onMenuClick }: TopbarProps) {
  const { toggleTheme, isDark } = useTheme();
  const { user, logout }        = useAuth();
  const navigate                = useNavigate();
  const [notifOpen, setNotifOpen]       = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const [deleteId, setDeleteId]         = useState<string|null>(null);
  const [notifs, setNotifs]             = useState<DbNotif[]>([]);

  const role = user?.role || 'employee';
  const settingsPath = `/${role}/settings`;

  const loadNotifs = useCallback(() => {
    notificationAPI.getAll().then(res => {
      const data = res.data?.data || res.data?.notifications;
      if (Array.isArray(data)) {
        setNotifs(data.map((n: any) => ({
          id: n._id,
          title: n.title,
          message: n.message,
          type: (n.type as NotifType) || 'system',
          isRead: n.isRead,
          createdAt: n.createdAt,
          link: n.link,
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifs();
    // No websocket infra — poll so a notification created while this tab is
    // already open (e.g. someone else sends a message) shows up without a reload.
    const id = setInterval(loadNotifs, 20000);
    return () => clearInterval(id);
  }, [loadNotifs]);

  const unreadNotifs = notifs.filter(n => !n.isRead);
  const unread = unreadNotifs.length;

  const markRead = async (id: string) => {
    setNotifs(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
    try { await notificationAPI.markRead(id); } catch {}
  };

  const markAllRead = async () => {
    setNotifs(p => p.map(n => ({ ...n, isRead: true })));
    try { await notificationAPI.markAllRead(); } catch {}
  };

  const deleteNotif = async (id: string) => {
    setNotifs(p => p.filter(n => n.id !== id));
    setDeleteId(null);
    try { await notificationAPI.delete(id); } catch {}
  };

  const handleLogout = () => { setProfileOpen(false); logout(); navigate('/login'); };

  const roleColor = {
    admin:    'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    manager:  'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    employee: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  }[role] || 'text-gray-600 bg-gray-50';

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="btn-icon lg:hidden">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{title}</h1>
          {subtitle&&<p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
          {isDark
            ?<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
            :<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>}
          <span className="hidden sm:inline">{isDark?'Light':'Dark'}</span>
        </button>

        {/* Bell */}
        <div className="relative">
          <button onClick={()=>{setNotifOpen(!notifOpen);setProfileOpen(false);}} className="btn-icon relative">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unread>0&&<span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">{unread}</span>}
          </button>
          {notifOpen&&(
            <>
              <div className="fixed inset-0 z-40" onClick={()=>setNotifOpen(false)}/>
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</p>
                    {unread>0&&<span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">{unread} new</span>}
                  </div>
                  {unread>0&&<button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Mark all read</button>}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                  {unreadNotifs.length===0?(
                    <div className="px-4 py-8 text-center">
                      <p className="text-2xl mb-1">🔔</p>
                      <p className="text-xs text-gray-400">{notifs.length===0 ? 'No notifications yet' : 'No unread notifications'}</p>
                    </div>
                  ):unreadNotifs.slice(0, 5).map(n=>(
                    <div key={n.id}
                      className={`flex gap-3 px-4 py-3 transition-colors ${!n.isRead?'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/15':'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_COLOR[n.type]||'bg-gray-400'}`}/>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>markRead(n.id)}>
                        <p className={`text-xs font-semibold ${!n.isRead?'text-gray-900 dark:text-gray-100':'text-gray-500 dark:text-gray-400'}`}>{n.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">{fmtTime(n.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        {!n.isRead&&(
                          <button onClick={()=>markRead(n.id)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 font-semibold transition-colors whitespace-nowrap">
                            Read
                          </button>
                        )}
                        <button onClick={()=>setDeleteId(n.id)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={()=>{setNotifOpen(false);navigate(`/${role}/notifications`);}} className="text-xs text-center w-full text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    {notifs.length > 5 ? `View all notifications (${notifs.length}) →` : 'View all notifications →'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button onClick={()=>{setProfileOpen(!profileOpen);setNotifOpen(false);}}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer ml-1">
            <Avatar name={user?.name||'User'} size="sm"/>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{user?.name?.split(' ')[0]}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
            </div>
            <svg className="w-3 h-3 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {profileOpen&&(
            <>
              <div className="fixed inset-0 z-40" onClick={()=>setProfileOpen(false)}/>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-gray-50 dark:from-gray-700/50 to-white dark:to-gray-800">
                  <div className="flex items-center gap-3">
                    <Avatar name={user?.name||'User'} size="md"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleColor}`}>{user?.role}</span>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button onClick={()=>{setProfileOpen(false);navigate(`/${role}/profile`);}}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    View Profile
                  </button>
                  <button onClick={()=>{setProfileOpen(false);navigate(settingsPath);}}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Settings
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete notification confirm */}
      {deleteId&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-xs shadow-2xl p-5 text-center">
            <span className="text-3xl">🗑️</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2">Delete Notification?</h3>
            <p className="text-xs text-gray-500 mt-1">This cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={()=>deleteNotif(deleteId)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
