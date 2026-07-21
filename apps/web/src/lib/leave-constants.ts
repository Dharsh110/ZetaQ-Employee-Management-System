// Shared leave-type display/limit metadata — used by both the employee and
// manager "apply for leave" experiences so they stay visually identical.
export const LEAVE_LIMITS: Record<string, number> = { 'Casual Leave': 10, 'Sick Leave': 6, 'Earned Leave': 15, 'Maternity Leave': 90, 'Paternity Leave': 15, 'Emergency': 2, 'Compensatory Leave': 3 };
export const LEAVE_ICONS: Record<string, string> = { 'Casual Leave': '☀️', 'Sick Leave': '🤒', 'Earned Leave': '🏖️', 'Maternity Leave': '👶', 'Paternity Leave': '👨‍👧', 'Emergency': '🚨', 'Compensatory Leave': '⏰' };
export const LEAVE_COLORS: Record<string, { color: string; bg: string; txt: string }> = {
  'Casual Leave': { color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', txt: 'text-blue-600 dark:text-blue-400' },
  'Sick Leave': { color: 'from-red-500 to-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', txt: 'text-red-500 dark:text-red-400' },
  'Earned Leave': { color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', txt: 'text-emerald-600 dark:text-emerald-400' },
  'Compensatory Leave': { color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800', txt: 'text-teal-600 dark:text-teal-400' },
  'Emergency': { color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', txt: 'text-amber-600 dark:text-amber-400' },
  'Maternity Leave': { color: 'from-pink-500 to-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800', txt: 'text-pink-600 dark:text-pink-400' },
  'Paternity Leave': { color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', txt: 'text-indigo-600 dark:text-indigo-400' },
};

export interface LeaveBalanceRow { type: string; total: number; used: number; icon: string; color: string; bg: string; txt: string }

export function computeLeaveBalance(leaves: { type: string; days: number; status: string }[]): LeaveBalanceRow[] {
  return Object.entries(LEAVE_LIMITS).map(([type, total]) => {
    const used = leaves.filter((l) => l.type === type && (l.status === 'approved' || l.status === 'pending')).reduce((s, l) => s + l.days, 0);
    const clrs = LEAVE_COLORS[type] || { color: 'from-gray-500 to-gray-600', bg: 'bg-gray-50 dark:bg-gray-700', txt: 'text-gray-600' };
    return { type, total, used: Math.min(used, total), icon: LEAVE_ICONS[type] || '📅', ...clrs };
  });
}
