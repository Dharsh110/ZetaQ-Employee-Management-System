import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useGetMyProfileQuery, useUpdateMyProfileMutation } from '../../store/api/employeesApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

interface ProfilePageProps {
  roleLabel: string;
  gradient: string;
  accent: string;
  quickStats: { l: string; v: string; icon: string; c: string }[];
  skills: string[];
  emergencyContact: [string, string][];
}

export default function ProfilePage({ roleLabel, gradient, accent, quickStats, skills, emergencyContact }: ProfilePageProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState('');
  const [edit, setEdit] = useState(false);

  const { data: apiProfile } = useGetMyProfileQuery();
  const [updateMyProfile] = useUpdateMyProfileMutation();

  const blank = {
    name: user?.name || '', email: user?.email || '', phone: '', designation: '',
    department: (user as any)?.department || '', empId: '', joined: '', gender: '', dob: '',
    address: '', blood: '', bio: '',
  };
  const [profile, setProfile] = useState(blank);
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!apiProfile) return;
    const p = {
      name: `${apiProfile.firstName || ''} ${apiProfile.lastName || ''}`.trim() || user?.name || '',
      email: apiProfile.email || user?.email || '',
      phone: apiProfile.phone || '',
      designation: apiProfile.designation || '',
      department: typeof apiProfile.department === 'object' ? apiProfile.department?.name || '' : apiProfile.department || (user as any)?.department || '',
      empId: apiProfile.employeeCode || '',
      joined: apiProfile.joiningDate?.slice(0, 10) || '',
      gender: apiProfile.gender || '',
      dob: apiProfile.dateOfBirth?.slice(0, 10) || '',
      address: (typeof apiProfile.address === 'object' && apiProfile.address ? [apiProfile.address.street, apiProfile.address.city, apiProfile.address.state, apiProfile.address.pincode].filter(Boolean).join(', ') : apiProfile.address) || '',
      blood: apiProfile.bloodGroup || '',
      bio: apiProfile.bio || '',
    };
    setProfile(p);
    setForm(p);
    if (apiProfile.avatar) setAvatar(apiProfile.avatar);
  }, [apiProfile]);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      setAvatar(b64);
      try { await updateMyProfile({ avatar: b64 }).unwrap(); toast.success('Photo updated!'); }
      catch { toast.error('Failed to save photo'); }
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      const [firstName, ...rest] = form.name.trim().split(' ');
      await updateMyProfile({ phone: form.phone, address: form.address, bloodGroup: form.blood, dateOfBirth: form.dob, gender: form.gender, bio: form.bio, firstName, lastName: rest.join(' ') }).unwrap();
      setProfile(form); setEdit(false); toast.success('Profile saved!');
    } catch { toast.error('Failed to save profile'); }
  };

  const ini = profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const fields: [string, keyof typeof profile, string][] = [
    ['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'tel'],
    ['Designation', 'designation', 'text'], ['Department', 'department', 'text'], ['Emp ID', 'empId', 'text'],
    ['Joined Date', 'joined', 'date'], ['Date of Birth', 'dob', 'date'], ['Gender', 'gender', 'text'], ['Blood Group', 'blood', 'text'],
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 text-white`}>
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatar
              ? <img src={avatar} alt={profile.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40" />
              : <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">{ini}</div>}
            <button onClick={() => fileRef.current?.click()} className={`absolute -bottom-1 -right-1 w-7 h-7 bg-white ${accent} rounded-full flex items-center justify-center text-sm shadow-lg hover:scale-110 transition-transform`} title="Change photo">📷</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile.name}</h2>
            <p className="text-white/90 text-sm">{profile.designation} &middot; {profile.department}</p>
            <p className="text-white/70 text-xs mt-1">{profile.email}</p>
            <span className="inline-block mt-2 text-[10px] px-2.5 py-1 bg-white/20 rounded-full font-semibold">{roleLabel}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((s) => (
          <div key={s.l} className={`border border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 text-center ${s.c}`}>
            <p className="text-2xl">{s.icon}</p>
            <p className="text-xl font-bold mt-1">{s.v}</p>
            <p className="text-[10px] font-semibold mt-0.5 opacity-80">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personal Information</h3>
          {!edit
            ? <Button size="sm" onClick={() => { setForm({ ...profile }); setEdit(true); }}>✏️ Edit</Button>
            : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEdit(false)}>Cancel</Button><Button size="sm" onClick={save}>Save</Button></div>}
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(([label, key, type]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                {edit
                  ? <Input type={type} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                  : <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{profile[key] || '—'}</p>}
              </div>
            ))}
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Address</p>
              {edit ? <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /> : <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{profile.address || '—'}</p>}
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Bio</p>
              {edit ? <Textarea rows={3} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} /> : <p className="text-sm text-gray-700 dark:text-gray-300">{profile.bio || '—'}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Skills &amp; Expertise</h3>
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => <span key={s} className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300 rounded-xl font-semibold border border-gray-200 dark:border-gray-700">{s}</span>)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Emergency Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {emergencyContact.map(([l, v]) => (
            <div key={l}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{l}</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
