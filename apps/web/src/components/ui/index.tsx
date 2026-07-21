import React from 'react';
import clsx from 'clsx';

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
];

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
interface AvatarProps { name: string; src?: string; size?: AvatarSize; className?: string; }
export const Avatar: React.FC<AvatarProps> = ({ name = '?', src, size = 'md', className }) => {
  const safe   = name || '?';
  const initials = safe.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const color  = AVATAR_COLORS[(safe.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const sizes: Record<AvatarSize, string> = {
    xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',     lg: 'w-11 h-11 text-base', xl: 'w-14 h-14 text-lg',
  };
  if (src) return <img src={src} alt={safe} className={clsx('rounded-full object-cover', sizes[size], className)} />;
  return (
    <div className={clsx('avatar flex-shrink-0 flex items-center justify-center rounded-full font-semibold select-none', sizes[size], color, className)}>
      {initials}
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
// Accepts both old variants (error, default) and new ones (danger, gray)
type BadgeVariant = 'success' | 'warning' | 'danger' | 'error' | 'info' | 'purple' | 'gray' | 'default';
interface BadgeProps { variant?: BadgeVariant; children: React.ReactNode; className?: string; dot?: boolean; }
const BADGE_CLS: Record<BadgeVariant, string> = {
  success: 'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-400',
  warning: 'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400',
  danger:  'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400',
  error:   'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400',
  info:    'bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400',
  purple:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  gray:    'bg-gray-100   dark:bg-gray-700      text-gray-700   dark:text-gray-300',
  default: 'bg-gray-100   dark:bg-gray-700      text-gray-700   dark:text-gray-300',
};
export const Badge: React.FC<BadgeProps> = ({ variant = 'gray', children, className, dot }) => (
  <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', BADGE_CLS[variant], className)}>
    {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', {
      'bg-green-500': variant === 'success', 'bg-amber-500': variant === 'warning',
      'bg-red-500': variant === 'danger' || variant === 'error',
      'bg-blue-500': variant === 'info',
    })} />}
    {children}
  </span>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <svg className={clsx('animate-spin text-brand-600', s[size], className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; className?: string; padding?: boolean; }
export const Card: React.FC<CardProps> = ({ children, className, padding = true }) => (
  <div className={clsx('card', padding && 'p-4 sm:p-5', className)}>{children}</div>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string | number; sub?: string; subColor?: string;
  icon?: React.ReactNode; accentClass?: string;
}
export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, subColor, icon, accentClass }) => (
  <div className={clsx('card p-4', accentClass)}>
    <div className="flex items-start justify-between">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
    {sub && <p className={clsx('text-xs mt-1 font-medium', subColor || 'text-gray-400 dark:text-gray-500')}>{sub}</p>}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
// Accepts BOTH `open` and `isOpen` for backward compatibility
interface ModalProps {
  open?: boolean;
  isOpen?: boolean;     // alias
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
export const Modal: React.FC<ModalProps> = ({ open, isOpen, onClose, title, children, size = 'md' }) => {
  const visible = open ?? isOpen ?? false;
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (visible) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  if (!visible) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animation-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto', widths[size])}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; icon?: React.ReactNode; rightElement?: React.ReactNode;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, rightElement, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</div>}
        <input
          ref={ref}
          className={clsx(
            'input text-sm',
            icon && 'pl-9',
            rightElement && 'pr-10',
            error ? 'border-red-400 focus:ring-red-400' : '',
            className
          )}
          {...props}
        />
        {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><span>⚠</span>{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// ─── Select (native) ──────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; options: { value: string; label: string }[];
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
      <select ref={ref} className={clsx('input text-sm', error && 'border-red-400 focus:ring-red-400', className)} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';

// ─── Empty State ──────────────────────────────────────────────────────────────
// Accepts BOTH `title` and `message` props for backward compatibility
interface EmptyProps {
  title?: string;
  message?: string;      // alias
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}
export const Empty: React.FC<EmptyProps> = ({ title, message, description, action, icon }) => {
  const heading = title || message || 'No data found';
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4 text-gray-400">
        {icon || (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{heading}</p>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; className?: string }> = ({
  value, max = 100, color = 'bg-brand-600', className,
}) => (
  <div className={clsx('w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5', className)}>
    <div className={clsx('h-1.5 rounded-full transition-all duration-500', color)}
      style={{ width: `${Math.min(Math.max((value / max) * 100, 0), 100)}%` }} />
  </div>
);

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string; }
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, rows = 3, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
      <textarea ref={ref} rows={rows}
        className={clsx('input resize-none text-sm', error && 'border-red-400 focus:ring-red-400', className)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

// ─── Table wrapper ────────────────────────────────────────────────────────────
export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('overflow-x-auto', className)}>
    <table className="table w-full">{children}</table>
  </div>
);
