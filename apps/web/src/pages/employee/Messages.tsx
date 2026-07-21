import React, { useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import {
  useGetSentQuery, useGetInboxQuery, useSendMessageMutation, useMarkMessageReadMutation, useDeleteMessageMutation, ApiMessage,
} from '../../store/api/messagesApi';

type Recipient = 'manager' | 'deptManager' | 'admin' | 'team';
type Priority = 'normal' | 'urgent';
type Tab = 'compose' | 'sent' | 'inbox' | 'deleted';

const RECIPIENT_INFO: Record<Recipient, { label: string; icon: string; desc: string }> = {
  manager: { label: 'Manager', icon: '👔', desc: 'Main Manager (company-wide)' },
  deptManager: { label: 'Dept Manager', icon: '🏬', desc: "Your department's manager" },
  admin: { label: 'Admin', icon: '🛡️', desc: 'Admin Department' },
  team: { label: 'Team Members', icon: '👥', desc: 'All members in your department' },
};
const STATUS_CLR: Record<string, string> = {
  sent: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  delivered: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  read: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
};
const todayStr = new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

type DeletedMsg = { msg: ApiMessage; deletedAt: string };

export default function Messages() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('compose');

  const { data: sentMsgs = [], isLoading: loadingSent } = useGetSentQuery();
  const { data: inboxMsgs = [] } = useGetInboxQuery();
  const [sendMessage, { isLoading: submitting }] = useSendMessageMutation();
  const [markMessageRead] = useMarkMessageReadMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  const [deletedMsgs, setDeletedMsgs] = useState<DeletedMsg[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [viewMsg, setViewMsg] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [permDeleteId, setPermDeleteId] = useState<string | null>(null);

  const [delFilterDate, setDelFilterDate] = useState('');
  const [delFilterYear, setDelFilterYear] = useState<number | 'all'>('all');
  const [delFilterMonth, setDelFilterMonth] = useState<number | 'all'>('all');

  const [form, setForm] = useState({
    date: todayStr, time: nowTime(), title: '', description: '',
    recipients: ['manager'] as Recipient[], priority: 'normal' as Priority,
    link: '', fileName: '',
  });

  const toggleRecipient = (r: Recipient) => setForm((p) => ({ ...p, recipients: p.recipients.includes(r) ? p.recipients.filter((x) => x !== r) : [...p.recipients, r] }));

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return; }
    setForm((p) => ({ ...p, fileName: file.name }));
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Subject is required'); return; }
    if (!form.description.trim()) { toast.error('Message is required'); return; }
    if (form.recipients.length === 0) { toast.error('Select at least one recipient'); return; }
    try {
      await sendMessage({
        title: form.title.trim(), description: form.description.trim(),
        priority: form.priority, recipients: form.recipients,
        link: form.link.trim() || undefined, fileName: form.fileName || undefined,
      }).unwrap();
      toast.success(`Sent to ${form.recipients.map((r) => RECIPIENT_INFO[r].label).join(', ')} ✅`);
      setForm({ date: todayStr, time: nowTime(), title: '', description: '', recipients: ['manager'], priority: 'normal', link: '', fileName: '' });
      setTab('sent');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to send message');
    }
  };

  const markRead = async (id: string) => {
    try { await markMessageRead(id).unwrap(); } catch {}
    setReadIds((p) => new Set([...p, id]));
  };

  const doDelete = async () => {
    if (!deleteId) return;
    const msg = sentMsgs.find((m) => m._id === deleteId) || inboxMsgs.find((m) => m._id === deleteId);
    if (msg) setDeletedMsgs((p) => [{ msg, deletedAt: new Date().toISOString() }, ...p]);
    try { await deleteMessage(deleteId).unwrap(); } catch {}
    setDeleteId(null);
    toast.success('Message moved to Deleted');
    setTab('deleted');
  };

  const doRestore = () => {
    if (!restoreId) return;
    setDeletedMsgs((p) => p.filter((e) => e.msg._id !== restoreId));
    toast.success('Message restored');
    setRestoreId(null);
  };

  const doPermDelete = () => {
    if (!permDeleteId) return;
    setDeletedMsgs((p) => p.filter((e) => e.msg._id !== permDeleteId));
    setPermDeleteId(null);
    toast.success('Permanently deleted');
  };

  const activeSent = sentMsgs.filter((m) => !deletedMsgs.some((d) => d.msg._id === m._id));
  const activeInbox = inboxMsgs.filter((m) => !deletedMsgs.some((d) => d.msg._id === m._id));
  const unreadCount = activeInbox.filter((m) => !readIds.has(m._id!) && m.status !== 'read').length;

  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };

  const filteredDeleted = useMemo(() => deletedMsgs.filter((e) => {
    const d = new Date(e.deletedAt);
    if (delFilterDate) return e.deletedAt.slice(0, 10) === delFilterDate;
    if (delFilterYear !== 'all' && d.getFullYear() !== delFilterYear) return false;
    if (delFilterMonth !== 'all' && d.getMonth() !== delFilterMonth) return false;
    return true;
  }), [deletedMsgs, delFilterDate, delFilterYear, delFilterMonth]);

  const SentRow = ({ m }: { m: ApiMessage }) => (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewMsg({ ...m, mode: 'sent' })}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{m.title}</p>
            <Badge className={`capitalize ${STATUS_CLR[m.status || 'sent']}`}>{m.status || 'sent'}</Badge>
            {m.priority === 'urgent' && <Badge variant="destructive">🔴 Urgent</Badge>}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">📅 {fmtDate(m.createdAt)} · 📨 {(m.recipients || []).map((r) => RECIPIENT_INFO[r as Recipient]?.label || r).join(', ')}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600" onClick={() => setViewMsg({ ...m, mode: 'sent' })}>View</Button>
          <button onClick={() => setDeleteId(m._id!)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  const InboxRow = ({ m }: { m: ApiMessage }) => {
    const isUnread = !readIds.has(m._id!) && m.status !== 'read';
    return (
      <div className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors ${isUnread ? 'border-l-2 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/5' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">📩</span>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setViewMsg({ ...m, mode: 'inbox' }); markRead(m._id!); }}>
            <div className="flex items-center gap-1.5">
              <p className={`text-xs font-bold truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{m.title}</p>
              {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">From: <span className="font-medium capitalize">{m.senderName || m.senderRole || 'Manager'}</span> · {fmtDate(m.createdAt)}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600" onClick={() => { setViewMsg({ ...m, mode: 'inbox' }); markRead(m._id!); }}>View</Button>
            {isUnread && <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] bg-emerald-50 text-emerald-600" onClick={() => markRead(m._id!)}>Read</Button>}
            <button onClick={() => setDeleteId(m._id!)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sent', val: activeSent.length, icon: '📤', color: 'from-blue-500 to-blue-600', t: 'sent' as Tab },
          { label: 'Inbox', val: activeInbox.length, icon: '📥', color: 'from-purple-500 to-purple-600', t: 'inbox' as Tab },
          { label: 'Unread', val: unreadCount, icon: '🔔', color: 'from-amber-500 to-amber-600', t: 'inbox' as Tab },
          { label: 'Deleted', val: deletedMsgs.length, icon: '🗑️', color: 'from-red-500 to-red-600', t: 'deleted' as Tab },
        ].map((s) => (
          <button key={s.label} onClick={() => setTab(s.t)} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-white text-left hover:opacity-90 transition-all`}>
            <span className="text-lg block mb-0.5">{s.icon}</span>
            <p className="text-lg font-bold">{s.val}</p>
            <p className="text-[10px] opacity-80">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-1 flex gap-1">
        {([['compose', '✉️ Compose'], ['sent', `📤 Sent (${activeSent.length})`], ['inbox', `📥 Inbox${unreadCount > 0 ? ` · ${unreadCount} new` : ''}`], ['deleted', `🗑️ Deleted (${deletedMsgs.length})`]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${tab === t ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">✉️ New Message</h2>
            <p className="text-xs text-gray-500 mt-0.5">Communicate with your manager, admin, or team</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1 block">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
              <div><Label className="mb-1 block">Time</Label><Input value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} /></div>
            </div>
            <div><Label className="mb-1 block">Subject <span className="text-red-500">*</span></Label><Input value={form.title} placeholder="Brief subject…" onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label className="mb-1 block">Message <span className="text-red-500">*</span></Label><Textarea rows={3} value={form.description} placeholder="Write your message here…" onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label className="mb-1 block">Link <span className="text-gray-400 font-normal">(optional)</span></Label><Input type="url" value={form.link} placeholder="https://…" onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} /></div>
            <div>
              <Label className="mb-1 block">Attach File <span className="text-gray-400 font-normal">(optional, max 5 MB)</span></Label>
              {form.fileName ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <span className="text-emerald-600">📎</span>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex-1 truncate">{form.fileName}</p>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, fileName: '' }))} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <span>📁</span> Choose File
                </button>
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
            </div>
            <div>
              <Label className="mb-1.5 block">Send To <span className="text-red-500">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(RECIPIENT_INFO) as [Recipient, typeof RECIPIENT_INFO[Recipient]][]).map(([key, info]) => (
                  <button key={key} onClick={() => toggleRecipient(key)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${form.recipients.includes(key) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <span>{info.icon}</span>{info.label}{form.recipients.includes(key) && <span className="text-blue-500">✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as Priority[]).map((p) => (
                <button key={p} onClick={() => setForm((prev) => ({ ...prev, priority: p }))} className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${form.priority === p ? (p === 'urgent' ? 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-600') : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50'}`}>{p === 'urgent' ? '🔴 Urgent' : '🔵 Normal'}</button>
              ))}
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full rounded-xl">{submitting ? '⏳ Sending…' : '✈️ Send Message'}</Button>
          </div>
        </div>
      )}

      {tab === 'sent' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">📤 Sent Messages</h3></div>
          {loadingSent ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading…</div>
          ) : activeSent.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">📭</span><p className="text-sm text-gray-500 mt-2">No sent messages yet</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">{activeSent.map((m) => <SentRow key={m._id} m={m} />)}</div>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">📥 Inbox {unreadCount > 0 && <span className="ml-1 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{unreadCount} new</span>}</h3></div>
          {activeInbox.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">📭</span><p className="text-sm text-gray-500 mt-2">No messages received yet</p><p className="text-xs text-gray-400 mt-1">Messages from managers and admins appear here</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">{activeInbox.map((m) => <InboxRow key={m._id} m={m} />)}</div>
          )}
        </div>
      )}

      {tab === 'deleted' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Filter by:</span>
              <Input type="date" value={delFilterDate} onChange={(e) => { setDelFilterDate(e.target.value); setDelFilterYear('all'); setDelFilterMonth('all'); }} className="h-8 w-36 text-xs" />
              {(delFilterDate || delFilterYear !== 'all' || delFilterMonth !== 'all') && <Button size="sm" variant="ghost" className="text-[11px] text-red-500" onClick={() => { setDelFilterDate(''); setDelFilterYear('all'); setDelFilterMonth('all'); }}>Clear ✕</Button>}
              <span className="text-[10px] text-gray-400 ml-auto">{filteredDeleted.length} message{filteredDeleted.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/40 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-red-100 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 flex items-center justify-between">
              <div><h3 className="text-sm font-semibold text-red-700 dark:text-red-400">🗑️ Deleted Messages</h3><p className="text-[10px] text-red-500 mt-0.5">Restore to bring back, or permanently delete</p></div>
              {deletedMsgs.length > 0 && <Button size="sm" variant="ghost" className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600" onClick={() => setPermDeleteId('__all__')}>Empty Bin</Button>}
            </div>
            {filteredDeleted.length === 0 ? (
              <div className="py-12 text-center"><span className="text-3xl">🗑️</span><p className="text-sm text-gray-500 mt-2">{deletedMsgs.length === 0 ? 'No deleted messages' : 'No messages match this filter'}</p></div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filteredDeleted.map(({ msg: m, deletedAt }) => (
                  <div key={m._id} className="px-4 py-3 hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-colors opacity-75">
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">{m.senderRole ? '📩' : '📤'}</span>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewMsg({ ...m, mode: m.senderRole ? 'inbox' : 'sent' })}>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate line-through">{m.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">{m.senderRole ? `From: ${m.senderName || m.senderRole}` : `To: ${(m.recipients || []).map((r) => RECIPIENT_INFO[r as Recipient]?.label || r).join(', ')}`}</span>
                          <span className="text-[10px] text-gray-400">· {fmtDate(m.createdAt)}</span>
                          <span className="text-[10px] text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">Deleted {fmtDate(deletedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" onClick={() => setRestoreId(m._id!)}>↩ Restore</Button>
                        <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] bg-red-50 dark:bg-red-900/20 text-red-500" onClick={() => setPermDeleteId(m._id!)}>✕ Delete</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!viewMsg} onOpenChange={(o: boolean) => !o && setViewMsg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="truncate pr-4">{viewMsg?.title}</DialogTitle></DialogHeader>
          {viewMsg && (
            <div className="p-5 space-y-3">
              {viewMsg.mode === 'inbox' ? (
                <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
                  <span className="text-2xl">📩</span>
                  <div><p className="text-xs font-bold text-gray-800 dark:text-gray-200">{viewMsg.senderName || 'Manager/Admin'}</p><p className="text-[10px] text-gray-400 capitalize">{viewMsg.senderRole} · {fmtDate(viewMsg.createdAt)}</p></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400">Date</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{fmtDate(viewMsg.createdAt)}</p></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400">Status</p><p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 capitalize">{viewMsg.status || 'sent'}</p></div>
                </div>
              )}
              {viewMsg.mode === 'sent' && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Sent To</p>
                  <div className="flex gap-2 flex-wrap">{(viewMsg.recipients || []).map((r: string) => (<span key={r} className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-semibold">{RECIPIENT_INFO[r as Recipient]?.icon} {RECIPIENT_INFO[r as Recipient]?.label || r}</span>))}</div>
                </div>
              )}
              <div><p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Message</p><p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">{viewMsg.description}</p></div>
              {viewMsg.link && <p className="flex items-center gap-2 text-xs text-blue-600"><span>🔗</span>{viewMsg.link}</p>}
              {viewMsg.fileName && <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/10 rounded-xl"><span className="text-teal-600">📎</span><p className="text-xs font-semibold text-teal-700 dark:text-teal-400">{viewMsg.fileName}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" className="w-full rounded-xl" onClick={() => setViewMsg(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><span className="text-4xl">🗑️</span><AlertDialogTitle>Move to Deleted?</AlertDialogTitle><AlertDialogDescription>The message will be moved to the Deleted tab. You can restore or permanently delete it from there.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Move to Bin</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreId} onOpenChange={(o: boolean) => !o && setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><span className="text-4xl">↩️</span><AlertDialogTitle>Restore Message?</AlertDialogTitle><AlertDialogDescription>This message will be moved back to Sent or Inbox.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setRestoreId(null)}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={doRestore}>Restore</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!permDeleteId} onOpenChange={(o: boolean) => !o && setPermDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">💀</span>
            <AlertDialogTitle>{permDeleteId === '__all__' ? 'Empty Deleted Bin?' : 'Permanently Delete?'}</AlertDialogTitle>
            <AlertDialogDescription>{permDeleteId === '__all__' ? 'All messages in the bin will be permanently removed.' : 'This cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPermDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (permDeleteId === '__all__') setDeletedMsgs([]); else doPermDelete(); setPermDeleteId(null); }}>Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
