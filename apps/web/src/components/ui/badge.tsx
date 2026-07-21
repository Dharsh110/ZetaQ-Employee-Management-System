import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        destructive: 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400',
        outline: 'text-gray-600 dark:text-gray-300 border border-border dark:border-gray-600',
        gray: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
