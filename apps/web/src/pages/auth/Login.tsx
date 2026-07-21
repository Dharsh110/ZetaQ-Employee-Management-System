import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Spinner } from '../../components/ui/index';
import toast from 'react-hot-toast';

type RoleId = 'admin' | 'manager' | 'employee';
interface LoginForm { email: string; password: string; }

const ROLES = [
  { id: 'admin'    as RoleId, label: 'Admin',    desc: 'Full system access', ab: 'A',
    ring: 'ring-purple-500', bg: 'bg-purple-600', lbg: 'bg-purple-50', ltext: 'text-purple-700', lring: 'ring-purple-400',
    selBg: 'dark:bg-purple-900/30 bg-purple-50', selBorder: 'border-purple-500' },
  { id: 'manager'  as RoleId, label: 'Manager',  desc: 'Team management',    ab: 'M',
    ring: 'ring-blue-500',   bg: 'bg-blue-600',   lbg: 'bg-blue-50',   ltext: 'text-blue-700',   lring: 'ring-blue-400',
    selBg: 'dark:bg-blue-900/30 bg-blue-50',   selBorder: 'border-blue-500' },
  { id: 'employee' as RoleId, label: 'Employee', desc: 'Personal workspace', ab: 'E',
    ring: 'ring-emerald-500', bg: 'bg-emerald-600', lbg: 'bg-emerald-50', ltext: 'text-emerald-700', lring: 'ring-emerald-400',
    selBg: 'dark:bg-emerald-900/30 bg-emerald-50', selBorder: 'border-emerald-500' },
];

// Google Sign-In temporarily disabled — re-enable by uncommenting GCID, handleGoogle, and the button block below.
// const GCID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const DEPT_MGR_CLR = 'text-blue-600 dark:text-blue-400';
const DEMO_CREDS = [
  { role: 'Admin',    email: 'admin@zetaq.com',   pwd: 'Admin@1234',   color: 'text-purple-600 dark:text-purple-400', tag: 'ADM0001' },
  { role: 'Manager',  email: 'manager@zetaq.com', pwd: 'MainMgr@1234', color: DEPT_MGR_CLR, tag: 'Main Manager · All Departments' },
  { role: 'Manager',  email: 'deepak.manager@zetaq.com', pwd: 'Deepak@1234', color: DEPT_MGR_CLR, tag: 'Dept Manager · Engineering' },
  { role: 'Manager',  email: 'vivek.marketing.manager@zetaq.com', pwd: '843d7c0a639a', color: DEPT_MGR_CLR, tag: 'Dept Manager · Marketing' },
  { role: 'Manager',  email: 'sneha.finance.manager@zetaq.com', pwd: '8f85b2a66d77', color: DEPT_MGR_CLR, tag: 'Dept Manager · Finance' },
  { role: 'Manager',  email: 'vikram.product.manager@zetaq.com', pwd: 'c7152dd5d869', color: DEPT_MGR_CLR, tag: 'Dept Manager · Product' },
  { role: 'Manager',  email: 'pooja.design.manager@zetaq.com', pwd: '857b912a42e8', color: DEPT_MGR_CLR, tag: 'Dept Manager · Design' },
  { role: 'Manager',  email: 'ananya.salesmarketing.manager@zetaq.com', pwd: '41a7aef42334', color: DEPT_MGR_CLR, tag: 'Dept Manager · Sales & Marketing' },
  { role: 'Manager',  email: 'kavya.support.manager@zetaq.com', pwd: 'f8d28ebe4f9d', color: DEPT_MGR_CLR, tag: 'Dept Manager · Support' },
  { role: 'Manager',  email: 'nikhil.security.manager@zetaq.com', pwd: '7d964c61a5ad', color: DEPT_MGR_CLR, tag: 'Dept Manager · Security' },
  { role: 'Manager',  email: 'meena.hr.manager@zetaq.com', pwd: 'cb363af89c18', color: DEPT_MGR_CLR, tag: 'Dept Manager · HR' },
  { role: 'Manager',  email: 'ganesh.bpo.manager@zetaq.com', pwd: '9aa3b9af8e6d', color: DEPT_MGR_CLR, tag: 'Dept Manager · BPO' },
  { role: 'Employee', email: 'arjun@zetaq.com',   pwd: 'Arjun@1234',   color: 'text-emerald-600 dark:text-emerald-400', tag: '' },
];

export default function Login() {
  const [role, setRole]     = useState<RoleId>('employee');
  const [showPwd, setShowPwd] = useState(false);
  const [gLoad, setGLoad]   = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const { login, loading }  = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const sel = ROLES.find(r => r.id === role)!;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({ mode: 'onChange' });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email.trim().toLowerCase(), data.password, role.toLowerCase());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid credentials. Please try again.');
    }
  };

  const fillDemo = (cred: typeof DEMO_CREDS[0]) => {
    setValue('email', cred.email);
    setValue('password', cred.pwd);
    setRole(cred.role.toLowerCase() as RoleId);
    setShowDemo(false);
    toast.success(`Filled ${cred.role} credentials`);
  };

  // const handleGoogle = async () => {
  //   if (!GCID) { toast.error('Google Sign-In not configured. Add VITE_GOOGLE_CLIENT_ID to .env'); return; }
  //   setGLoad(true);
  //   try {
  //     (window as any).google?.accounts?.oauth2?.initTokenClient({
  //       client_id: GCID, scope: 'email profile',
  //       callback: async (resp: any) => {
  //         try {
  //           const info = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${resp.access_token}`).then(r => r.json());
  //           const res  = await fetch('/api/v1/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ googleId: info.sub, email: info.email, name: info.name }) }).then(r => r.json());
  //           if (res.success) { localStorage.setItem('ems_token', res.token); localStorage.setItem('ems_user', JSON.stringify(res.user)); window.location.href = `/${res.user.role}/dashboard`; }
  //           else toast.error(res.message || 'Google sign-in failed.');
  //         } catch { toast.error('Google sign-in failed.'); }
  //         setGLoad(false);
  //       },
  //     })?.requestAccessToken();
  //   } catch { toast.error('Google sign-in failed.'); setGLoad(false); }
  // };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden relative transition-colors duration-300">
      {/* Animated blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[500px] h-[500px] bg-indigo-400/20 dark:bg-indigo-700/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -left-32 w-[450px] h-[450px] bg-emerald-400/20 dark:bg-emerald-700/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 text-xs font-medium transition-all">
        {isDark
          ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>Light</>
          : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>Dark</>}
      </button>

      {/* ── Left hero panel (desktop) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] flex-shrink-0 relative z-10 p-10 border-r border-gray-200 dark:border-white/[0.07] bg-white dark:bg-transparent">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${sel.bg} flex items-center justify-center text-white font-black text-xl shadow-xl transition-colors duration-300`}>Z</div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">ZetaQ EMS</p>
            <p className="text-gray-400 dark:text-gray-600 text-[11px]">Employee Management System</p>
          </div>
        </div>
        {/* Features */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Manage your workforce<br/>with confidence.</h2>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Track attendance, tasks, leave, payroll and performance — all in one place.</p>
          </div>
          <div className="space-y-3">
            {[
              { icon: '📊', label: 'Real-time analytics & reports' },
              { icon: '🗓️', label: 'Leave & attendance management' },
              { icon: '✅', label: 'Task tracker with deadlines' },
              { icon: '💰', label: 'Automated payroll processing' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-lg w-8">{f.icon}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{f.label}</span>
              </div>
            ))}
          </div>
          {/* Role badges */}
          <div className="flex gap-2 flex-wrap">
            {ROLES.map(r => (
              <span key={r.id} className={`text-xs px-3 py-1 rounded-full font-medium ${r.lbg} ${r.ltext} dark:bg-white/[0.07] dark:text-gray-400`}>{r.label}</span>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-gray-400">© {new Date().getFullYear()} ZetaQ Technologies. All rights reserved.</p>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 relative z-10 py-12">
        {/* Mobile brand */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className={`w-9 h-9 rounded-xl ${sel.bg} flex items-center justify-center text-white font-black text-lg shadow-lg transition-colors`}>Z</div>
          <span className="font-bold text-gray-900 dark:text-white text-base">ZetaQ EMS</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your portal</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)}
                className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all duration-200 ${role === r.id ? `${r.selBorder} ${r.selBg} shadow-sm` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'}`}>
                <div className={`w-8 h-8 rounded-lg ${role === r.id ? r.bg : 'bg-gray-100 dark:bg-gray-700'} flex items-center justify-center text-sm font-bold transition-colors ${role === r.id ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>{r.ab}</div>
                <span className={`text-xs font-semibold transition-colors ${role === r.id ? `${r.ltext} dark:text-white` : 'text-gray-500 dark:text-gray-400'}`}>{r.label}</span>
                <span className={`text-[10px] transition-colors ${role === r.id ? `${r.ltext} dark:text-gray-400` : 'text-gray-400 dark:text-gray-600'}`}>{r.desc}</span>
                {role === r.id && <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${r.bg}`} />}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-none p-6 backdrop-blur-sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email or Employee ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Email or Employee ID</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <input type="text" placeholder="you@company.com or EMP031" autoComplete="username"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${errors.email ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-400/20'}`}
                    {...register('email', { required: 'Email or Employee ID required' })} />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">⚠ {errors.email.message}</p>}
              </div>
              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Password</label>
                  <Link to="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <input type={showPwd ? 'text' : 'password'} placeholder="Your password" autoComplete="current-password"
                    className={`w-full pl-10 pr-14 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${errors.password ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-400/20'}`}
                    {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showPwd ? 'Hide' : 'Show'}</button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">⚠ {errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading}
                className={`w-full py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 ${sel.bg}`}>
                {loading ? <><Spinner size="sm" /> Signing in...</> : `Sign in as ${sel.label}`}
              </button>
            </form>

            {/* Google Sign-In temporarily disabled — re-enable by uncommenting this block + handleGoogle + GCID above.
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              <span className="text-[11px] text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>

            <button type="button" onClick={handleGoogle} disabled={gLoad}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-300 transition-all shadow-sm disabled:opacity-50">
              {gLoad ? <Spinner size="sm" /> : (
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
              )}
              Continue with Google
            </button>
            */}
          </div>

          {/* Demo credentials */}
          <div className="mt-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden">
            <button onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <span>🔑 Test credentials (demo)</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showDemo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showDemo && (
              <div className="bg-gray-50 dark:bg-gray-800/40">
                {/* Admin & Employee */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
                  {DEMO_CREDS.map(c => (
                    <button key={c.email} onClick={() => fillDemo(c)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left group">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${c.color}`}>{c.role}</p>
                          {c.tag && <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded font-mono">{c.tag}</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{c.email} · {c.pwd}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">Fill →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Don't have login details? Contact your administrator to get an account set up.
          </p>
        </div>
      </div>
    </div>
  );
}
