import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGetDepartmentsQuery } from '../../store/api/departmentsApi';
import { notificationAPI } from '../../services/api';

const CY    = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MOS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Period    = 'all'|'today'|'week'|'month'|'year';
type NotifRole = 'all'|'employee'|'admin'|'manager';
type Department= 'all' | string;
type Section   = 'active'|'archived'|'deleted';

type Notif = {
  id:string; title:string; message:string; type:string;
  createdAt:Date; unread:boolean; forRole: NotifRole[]; department?:string;
};

const now = new Date();
const ago  = (ms:number) => new Date(now.getTime()-ms);

const fmtDateTime = (d:Date) => {
  const today=new Date(); const isTd=d.toDateString()===today.toDateString();
  const yest=new Date(today.getTime()-864e5); const isYest=d.toDateString()===yest.toDateString();
  const time=d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
  if(isTd) return `Today, ${time}`;
  if(isYest) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})+', '+time;
};


const TYPE_ICON: Record<string,string> = { leave:'🗓️',attendance:'⏰',employee:'👤',task:'📋',payroll:'💰',report:'📊',calendar:'📅',system:'⚙️',reminder:'🔔' };
const TYPE_CLR:  Record<string,string> = {
  leave:'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  attendance:'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400',
  employee:'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  task:'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  payroll:'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  report:'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  calendar:'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  system:'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  reminder:'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
};

const inPeriod = (d:Date, period:Period, selM:number, selY:number) => {
  const n=new Date();
  if(period==='today'){ const t=new Date(n.getFullYear(),n.getMonth(),n.getDate()); return d>=t; }
  if(period==='week') return d>=new Date(n.getTime()-7*864e5);
  if(period==='month') return d.getFullYear()===selY && d.getMonth()===selM;
  if(period==='year')  return d.getFullYear()===selY;
  return true;
};

const SEL = "text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none";

export default function Notifications() {
  const { user } = useAuth();
  const role = user?.role || 'employee';

  // Sourced live from the Departments collection so newly-added departments show up here automatically.
  const { data: apiDepartments = [] } = useGetDepartmentsQuery();
  const DEPARTMENTS: Department[] = useMemo(() => ['all', ...apiDepartments.map((d) => d.name)], [apiDepartments]);


  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [deleted, setDeleted] = useState<Notif[]>([]);

  useEffect(()=>{
    const load = () => {
      notificationAPI.getAll().then(res=>{
        const data=res.data?.data;
        if(Array.isArray(data)){
          const mapped:Notif[]=data.map((n:any)=>({
            id:n._id,
            title:n.title,
            message:n.message,
            type:n.type||'system',
            createdAt:new Date(n.createdAt),
            unread:!n.isRead,
            forRole:['all'] as NotifRole[],
            department:n.department||undefined,
          }));
          setNotifs(mapped);
        }
      }).catch(()=>{});
    };
    load();
    // No websocket infra — poll so notifications created while this page is open show up live.
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  },[]);

  const [section, setSection]     = useState<Section>('active');
  const [period, setPeriod]       = useState<Period>('all');
  const [selMonth, setSelMonth]   = useState(new Date().getMonth());
  const [selYear, setSelYear]     = useState(CY);
  const [typeF, setTypeF]         = useState('');
  const [deptF, setDeptF]         = useState<Department>('all');
  const [deleteId, setDeleteId]   = useState<string|null>(null);

const markRead = (id:string) => {
    notificationAPI.markRead(id).catch(()=>{});
    setNotifs(p=>p.map(n=>n.id===id?{...n,unread:false}:n));
  };
  const markAllRead = () => {
    notificationAPI.markAllRead().catch(()=>{});
    setNotifs(p=>p.map(n=>({...n,unread:false})));
  };

  const confirmDelete = (id:string) => setDeleteId(id);
  const doDelete = () => {
    if (!deleteId) return;
    notificationAPI.delete(deleteId).catch(()=>{});
    const target = notifs.find(n=>n.id===deleteId);
    if(target) setDeleted(p=>[target,...p.filter(n=>n.id!==deleteId)]);
    setNotifs(p=>p.filter(n=>n.id!==deleteId));
    setDeleteId(null);
  };

  const activeNotifs   = notifs.filter(n => n.unread);
  const archivedNotifs = notifs.filter(n => !n.unread);
  const TYPES = [...new Set(notifs.map(n=>n.type))];

  const applyFilters = (list: Notif[]) => list.filter(n=>{
    const matchP = inPeriod(n.createdAt, period, selMonth, selYear);
    const matchT = !typeF || n.type===typeF;
    const matchD = deptF==='all' || !n.department || n.department===deptF;
    return matchP && matchT && matchD;
  });

  const displayList = applyFilters(
    section==='active'   ? activeNotifs :
    section==='archived' ? archivedNotifs : deleted
  );

  const unreadCount = activeNotifs.length;

  const FilterBar = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['all','today','week','month','year'] as Period[]).map(p=>(
          <button key={p} onClick={()=>setPeriod(p)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${period===p?'bg-blue-600 text-white shadow':'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {p==='all'?'All':p==='today'?'Today':p==='week'?'This Week':p==='month'?'Month':'Year'}
          </button>
        ))}
        {period==='month'&&<select value={selMonth} onChange={e=>setSelMonth(+e.target.value)} className={SEL}>{MOS.map((m,i)=><option key={m} value={i}>{m}</option>)}</select>}
        {(period==='month'||period==='year')&&<select value={selYear} onChange={e=>setSelYear(+e.target.value)} className={SEL}>{YEARS.map(y=><option key={y} value={y}>{y}</option>)}</select>}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {role!=='employee'&&(
            <select value={deptF} onChange={e=>setDeptF(e.target.value as Department)} className={SEL}>
              {DEPARTMENTS.map(d=><option key={d} value={d}>{d==='all'?'All Departments':d}</option>)}
            </select>
          )}
          <select value={typeF} onChange={e=>setTypeF(e.target.value)} className={SEL}>
            <option value="">All Types</option>
            {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
          {section==='active'&&unreadCount>0&&(
            <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap">Mark all read</button>
          )}
        </div>
      </div>
    </div>
  );

  const NotifRow = ({ n, showReadBtn }: { n:Notif; showReadBtn:boolean }) => (
    <div
      className={`flex items-start gap-4 px-5 py-4 transition-colors ${n.unread?'bg-blue-50/40 dark:bg-blue-900/5 hover:bg-blue-50/60 dark:hover:bg-blue-900/10':'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${TYPE_CLR[n.type]||'bg-gray-50 text-gray-600'}`}>{TYPE_ICON[n.type]||'📌'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-tight ${n.unread?'text-gray-900 dark:text-white':'text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
          {n.unread&&<div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"/>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_CLR[n.type]||'bg-gray-100 text-gray-500'}`}>{n.type}</span>
          <span className="text-[10px] text-gray-400">🕐 {fmtDateTime(n.createdAt)}</span>
          {n.unread&&<span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">● Unread</span>}
          {n.department&&<span className="text-[10px] text-gray-400">{n.department}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {showReadBtn&&n.unread&&(
          <button onClick={()=>markRead(n.id)}
            className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-semibold transition-colors whitespace-nowrap">
            Mark Read
          </button>
        )}
        <button onClick={()=>confirmDelete(n.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Section tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex gap-1">
        {([
          ['active',   '🔔 Active',   unreadCount,        'text-blue-600'],
          ['archived', '📂 Archived', archivedNotifs.length,'text-gray-600'],
          ['deleted',  '🗑️ Deleted',  deleted.length,     'text-red-500'],
        ] as [Section,string,number,string][]).map(([s,l,cnt,tc])=>(
          <button key={s} onClick={()=>setSection(s)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${section===s?'bg-blue-600 text-white shadow':'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${section===s?'bg-white/20':tc+' bg-gray-100 dark:bg-gray-700'}`}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* Section description */}
      <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
        {section==='active'   && 'Unread notifications — mark as read to move to Archived.'}
        {section==='archived' && 'Read notifications are stored here automatically.'}
        {section==='deleted'  && 'Deleted notifications are stored here for reference.'}
      </p>

      {/* Filters */}
      <FilterBar/>

      {/* Count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{displayList.length}</span> notification{displayList.length!==1?'s':''} shown
        </p>
        <span className="text-xs text-gray-400 capitalize">{role} portal</span>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {displayList.length===0?(
          <div className="px-4 py-16 text-center">
            <span className="text-4xl">{section==='active'?'✅':section==='archived'?'📂':'🗑️'}</span>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3">
              {section==='active'   && 'No unread notifications'}
              {section==='archived' && 'No archived notifications'}
              {section==='deleted'  && 'No deleted notifications'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {section==='active'?'All caught up!':'Try a different filter'}
            </p>
          </div>
        ):(
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {displayList.map(n=>(
              <NotifRow key={n.id} n={n} showReadBtn={section==='active'}/>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <span className="text-4xl">🗑️</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-3">Delete Notification?</h3>
            <p className="text-xs text-gray-500 mt-2">It will be moved to the Deleted section.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={doDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
