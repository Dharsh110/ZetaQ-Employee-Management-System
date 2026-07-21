import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: { text: string; className?: string };
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Search…', emptyOptionLabel = '— None —', className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(''); }}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={cn('truncate text-left', !selected && 'text-gray-400')}>
          {selected ? selected.label : emptyOptionLabel}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-border dark:border-gray-700">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full h-8 rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="flex w-full items-center px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              {emptyOptionLabel}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    o.value === value && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-gray-800 dark:text-gray-200 font-medium">{o.label}</span>
                    {o.sublabel && <span className="block truncate text-[10px] text-gray-400">{o.sublabel}</span>}
                  </span>
                  {o.badge && (
                    <span className={cn('flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold', o.badge.className)}>
                      {o.badge.text}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
