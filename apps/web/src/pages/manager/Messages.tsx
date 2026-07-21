import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useGetSentQuery, useGetInboxQuery, useSendMessageMutation, useMarkMessageReadMutation, useDeleteMessageMutation, type ApiMessage } from '../../store/api/messagesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

type Recipient = 'admin' | 'team' | 'mainManager';
type Priority = 'normal' | 'urgent';
type Tab = 'compose' | 'sent' | 'inbox';

const RECIPIENT_INFO: Record<Recipient, { label: string; icon: string }> = {
  admin: { label: 'Admin', icon: '🛡️' },
  team: { label: 'My Team', icon: '👥' },
  // Only offered to dept-scoped managers (see mgrDept check below) — sends the
  // narrowed 'manager' token, which the backend now resolves to the main manager only.
  mainManager: { label: 'Main Manager', icon: '👑' },
};
const STATUS_VARIANT: Record<string, 'gray' | 'default' | 'success'> = { sent: 'gray', delivered: 'default', read: 'success' };
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };

export default function ManagerMessages() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const mgrDept = (user as any)?.department || '';

  const [tab, setTab] = useState<Tab>('compose');
  const { data: sentMsgs = [], isLoading } = useGetSentQuery();
  const { data: inboxMsgs = [], refetch: refetchInbox } = useGetInboxQuery();
  const [sendMessage, { isLoading: submitting }] = useSendMessageMutation();
  const [markRead] = useMarkMessageReadMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [viewMsg, setViewMsg] = useState<(ApiMessage & { mode: 'sent' | 'inbox' }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ title: '', description: '', recipients: ['team'] as Recipient[], priority: 'normal' as Priority, link: '', fileName: '', fileData: '' });

  const toggleRecipient = (r: Recipient) => setForm((p) => ({ ...p, recipients: p.recipients.includes(r) ? p.recipients.filter((x) => x !== r) : [...p.recipients, r] }));

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((p) => ({ ...p, fileData: ev.target?.result as string, fileName: file.name }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Subject is required'); return; }
    if (!form.description.trim()) { toast.error('Message is required'); return; }
    if (form.recipients.length === 0) { toast.error('Select at least one recipient'); return; }
    try {
      // The backend only knows 'manager'/'deptManager'/'admin'/'team' — 'mainManager'
      // is a manager-portal-only label for the same narrowed 'manager' token (Phase 3).
      const wireRecipients = form.recipients.map((r) => (r === 'mainManager' ? 'manager' : r));
      await sendMessage({ title: form.title.trim(), description: form.description.trim(), priority: form.priority, recipients: wireRecipients as any, department: mgrDept, link: form.link.trim() || undefined, fileName: form.fileName || undefined }).unwrap();
      toast.success(`Sent to ${form.recipients.map((r) => RECIPIENT_INFO[r]?.label || r).join(', ')} ✅`);
      setForm({ title: '', description: '', recipients: ['team'], priority: 'normal', link: '', fileName: '', fileData: '' });
      setTab('sent');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to send message');
    }
  };

  const doMarkRead = async (id: string) => { try { await markRead(id).unwrap(); } catch {} setReadIds((p) => new Set([...p, id])); };
  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteMessage(deleteId).unwrap(); toast.success('Message deleted'); } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  const unreadCount = useMemo(() => inboxMsgs.filter((m) => !readIds.has(m._id) && m.status !== 'read').length, [inboxMsgs, readIds]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sent', val: sentMsgs.length, icon: '📤', color: 'from-blue-500 to-blue-600', t: 'sent' as Tab },
          { label: 'Inbox', val: inboxMsgs.length, icon: '📥', color: 'from-purple-500 to-purple-600', t: 'inbox' as Tab },
          { label: 'Unread', val: unreadCount, icon: '🔔', color: 'from-amber-500 to-amber-600', t: 'inbox' as Tab },
        ].map((s) => (
          <button key={s.label} onClick={() => setTab(s.t)} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-white text-left hover:opacity-90`}>
            <span className="text-lg block mb-0.5">{s.icon}</span>
            <p className="text-lg font-bold">{s.val}</p>
            <p className="text-[10px] opacity-80">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-1 flex gap-1">
        {([['compose', '✉️ Compose'], ['sent', `📤 Sent (${sentMsgs.length})`], ['inbox', `📥 Inbox (${inboxMsgs.length})${unreadCount > 0 ? ` · ${unreadCount} new` : ''}`]] as [Tab, string][]).map(([t, l]) => (
          <Button key={t} variant={tab === t ? 'default' : 'ghost'} className="flex-1" onClick={() => setTab(t)}>{l}</Button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">✉️ Send Team Message</h2>
            <p className="text-xs text-gray-500 mt-0.5">Communicate with your team or admin{mgrDept ? ` · ${mgrDept} Dept` : ' · All Departments'}</p>
          </div>
          <div className="p-4 space-y-3">
            <div><Label>Subject *</Label><Input className="mt-1" value={form.title} placeholder="Brief subject…" onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Message *</Label><Textarea className="mt-1" rows={3} value={form.description} placeholder="Write your message…" onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Link (optional)</Label><Input className="mt-1" type="url" value={form.link} placeholder="https://…" onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} /></div>
            <div>
              <Label>Attach File (optional)</Label>
              {form.fileData ? (
                <div className="flex items-center gap-2 px-3 py-2 mt-1 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-600">📎</span>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex-1 truncate">{form.fileName}</p>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, fileName: '', fileData: '' }))} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="mt-1 border-dashed" onClick={() => fileRef.current?.click()}>📁 Choose File</Button>
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
            </div>
            <div>
              <Label>Send To *</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {(Object.entries(RECIPIENT_INFO) as [Recipient, typeof RECIPIENT_INFO[Recipient]][])
                  .filter(([key]) => key !== 'mainManager' || !!mgrDept)
                  .map(([key, info]) => (
                    <Button key={key} variant={form.recipients.includes(key) ? 'default' : 'outline'} size="sm" onClick={() => toggleRecipient(key)}>
                      {info.icon} {info.label}{form.recipients.includes(key) && ' ✓'}
                    </Button>
                  ))}
              </div>
            </div>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as Priority[]).map((p) => (
                <Button key={p} variant={form.priority === p ? 'default' : 'outline'} size="sm" className={form.priority === p && p === 'urgent' ? 'bg-red-500 hover:bg-red-600' : ''} onClick={() => setForm((prev) => ({ ...prev, priority: p }))}>{p === 'urgent' ? '🔴 Urgent' : '🔵 Normal'}</Button>
              ))}
            </div>
            <Button className="w-full" onClick={submit} disabled={submitting}>{submitting ? '⏳ Sending…' : '✈️ Send Message'}</Button>
          </div>
        </div>
      )}

      {tab === 'sent' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">📤 Sent Messages</h3></div>
          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading…</div>
          ) : sentMsgs.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">📭</span><p className="text-sm text-gray-500 mt-2">No sent messages yet</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {sentMsgs.map((m) => (
                <div key={m._id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewMsg({ ...m, mode: 'sent' })}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{m.title}</p>
                        <Badge variant={STATUS_VARIANT[m.status || 'sent']} className="capitalize">{m.status || 'sent'}</Badge>
                        {m.priority === 'urgent' && <Badge variant="destructive">🔴 Urgent</Badge>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">📅 {fmtDate(m.createdAt)} &middot; 📨 {(m.recipients || []).map((r) => RECIPIENT_INFO[r as Recipient]?.label || r).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[9px] bg-blue-50 text-blue-600" onClick={() => setViewMsg({ ...m, mode: 'sent' })}>View</Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-gray-400 hover:text-red-500" onClick={() => setDeleteId(m._id)}>✕</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">📥 Messages from Team {unreadCount > 0 && <Badge variant="default" className="ml-1">{unreadCount} new</Badge>}</h3>
            <button onClick={() => refetchInbox()} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Refresh</button>
          </div>
          {inboxMsgs.length === 0 ? (
            <div className="py-12 text-center"><span className="text-3xl">📭</span><p className="text-sm text-gray-500 mt-2">No messages from team yet</p></div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {inboxMsgs.map((m) => {
                const isUnread = !readIds.has(m._id) && m.status !== 'read';
                return (
                  <div key={m._id} className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors ${isUnread ? 'border-l-2 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/5' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">📩</span>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setViewMsg({ ...m, mode: 'inbox' }); doMarkRead(m._id); }}>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-bold truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{m.title}</p>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">From: <span className="font-medium capitalize">{m.senderName || 'Employee'}</span>{m.department && <span> &middot; {m.department}</span>}<span> &middot; {fmtDate(m.createdAt)}</span></p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[9px] bg-blue-50 text-blue-600" onClick={() => { setViewMsg({ ...m, mode: 'inbox' }); doMarkRead(m._id); }}>View</Button>
                        {isUnread && <Button size="sm" variant="secondary" className="h-auto py-0.5 text-[9px] bg-emerald-50 text-emerald-600" onClick={() => doMarkRead(m._id)}>Read</Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!viewMsg} onOpenChange={(o: boolean) => !o && setViewMsg(null)}>
        <DialogContent className="max-w-lg">
          {viewMsg && (
            <>
              <DialogHeader><DialogTitle className="truncate pr-4">{viewMsg.title}</DialogTitle></DialogHeader>
              <DialogBody>
                {viewMsg.mode === 'inbox' ? (
                  <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
                    <span className="text-2xl">📩</span>
                    <div><p className="text-xs font-bold text-gray-800 dark:text-gray-200">{viewMsg.senderName || 'Employee'}</p><p className="text-[10px] text-gray-400">{viewMsg.department} &middot; {fmtDate(viewMsg.createdAt)}</p></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400">Date</p><p className="text-xs font-bold mt-0.5">{fmtDate(viewMsg.createdAt)}</p></div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p className="text-[10px] text-gray-400">Status</p><p className="text-xs font-bold mt-0.5 capitalize">{viewMsg.status || 'sent'}</p></div>
                  </div>
                )}
                <div><p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Message</p><p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">{viewMsg.description}</p></div>
                {viewMsg.link && <a href={viewMsg.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline"><span>🔗</span>{viewMsg.link}</a>}
                {viewMsg.fileName && <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/10 rounded-xl"><span className="text-teal-600">📎</span><p className="text-xs font-semibold text-teal-700 dark:text-teal-400">{viewMsg.fileName}</p></div>}
              </DialogBody>
              <DialogFooter><Button variant="outline" className="w-full" onClick={() => setViewMsg(null)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">🗑️</span>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
