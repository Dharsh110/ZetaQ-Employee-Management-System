import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Spinner } from '../../components/ui/index';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const { forgotPassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async ({ email }: { email: string }) => {
    setLoading(true);
    try {
      const { devResetUrl: devUrl } = await forgotPassword(email);
      setDevResetUrl(devUrl || null);
      setSentEmail(email);
      setSent(true);
    } catch {
      // Still show success — don't reveal if email exists (security best practice)
      setDevResetUrl(null);
      setSentEmail(email);
      setSent(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 relative transition-colors duration-300">
      {/* Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[400px] h-[400px] bg-amber-400/15 dark:bg-amber-700/15 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-[350px] h-[350px] bg-blue-400/15 dark:bg-blue-700/10 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <button onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 text-xs font-medium transition-all">
        {isDark ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div className="w-full max-w-sm relative z-10 animation-fade-in">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">ZetaQ EMS</span>
        </div>

        {!sent ? (
          <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-none p-6 backdrop-blur-sm">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Forgot your password?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Enter your registered email and we'll send a password reset link.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Email address</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <input type="email" placeholder="you@company.com"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${errors.email ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-400/20'}`}
                    {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email address' } })} />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">⚠ {errors.email.message}</p>}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
                💡 The reset link expires in 30 minutes. Check your spam folder if you don't see it.
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><Spinner size="sm"/>Sending...</> : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline">← Back to sign in</Link>
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-none p-6 text-center animation-fade-in backdrop-blur-sm">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Check your inbox!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              We've sent a reset link to <strong className="text-gray-700 dark:text-gray-200">{sentEmail}</strong>
            </p>
            {devResetUrl && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-left mb-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠ Dev mode — email service isn't configured</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">No SMTP credentials are set on the server, so no real email was sent. Use this link directly to reset your password:</p>
                <Link to={devResetUrl.replace(/^.*\/reset-password/, '/reset-password')} className="block text-xs text-brand-600 dark:text-brand-400 hover:underline break-all font-mono bg-white dark:bg-gray-800 rounded-lg px-2 py-1.5">
                  {devResetUrl}
                </Link>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-left mb-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Didn't receive it?</p>
              {['Check your spam or junk folder', 'Make sure the email address is correct', 'Wait a minute then try again'].map(tip => (
                <div key={tip} className="flex items-center gap-2">
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{tip}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <button onClick={() => setSent(false)} className="w-full py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Resend email</button>
              <Link to="/login" className="block w-full py-2 rounded-xl text-sm text-center text-brand-600 dark:text-brand-400 hover:underline">← Back to sign in</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
