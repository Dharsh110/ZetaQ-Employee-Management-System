import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useGetMyProfileQuery, useUpdateMyProfileMutation } from '../../store/api/employeesApi';

type Tab = 'account' | 'notifications' | 'privacy' | 'preferences' | 'help';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'privacy', label: 'Privacy', icon: '🔐' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'help', label: 'Help & Support', icon: '❓' },
];

const PWD_CHECKS = [
  { label: '8+ chars', fn: (v: string) => v.length >= 8 },
  { label: 'Uppercase', fn: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', fn: (v: string) => /[0-9]/.test(v) },
  { label: 'Symbol', fn: (v: string) => /[^A-Za-z0-9]/.test(v) },
];
const S_CLR = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
const S_LBL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const Toggle = ({ label, k, desc, state, setState }: { label: string; k: string; desc: string; state: any; setState: any }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
    <div><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p><p className="text-xs text-gray-400 mt-0.5">{desc}</p></div>
    <Switch checked={!!state[k]} onCheckedChange={(v: boolean) => setState((p: any) => ({ ...p, [k]: v }))} />
  </div>
);

const FAQ = [
  { q: 'How do I apply for leave?', ans: 'Go to "My Leaves" from the sidebar, then click "Apply Leave" and fill in the details.' },
  { q: 'When is my payslip available?', ans: 'Payslips are generated on the last working day of each month. Visit "Payslips" to view or download.' },
  { q: 'How do I update my profile photo?', ans: 'Go to "My Profile" → click on your avatar or the "Change Photo" button → upload a JPG/PNG image.' },
  { q: 'Can I edit my check-in time?', ans: 'No — attendance records are system-generated for accuracy. Contact HR if there is an error.' },
  { q: 'How do I submit my daily work report?', ans: 'Go to "Daily Report" in the sidebar. You can update task status and submit a daily work log there.' },
  { q: 'How do I change my password?', ans: 'Go to Settings → Account tab → scroll to "Change Password" section.' },
];

export default function EmployeeSettings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('account');

  const { data: apiProfile } = useGetMyProfileQuery();
  const [updateMyProfile] = useUpdateMyProfileMutation();

  const [account, setAccount] = useState({ name: user?.name || '', email: user?.email || '', phone: '', timezone: 'Asia/Kolkata', language: 'English' });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showP, setShowP] = useState({ c: false, n: false, cf: false });
  const [empInfo, setEmpInfo] = useState({ empId: '—', dept: '—', designation: '—', joined: '—', workLocation: '—' });

  const [notifs, setNotifs] = useState({ leaveStatusUpdate: true, taskAssigned: true, taskDeadlineReminder: true, payslipGenerated: true, calendarEvents: true, attendanceReminder: false, teamAnnouncements: true });
  const [privacy, setPrivacy] = useState({ showProfile: true, showPhone: false, showBirthday: true });
  const [prefs, setPrefs] = useState({ compactView: false, emailDigest: true, sound: false });

  useEffect(() => {
    const d = apiProfile;
    if (!d) return;
    setAccount((p) => ({ ...p, name: d.user?.name || user?.name || p.name, email: d.user?.email || user?.email || p.email, phone: d.phone || p.phone, timezone: d.preferences?.timezone || p.timezone, language: d.preferences?.language || p.language }));
    setEmpInfo({ empId: d.employeeCode || '—', dept: typeof d.department === 'object' ? d.department?.name || '—' : d.department || '—', designation: d.designation || '—', joined: d.joiningDate?.slice(0, 10) || '—', workLocation: d.workLocation || '—' });
    if (d.preferences?.notifications) setNotifs((n) => ({ ...n, ...d.preferences!.notifications }));
    if (d.preferences?.privacy) setPrivacy((p) => ({ ...p, ...d.preferences!.privacy }));
    if (d.preferences?.ui) setPrefs((p) => ({ ...p, ...d.preferences!.ui }));
  }, [apiProfile]);

  const [ticket, setTicket] = useState({ subject: '', message: '', priority: 'medium' });
  const [ticketSent, setTicketSent] = useState(false);

  const saveAccount = async () => {
    try { await updateMyProfile({ phone: account.phone, preferences: { timezone: account.timezone, language: account.language } }).unwrap(); toast.success('Account settings saved!'); }
    catch { toast.error('Failed to save account settings'); }
  };

  const score = PWD_CHECKS.filter((c) => c.fn(pwd.next)).length;
  const changePwd = async () => {
    if (!pwd.current) { toast.error('Enter current password'); return; }
    if (score < 2) { toast.error('Password too weak'); return; }
    if (pwd.next !== pwd.confirm) { toast.error('Passwords do not match'); return; }
    try { await authAPI.changePassword(pwd.current, pwd.next); toast.success('Password changed!'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed to change password'); return; }
    setPwd({ current: '', next: '', confirm: '' });
  };

  const saveNotifs = async () => { try { await updateMyProfile({ preferences: { notifications: notifs } }).unwrap(); toast.success('Notification preferences saved!'); } catch { toast.error('Failed to save notification preferences'); } };
  const savePrivacy = async () => { try { await updateMyProfile({ preferences: { privacy } }).unwrap(); toast.success('Privacy settings saved!'); } catch { toast.error('Failed to save privacy settings'); } };
  const savePrefs = async () => { try { await updateMyProfile({ preferences: { ui: prefs } }).unwrap(); toast.success('Preferences saved!'); } catch { toast.error('Failed to save preferences'); } };

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.message.trim()) { toast.error('Subject and message are required'); return; }
    setTicketSent(true); toast.success('Support ticket submitted!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-1 flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${tab === t.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account Information</h3>
            {([['Full Name', 'name', 'text'], ['Email Address', 'email', 'email'], ['Phone Number', 'phone', 'tel']] as [string, string, string][]).map(([l, k, t]) => (
              <div key={k}>
                <Label className="mb-1 block">{l}</Label>
                <Input type={t} value={(account as any)[k] || ''} disabled={k === 'email'} onChange={(e) => setAccount((p: any) => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Timezone</Label>
                <Select value={account.timezone} onValueChange={(v: string) => setAccount((p) => ({ ...p, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Asia/Kolkata', 'UTC', 'America/New_York'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Language</Label>
                <Select value={account.language} onValueChange={(v: string) => setAccount((p) => ({ ...p, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['English', 'Tamil', 'Hindi'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full rounded-xl" onClick={saveAccount}>Save Account Settings</Button>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h3>
            {([['Current Password', 'current', 'c'], ['New Password', 'next', 'n'], ['Confirm New Password', 'confirm', 'cf']] as [string, string, string][]).map(([l, k, sk]) => (
              <div key={k}>
                <Label className="mb-1 block">{l}</Label>
                <div className="relative">
                  <Input type={(showP as any)[sk] ? 'text' : 'password'} value={(pwd as any)[k]} className="pr-14" onChange={(e) => setPwd((p) => ({ ...p, [k]: e.target.value }))} />
                  <button type="button" onClick={() => setShowP((p) => ({ ...p, [sk]: !(p as any)[sk] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{(showP as any)[sk] ? 'Hide' : 'Show'}</button>
                </div>
                {k === 'next' && pwd.next && (
                  <div className="mt-2">
                    <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= score ? S_CLR[score] : 'bg-gray-200 dark:bg-gray-600'}`} />)}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex flex-wrap gap-1">{PWD_CHECKS.map((c) => <span key={c.label} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${c.fn(pwd.next) ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 border-gray-200'}`}>{c.fn(pwd.next) ? '✓ ' : ''}{c.label}</span>)}</div>
                      <span className={`text-[11px] font-semibold ml-2 ${score >= 3 ? 'text-emerald-500' : score >= 2 ? 'text-yellow-500' : 'text-red-500'}`}>{S_LBL[score]}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Button className="w-full rounded-xl" onClick={changePwd}>Update Password</Button>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Notification Preferences</h3>
          <p className="text-xs text-gray-400 mb-4">Choose which notifications you want to receive</p>
          <Toggle k="leaveStatusUpdate" label="Leave Status Updates" desc="When your leave is approved or rejected" state={notifs} setState={setNotifs} />
          <Toggle k="taskAssigned" label="New Task Assigned" desc="When a manager or admin assigns you a task" state={notifs} setState={setNotifs} />
          <Toggle k="taskDeadlineReminder" label="Task Deadline Reminders" desc="Reminders 1 day before tasks are due" state={notifs} setState={setNotifs} />
          <Toggle k="payslipGenerated" label="Payslip Generated" desc="When your monthly payslip is ready" state={notifs} setState={setNotifs} />
          <Toggle k="calendarEvents" label="Upcoming Events" desc="Company events and holiday reminders" state={notifs} setState={setNotifs} />
          <Toggle k="attendanceReminder" label="Daily Check-in Reminder" desc="Morning reminder to check in (sent at 8:45 AM)" state={notifs} setState={setNotifs} />
          <Toggle k="teamAnnouncements" label="Team Announcements" desc="Important messages from your manager or HR" state={notifs} setState={setNotifs} />
          <Button className="w-full mt-4 rounded-xl" onClick={saveNotifs}>Save Notification Preferences</Button>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Privacy Settings</h3>
          <p className="text-xs text-gray-400 mb-4">Control what your colleagues can see</p>
          <Toggle k="showProfile" label="Show Profile to Team" desc="Your profile is visible to teammates" state={privacy} setState={setPrivacy} />
          <Toggle k="showPhone" label="Show Phone Number" desc="Show your contact number on your profile page" state={privacy} setState={setPrivacy} />
          <Toggle k="showBirthday" label="Show Birthday" desc="Let colleagues see your birthday for wishes" state={privacy} setState={setPrivacy} />
          <Button className="w-full mt-4 rounded-xl" onClick={savePrivacy}>Save Privacy Settings</Button>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">App Preferences</h3>
          <p className="text-xs text-gray-400 mb-4">Customize your portal experience</p>
          <Toggle k="compactView" label="Compact View" desc="Show more content with reduced spacing" state={prefs} setState={setPrefs} />
          <Toggle k="emailDigest" label="Weekly Email Digest" desc="Receive a weekly summary of your activity" state={prefs} setState={setPrefs} />
          <Toggle k="sound" label="Notification Sound" desc="Play a sound when new notifications arrive" state={prefs} setState={setPrefs} />
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Employee Information</p>
            <div className="grid grid-cols-2 gap-2">
              {[['Employee ID', empInfo.empId], ['Department', empInfo.dept], ['Designation', empInfo.designation], ['Joining Date', empInfo.joined], ['Work Location', empInfo.workLocation]].map(([l, v]) => (
                <div key={l} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-gray-400 font-medium">{l}</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full mt-4 rounded-xl" onClick={savePrefs}>Save Preferences</Button>
        </div>
      )}

      {tab === 'help' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '📧', title: 'Email Support', info: 'support@zetaq.com', sub: 'Reply within 24 hours', color: 'from-blue-500 to-blue-600' },
              { icon: '📞', title: 'Phone Support', info: '+91 44 2345 6789', sub: 'Mon–Fri, 9 AM – 6 PM', color: 'from-emerald-500 to-emerald-600' },
              { icon: '💬', title: 'Live Chat', info: 'Available in Portal', sub: 'Avg wait: 2 minutes', color: 'from-purple-500 to-purple-600' },
            ].map((c) => (
              <div key={c.title} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white`}>
                <span className="text-2xl block mb-2">{c.icon}</span>
                <p className="text-sm font-bold">{c.title}</p>
                <p className="text-xs opacity-90 mt-0.5">{c.info}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Frequently Asked Questions</h3>
            <div className="space-y-1">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none">
                    {f.q}
                    <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <div className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-50 dark:border-gray-700 pt-2">{f.ans}</div>
                </details>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Raise a Support Ticket</h3>
            <p className="text-xs text-gray-400 mb-4">Can't find what you need? Submit a request and HR/admin will respond within 2 business days.</p>
            {ticketSent ? (
              <div className="py-6 text-center">
                <span className="text-3xl">✅</span>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2">Ticket submitted!</p>
                <p className="text-xs text-gray-400 mt-1">Our team will respond within 2 business days.</p>
                <button onClick={() => setTicketSent(false)} className="mt-3 text-xs text-blue-600 hover:underline">Submit another ticket</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div><Label className="mb-1 block">Subject <span className="text-red-500">*</span></Label><Input value={ticket.subject} placeholder="Brief description of your issue" onChange={(e) => setTicket((p) => ({ ...p, subject: e.target.value }))} /></div>
                <div>
                  <Label className="mb-1 block">Priority</Label>
                  <Select value={ticket.priority} onValueChange={(v: string) => setTicket((p) => ({ ...p, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low — General query</SelectItem>
                      <SelectItem value="medium">Medium — Needs attention</SelectItem>
                      <SelectItem value="high">High — Urgent issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="mb-1 block">Message <span className="text-red-500">*</span></Label><Textarea value={ticket.message} rows={4} placeholder="Describe your issue in detail…" onChange={(e) => setTicket((p) => ({ ...p, message: e.target.value }))} /></div>
                <Button className="w-full rounded-xl" onClick={submitTicket}>Submit Support Ticket</Button>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">ZetaQ EMS v2.0.0 · Build 2026.06</p>
              <p className="text-[10px] text-gray-400">© {new Date().getFullYear()} ZetaQ Technologies</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
