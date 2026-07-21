import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGetMyProfileQuery, useUpdateMyProfileMutation } from '../../store/api/employeesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

const PWD_CHECKS = [
  { label: '8+ chars', fn: (v: string) => v.length >= 8 },
  { label: 'Uppercase', fn: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', fn: (v: string) => /[0-9]/.test(v) },
  { label: 'Symbol', fn: (v: string) => /[^A-Za-z0-9]/.test(v) },
];
const S_CLR = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
const S_LBL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const NOTIF_DEF = { attendanceAlerts: true, taskDeadlines: true, performanceReports: false };

export default function AdminSettings() {
  const { user } = useAuth();
  const { data: apiProfile } = useGetMyProfileQuery();
  const [updateMyProfile] = useUpdateMyProfileMutation();

  const [profile, setProfile] = useState({ name: user?.name || 'Admin User', email: user?.email || '', phone: '', address: '', bio: '' });

  const [general, setGeneral] = useState({ companyName: 'ZetaQ Technologies Pvt. Ltd.', email: 'admin@zetaq.com', phone: '+91 98765 00001', address: '42, Tech Park, OMR, Chennai – 600097', timezone: 'Asia/Kolkata', language: 'English', dateFormat: 'DD/MM/YYYY' });
  const [company, setCompany] = useState({ workStart: '09:00', workEnd: '18:00', casualLeave: '10', sickLeave: '6', earnedLeave: '15', currency: 'INR', fiscalYear: 'April' });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showP, setShowP] = useState({ c: false, n: false, cf: false });
  const [pcdAt, setPcdAt] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(NOTIF_DEF);
  const [ticket, setTicket] = useState({ subject: '', category: 'General', message: '' });
  const [ticketSent, setTicketSent] = useState(false);

  useEffect(() => {
    if (!apiProfile) return;
    const addr = typeof apiProfile.address === 'object' && apiProfile.address ? [apiProfile.address.street, apiProfile.address.city, apiProfile.address.state, apiProfile.address.pincode].filter(Boolean).join(', ') : apiProfile.address;
    setProfile((p) => ({ ...p, name: `${apiProfile.firstName} ${apiProfile.lastName}`.trim() || p.name, email: apiProfile.email || p.email, phone: apiProfile.phone || p.phone, address: addr || p.address, bio: apiProfile.bio || p.bio }));
    const prefs = apiProfile.preferences || {};
    if (prefs.company) setCompany((p) => ({ ...p, ...prefs.company }));
    if (prefs.notifications) setNotifs((p) => ({ ...p, ...prefs.notifications }));
    if (prefs.general) setGeneral((p) => ({ ...p, ...prefs.general }));
  }, [apiProfile]);

  const saveGen = async () => {
    try {
      await updateMyProfile({ phone: profile.phone, address: profile.address, bio: profile.bio, preferences: { general } }).unwrap();
      toast.success('General settings saved!');
    } catch { toast.error('Failed to save'); }
  };
  const saveCo = async () => {
    try { await updateMyProfile({ preferences: { company } }).unwrap(); toast.success('Company settings saved!'); }
    catch { toast.error('Failed to save'); }
  };
  const saveNot = async () => {
    try { await updateMyProfile({ preferences: { notifications: notifs } }).unwrap(); toast.success('Notification settings saved!'); }
    catch { toast.error('Failed to save'); }
  };

  const score = PWD_CHECKS.filter((c) => c.fn(pwd.next)).length;
  const changePwd = async () => {
    if (!pwd.current) { toast.error('Enter current password'); return; }
    if (score < 2) { toast.error('Password too weak'); return; }
    if (pwd.next !== pwd.confirm) { toast.error('Passwords do not match'); return; }
    try { await authAPI.changePassword(pwd.current, pwd.next); toast.success('Password changed!'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed to change password'); return; }
    setPcdAt(new Date().toLocaleString('en-IN'));
    setPwd({ current: '', next: '', confirm: '' });
  };

  const sendTicket = () => {
    if (!ticket.subject.trim() || !ticket.message.trim()) { toast.error('Fill subject and message'); return; }
    setTicketSent(true); toast.success("Support ticket submitted! We'll respond within 24 hours.");
  };

  const Toggle = ({ label, k, desc }: { label: string; k: string; desc: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <div><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p><p className="text-xs text-gray-400 mt-0.5">{desc}</p></div>
      <Switch checked={notifs[k]} onCheckedChange={(v: boolean) => setNotifs((p) => ({ ...p, [k]: v }))} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Tabs defaultValue="general">
        <TabsList className="w-full">
          <TabsTrigger value="general">⚙️ <span className="hidden sm:inline">General</span></TabsTrigger>
          <TabsTrigger value="company">🏢 <span className="hidden sm:inline">Company</span></TabsTrigger>
          <TabsTrigger value="security">🔐 <span className="hidden sm:inline">Security</span></TabsTrigger>
          <TabsTrigger value="notifications">🔔 <span className="hidden sm:inline">Notifications</span></TabsTrigger>
          <TabsTrigger value="help">❓ <span className="hidden sm:inline">Help</span></TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">General Settings</h3>
            <div><Label>Company Name</Label><Input className="mt-1" value={general.companyName} onChange={(e) => setGeneral((p) => ({ ...p, companyName: e.target.value }))} /></div>
            <div><Label>Admin Email</Label><Input className="mt-1" type="email" value={general.email} onChange={(e) => setGeneral((p) => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input className="mt-1" type="tel" value={general.phone} onChange={(e) => setGeneral((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Address</Label><Input className="mt-1" value={general.address} onChange={(e) => setGeneral((p) => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Timezone</Label><Select value={general.timezone} onValueChange={(v: string) => setGeneral((p) => ({ ...p, timezone: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['Asia/Kolkata', 'UTC', 'America/New_York'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Language</Label><Select value={general.language} onValueChange={(v: string) => setGeneral((p) => ({ ...p, language: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['English', 'Tamil', 'Hindi'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Date Format</Label><Select value={general.dateFormat} onValueChange={(v: string) => setGeneral((p) => ({ ...p, dateFormat: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button className="w-full" onClick={saveGen}>Save General Settings</Button>
          </div>
        </TabsContent>

        <TabsContent value="company">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Company Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Work Start</Label><Input className="mt-1" type="time" value={company.workStart} onChange={(e) => setCompany((p) => ({ ...p, workStart: e.target.value }))} /></div>
              <div><Label>Work End</Label><Input className="mt-1" type="time" value={company.workEnd} onChange={(e) => setCompany((p) => ({ ...p, workEnd: e.target.value }))} /></div>
              <div><Label>Casual Leave (days)</Label><Input className="mt-1" type="number" value={company.casualLeave} onChange={(e) => setCompany((p) => ({ ...p, casualLeave: e.target.value }))} /></div>
              <div><Label>Sick Leave (days)</Label><Input className="mt-1" type="number" value={company.sickLeave} onChange={(e) => setCompany((p) => ({ ...p, sickLeave: e.target.value }))} /></div>
              <div><Label>Earned Leave (days)</Label><Input className="mt-1" type="number" value={company.earnedLeave} onChange={(e) => setCompany((p) => ({ ...p, earnedLeave: e.target.value }))} /></div>
              <div><Label>Currency</Label><Select value={company.currency} onValueChange={(v: string) => setCompany((p) => ({ ...p, currency: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['INR', 'USD', 'EUR', 'GBP'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Fiscal Year Starts</Label><Select value={company.fiscalYear} onValueChange={(v: string) => setCompany((p) => ({ ...p, fiscalYear: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['January', 'April', 'July', 'October'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button className="w-full" onClick={saveCo}>Save Company Settings</Button>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h3>
            {pcdAt && <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-xl"><span>🕐</span>Last changed: <span className="font-semibold text-gray-700 dark:text-gray-300">{pcdAt}</span></div>}
            {([['Current Password', 'current', 'c'], ['New Password', 'next', 'n'], ['Confirm', 'confirm', 'cf']] as [string, keyof typeof pwd, keyof typeof showP][]).map(([l, k, sk]) => (
              <div key={k}>
                <Label>{l}</Label>
                <div className="relative mt-1">
                  <Input type={showP[sk] ? 'text' : 'password'} value={pwd[k]} onChange={(e) => setPwd((p) => ({ ...p, [k]: e.target.value }))} className="pr-14" />
                  <button type="button" onClick={() => setShowP((p) => ({ ...p, [sk]: !p[sk] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showP[sk] ? 'Hide' : 'Show'}</button>
                </div>
                {k === 'next' && pwd.next && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= score ? S_CLR[score] : 'bg-gray-200 dark:bg-gray-600'}`} />)}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">{PWD_CHECKS.map((c) => <span key={c.label} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${c.fn(pwd.next) ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 border-gray-200'}`}>{c.fn(pwd.next) ? '✓ ' : ''}{c.label}</span>)}</div>
                      <span className={`text-[11px] font-semibold ml-2 ${score >= 3 ? 'text-emerald-500' : score >= 2 ? 'text-yellow-500' : 'text-red-500'}`}>{S_LBL[score]}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Button className="w-full" onClick={changePwd}>Update Password</Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Notification Preferences</h3>
            <p className="text-xs text-gray-400 mb-4">Choose which notifications you want to receive</p>
            <Toggle k="attendanceAlerts" label="Attendance Alerts" desc="Alerts for late check-ins, absences, and attendance reports" />
            <Toggle k="taskDeadlines" label="Task Deadlines" desc="Reminders when tasks are due or overdue" />
            <Toggle k="performanceReports" label="Performance Reports" desc="Monthly team performance summaries" />
            <Button className="w-full mt-4" onClick={saveNot}>Save Notification Settings</Button>
          </div>
        </TabsContent>

        <TabsContent value="help">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📧', label: 'Email Support', value: 'support@zetaq.com', sub: 'Response within 24 hours', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                { icon: '📞', label: 'Phone Support', value: '+91 98765 00099', sub: 'Mon–Fri, 9 AM – 6 PM IST', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                { icon: '💬', label: 'Live Chat', value: 'chat.zetaq.com', sub: 'Available 24/7', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
              ].map((c) => (
                <div key={c.label} className={`border rounded-2xl p-4 ${c.color}`}>
                  <span className="text-2xl">{c.icon}</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2">{c.label}</p>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">{c.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Frequently Asked Questions</h3>
              <div className="space-y-3">
                {[
                  { q: 'How do I reset an employee password?', a: 'Go to Employees → Edit → Security tab. You can trigger a password reset email from there.' },
                  { q: 'How is payroll calculated?', a: 'Payroll = Basic + HRA + Allowances − Deductions. You can configure rates in Company Settings.' },
                  { q: 'Can I export reports?', a: 'Yes! Go to Reports, select the type and period, then click Excel or PDF to download.' },
                  { q: 'How do I add a new department?', a: 'Go to Departments → Add Department. Enter the name, head, and budget details.' },
                  { q: 'What is the check-in grace period?', a: 'By default, employees are marked "Late" if they check in after 9:15 AM. This is configurable in Company Settings.' },
                ].map((f, i) => (
                  <details key={i} className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none py-2.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{f.q}</span>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform text-sm">▾</span>
                    </summary>
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-3 pt-2 pb-1 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Submit a Support Ticket</h3>
              {ticketSent ? (
                <div className="text-center py-6">
                  <span className="text-4xl">✅</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">Ticket Submitted!</p>
                  <p className="text-xs text-gray-400 mt-1">Our support team will respond within 24 hours at admin@zetaq.com</p>
                  <button onClick={() => setTicketSent(false)} className="mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline">Submit another ticket</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Subject *</Label><Input className="mt-1" value={ticket.subject} onChange={(e) => setTicket((p) => ({ ...p, subject: e.target.value }))} placeholder="Brief description of issue" /></div>
                    <div><Label>Category</Label><Select value={ticket.category} onValueChange={(v: string) => setTicket((p) => ({ ...p, category: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['General', 'Technical', 'Billing', 'Feature Request', 'Bug Report'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div><Label>Message *</Label><Textarea className="mt-1" rows={4} value={ticket.message} onChange={(e) => setTicket((p) => ({ ...p, message: e.target.value }))} placeholder="Describe your issue in detail…" /></div>
                  <Button className="w-full" onClick={sendTicket}>Submit Ticket</Button>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs">Z</div>
                <div><p className="text-xs font-bold text-gray-800 dark:text-gray-200">ZetaQ EMS</p><p className="text-[10px] text-gray-400">v2.1.0 &middot; Built by ZetaQ Technologies</p></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg font-medium">All Systems Operational</span>
                <a href="mailto:support@zetaq.com" className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">Contact Us</a>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
