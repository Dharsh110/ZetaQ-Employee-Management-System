import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Input, Spinner } from '../../components/ui/index';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ResetForm { password: string; confirm: string; }

const checks = [
  { key: 'len', label: '8+ characters', test: (v: string) => v.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'num', label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { key: 'sym', label: 'Symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>();
  const pwd = watch('password', '');
  const score = checks.filter((c) => c.test(pwd)).length;
  const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-amber-400', 'bg-green-500'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const onSubmit = async (data: ResetForm) => {
    if (!token) return;
    setLoading(true);
    try {
      await resetPassword(token, data.password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card p-8 w-full max-w-sm text-center animation-fade-in">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">Password updated!</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to sign in...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm animation-fade-in">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">ZetaQ EMS</span>
        </div>

        <div className="card p-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-400 flex items-center gap-2 mb-4">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
            Reset link verified — set your new password
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Reset password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Enter and confirm your new password below.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                label="New password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                error={errors.password?.message}
                rightElement={<button type="button" onClick={() => setShowPwd(!showPwd)} className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>}
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
              />
              {pwd && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1.5">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={clsx('flex-1 h-1 rounded-full transition-colors', i <= score ? strengthColors[score] : 'bg-gray-200 dark:bg-gray-600')} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {checks.map((c) => (
                      <span key={c.key} className={clsx('text-xs px-2 py-0.5 rounded-full', c.test(pwd) ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>
                        {c.test(pwd) ? '✓ ' : ''}{c.label}
                      </span>
                    ))}
                    {score > 0 && <span className={clsx('text-xs font-medium', score >= 3 ? 'text-green-600' : score === 2 ? 'text-amber-500' : 'text-red-500')}>{strengthLabels[score]}</span>}
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Confirm new password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Re-enter password"
              error={errors.confirm?.message}
              {...register('confirm', {
                required: 'Please confirm your password',
                validate: (v) => v === pwd || 'Passwords do not match',
              })}
            />

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <><Spinner size="sm" />Updating...</> : 'Update password'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            <Link to="/login" className="text-brand-600 hover:underline">← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
