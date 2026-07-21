import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGetMyProfileQuery, useUpdateMyProfileMutation } from '../../store/api/employeesApi';

const SKILLS_LIST = ['React', 'TypeScript', 'Node.js', 'Python', 'Java', 'SQL', 'MongoDB', 'AWS', 'Docker', 'Git', 'Figma', 'Excel'];

type ProfileForm = {
  name: string; email: string; phone: string; designation: string; dept: string;
  empId: string; joined: string; gender: string; dob: string; address: string;
  blood: string; emergency: { name: string; relation: string; phone: string };
  skills: string[]; bio: string;
};

const EMPTY_PROFILE: ProfileForm = { name: '', email: '', phone: '', designation: '', dept: '', empId: '', joined: '', gender: '', dob: '', address: '', blood: '', emergency: { name: '', relation: '', phone: '' }, skills: [], bio: '' };

export default function EmployeeProfile() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: apiProfile } = useGetMyProfileQuery();
  const [updateMyProfile, { isLoading: saving }] = useUpdateMyProfileMutation();

  const [avatar, setAvatar] = useState<string>('');
  const [edit, setEdit] = useState(false);

  const [profile, setProfile] = useState<ProfileForm>({ ...EMPTY_PROFILE, name: user?.name || '', email: user?.email || '' });
  const [form, setForm] = useState<ProfileForm>({ ...EMPTY_PROFILE, name: user?.name || '', email: user?.email || '' });

  useEffect(() => {
    const e = apiProfile;
    if (!e) return;
    const merged: ProfileForm = {
      name: e.user?.name || user?.name || '',
      email: e.user?.email || user?.email || '',
      phone: e.phone || '',
      designation: e.designation || '',
      dept: typeof e.department === 'object' ? e.department?.name || '' : e.department || '',
      empId: e.employeeCode || '',
      joined: e.joiningDate?.slice(0, 10) || '',
      gender: e.gender || '',
      dob: e.dateOfBirth?.slice(0, 10) || '',
      address: typeof e.address === 'object' && e.address ? [e.address.street, e.address.city, e.address.state, e.address.pincode].filter(Boolean).join(', ') : (e.address as string) || '',
      blood: e.bloodGroup || '',
      emergency: { name: e.emergencyContact?.name || '', relation: e.emergencyContact?.relation || '', phone: e.emergencyContact?.phone || '' },
      skills: e.skills || [],
      bio: e.bio || '',
    };
    setProfile(merged);
    setForm(merged);
    if (e.avatar) setAvatar(e.avatar);
  }, [apiProfile]);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setAvatar(base64);
      try { await updateMyProfile({ avatar: base64 }).unwrap(); toast.success('Profile photo updated!'); }
      catch { toast.error('Failed to save photo'); }
    };
    reader.readAsDataURL(file);
  };

  const toggleSkill = (s: string) => setForm((p) => ({ ...p, skills: p.skills.includes(s) ? p.skills.filter((x) => x !== s) : [...p.skills, s] }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const [firstName, ...rest] = form.name.trim().split(' ');
    const lastName = rest.join(' ') || '-';
    try {
      await updateMyProfile({
        firstName, lastName, phone: form.phone, address: form.address, bloodGroup: form.blood,
        dateOfBirth: form.dob, gender: form.gender, emergencyContact: form.emergency, skills: form.skills, bio: form.bio,
      }).unwrap();
      setProfile(form);
      toast.success('Profile saved!');
    } catch {
      toast.error('Failed to save profile');
    }
    setEdit(false);
  };

  const initials = profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const FLD = ({ label, k, type = 'text', disabled = false }: { label: string; k: string; type?: string; disabled?: boolean }) => (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {edit && !disabled ? (
        <Input type={type} value={(form as any)[k] || ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
      ) : (
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">{(profile as any)[k] || '—'}</p>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 relative flex items-center justify-center">
          <span className="text-white/80 text-xl font-bold tracking-widest select-none pointer-events-none">My Profile</span>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-12 mb-4 flex-wrap gap-3">
            <div className="relative">
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-gray-800 shadow-lg">{initials}</div>
              )}
              {edit && (
                <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center text-sm shadow transition-colors" title="Change photo">📷</button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div className="flex gap-2 mt-8">
              {!edit ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEdit(true)}>✏️ Edit Profile</Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setEdit(false); setForm({ ...profile }); }}>Cancel</Button>
                  <Button size="sm" className="rounded-xl" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                </>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{profile.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{profile.designation} · {profile.dept}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-gray-400">🆔 {profile.empId}</span>
              <span className="text-xs text-gray-400">📅 Joined {profile.joined}</span>
              <Badge variant="success">● Active</Badge>
            </div>
            {profile.bio && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed italic">"{profile.bio}"</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personal Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <FLD label="Full Name" k="name" />
          <FLD label="Email" k="email" type="email" disabled />
          <FLD label="Phone" k="phone" type="tel" />
          <FLD label="Date of Birth" k="dob" type="date" />
          <div>
            <Label className="mb-1 block">Gender</Label>
            {edit ? (
              <Select value={form.gender || undefined} onValueChange={(v: string) => setForm((p) => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">{profile.gender || '—'}</p>
            )}
          </div>
          <FLD label="Blood Group" k="blood" />
          <div className="col-span-2"><FLD label="Address" k="address" /></div>
          {edit && (
            <div className="col-span-2">
              <Label className="mb-1 block">Bio</Label>
              <Textarea rows={2} value={form.bio || ''} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Short bio about yourself…" />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Work Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <FLD label="Employee ID" k="empId" disabled />
          <FLD label="Department" k="dept" disabled />
          <FLD label="Designation" k="designation" disabled />
          <FLD label="Joined Date" k="joined" disabled />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Emergency Contact</h3>
        <div className="grid grid-cols-3 gap-3">
          {(['name', 'relation', 'phone'] as const).map((k) => (
            <div key={k}>
              <Label className="mb-1 block capitalize">{k}</Label>
              {edit ? (
                <Input value={(form.emergency as any)[k] || ''} onChange={(e) => setForm((p) => ({ ...p, emergency: { ...p.emergency, [k]: e.target.value } }))} />
              ) : (
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">{(profile.emergency as any)[k] || '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Skills</h3>
        {edit ? (
          <div className="flex flex-wrap gap-2">
            {SKILLS_LIST.map((s) => (
              <button key={s} onClick={() => toggleSkill(s)} className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${form.skills.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500'}`}>
                {form.skills.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).length === 0 ? <p className="text-xs text-gray-400">No skills added yet</p> : profile.skills.map((s) => <Badge key={s} className="border border-blue-200 dark:border-blue-800">{s}</Badge>)}
          </div>
        )}
      </div>
    </div>
  );
}
