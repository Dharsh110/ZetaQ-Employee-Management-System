import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  useGetMyTimesheetsQuery, useSaveTimesheetDraftMutation, useSubmitTimesheetMutation,
  useResubmitTimesheetMutation, type ApiTimesheet, type ApiTimesheetEntry, type TimesheetStatus,
} from '../../store/api/timesheetsApi';

const todayStr = new Date().toISOString().slice(0, 10);

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: 'Draft', pending_approval: 'Pending Approval', approved: 'Approved', rejected: 'Rejected',
};
const STATUS_CLR: Record<TimesheetStatus, string> = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  pending_approval: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
};

type EditableEntry = ApiTimesheetEntry & { key: string };
const blankEntry = (): EditableEntry => ({ key: Date.now().toString() + Math.random().toString(36).slice(2), task: '', description: '', timeSpentMinutes: 60, remarks: '' });

const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();

export default function EmployeeTimesheet() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const { data: timesheets = [], isLoading } = useGetMyTimesheetsQuery();
  const [saveDraft, { isLoading: saving }] = useSaveTimesheetDraftMutation();
  const [submit, { isLoading: submitting }] = useSubmitTimesheetMutation();
  const [resubmit, { isLoading: resubmitting }] = useResubmitTimesheetMutation();

  const current = useMemo(() => timesheets.find((t) => t.date.slice(0, 10) === selectedDate) || null, [timesheets, selectedDate]);
  const isEditable = !current || current.status === 'draft' || current.status === 'rejected';

  const [entries, setEntries] = useState<EditableEntry[] | null>(null);
  const [viewHistory, setViewHistory] = useState<ApiTimesheet | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayStr);
  const displayEntries: EditableEntry[] = entries ?? (current?.entries.map((e) => ({ ...e, key: e.task + Math.random() })) ?? [blankEntry()]);

  const loadForDate = (date: string) => {
    setSelectedDate(date);
    setEntries(null); // fall back to derived displayEntries for the new date
  };

  const updateEntry = (key: string, patch: Partial<ApiTimesheetEntry>) => {
    setEntries(displayEntries.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };
  const addEntry = () => setEntries([...displayEntries, blankEntry()]);
  const removeEntry = (key: string) => setEntries(displayEntries.length > 1 ? displayEntries.filter((e) => e.key !== key) : displayEntries);

  const validEntries = () => displayEntries.filter((e) => e.task.trim() && e.timeSpentMinutes > 0).map(({ key, ...rest }) => rest);

  const doSaveDraft = async () => {
    const valid = validEntries();
    if (!valid.length) { toast.error('Add at least one task with a task name and time spent'); return; }
    try {
      await saveDraft({ date: selectedDate, entries: valid }).unwrap();
      setEntries(null);
      toast.success('Draft saved');
    } catch (err: any) { toast.error(err?.data?.message || 'Failed to save draft'); }
  };

  const doSubmit = async () => {
    const valid = validEntries();
    if (!valid.length) { toast.error('Add at least one task with a task name and time spent'); return; }
    try {
      await saveDraft({ date: selectedDate, entries: valid }).unwrap();
      const saved = timesheets.find((t) => t.date.slice(0, 10) === selectedDate);
      const id = current?._id || saved?._id;
      if (!id) { toast.error('Save the draft first'); return; }
      await submit(id).unwrap();
      setEntries(null);
      toast.success('Timesheet submitted for approval');
    } catch (err: any) { toast.error(err?.data?.message || 'Failed to submit timesheet'); }
  };

  const doResubmit = async () => {
    if (!current) return;
    const valid = validEntries();
    if (!valid.length) { toast.error('Add at least one task with a task name and time spent'); return; }
    try {
      await resubmit({ id: current._id, entries: valid }).unwrap();
      setEntries(null);
      toast.success('Timesheet resubmitted for approval');
    } catch (err: any) { toast.error(err?.data?.message || 'Failed to resubmit timesheet'); }
  };

  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const history = useMemo(() => [...timesheets].sort((a, b) => b.date.localeCompare(a.date)), [timesheets]);
  const filteredHistory = useMemo(
    () => history.filter((t) => (!histFrom || t.date.slice(0, 10) >= histFrom) && (!histTo || t.date.slice(0, 10) <= histTo)),
    [history, histFrom, histTo]
  );
  const totalMinutes = displayEntries.reduce((s, e) => s + (Number(e.timeSpentMinutes) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="relative z-10">
          <h2 className="text-sm font-bold">My Timesheet</h2>
          <p className="text-blue-100 text-xs mt-0.5">Log tasks for the day, submit for manager approval, and track your approved work hours</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Label className="mb-0">Date</Label>
            <Input type="date" value={selectedDate} max={todayStr} onChange={(e) => loadForDate(e.target.value)} className="w-40" />
            <Button type="button" variant="outline" size="sm" onClick={() => { setNewDate(todayStr); setNewModalOpen(true); }}>+ New Timesheet</Button>
          </div>
          {current && <Badge className={STATUS_CLR[current.status]}>{STATUS_LABEL[current.status]}</Badge>}
        </div>

        {current?.status === 'rejected' && current.rejectionReason && (
          <div className="mx-5 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">⚠ Rejected — reason from your manager:</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{current.rejectionReason}</p>
            <p className="text-[10px] text-red-400 mt-1">Edit the entries below and resubmit.</p>
          </div>
        )}

        <div className="p-5 space-y-3">
          {displayEntries.map((entry, i) => (
            <div key={entry.key} className="grid grid-cols-1 sm:grid-cols-[1.5fr_2fr_100px_1.5fr_auto] gap-2 items-start bg-gray-50/50 dark:bg-gray-700/20 border border-gray-100 dark:border-gray-700 rounded-xl p-3">
              <div>
                <Label className="text-[10px]">Task / Project *</Label>
                <Input disabled={!isEditable} value={entry.task} placeholder="e.g. Authentication Module" onChange={(e) => updateEntry(entry.key, { task: e.target.value })} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Description</Label>
                <Input disabled={!isEditable} value={entry.description || ''} placeholder="What did you work on?" onChange={(e) => updateEntry(entry.key, { description: e.target.value })} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Minutes *</Label>
                <Input disabled={!isEditable} type="number" min={1} step={15} value={entry.timeSpentMinutes} onChange={(e) => updateEntry(entry.key, { timeSpentMinutes: +e.target.value })} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Remarks (optional)</Label>
                <Input disabled={!isEditable} value={entry.remarks || ''} placeholder="Notes…" onChange={(e) => updateEntry(entry.key, { remarks: e.target.value })} className="mt-1 h-8 text-xs" />
              </div>
              {isEditable && (
                <button type="button" onClick={() => removeEntry(entry.key)} className="mt-5 text-red-400 hover:text-red-600 text-xs font-bold h-8" title="Remove entry">✕</button>
              )}
            </div>
          ))}

          {isEditable && (
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addEntry}>+ Add Task Entry</Button>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total: <span className="text-gray-800 dark:text-gray-200">{fmtMinutes(totalMinutes)}</span></p>
            {isEditable && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={saving} onClick={doSaveDraft}>{saving ? 'Saving…' : 'Save Draft'}</Button>
                {current?.status === 'rejected' ? (
                  <Button size="sm" disabled={resubmitting} onClick={doResubmit}>{resubmitting ? 'Resubmitting…' : 'Resubmit for Approval'}</Button>
                ) : (
                  <Button size="sm" disabled={submitting} onClick={doSubmit}>{submitting ? 'Submitting…' : 'Submit for Approval'}</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Timesheet History</h3>
            <p className="text-xs text-gray-400 mt-0.5">{filteredHistory.length} timesheet{filteredHistory.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="mb-0 text-[10px]">From</Label>
            <Input type="date" value={histFrom} max={histTo || todayStr} onChange={(e) => setHistFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <Label className="mb-0 text-[10px]">To</Label>
            <Input type="date" value={histTo} min={histFrom} max={todayStr} onChange={(e) => setHistTo(e.target.value)} className="h-8 w-36 text-xs" />
            {(histFrom || histTo) && <button onClick={() => { setHistFrom(''); setHistTo(''); }} className="text-[10px] text-blue-500 hover:underline">Clear</button>}
          </div>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>
        ) : filteredHistory.length === 0 ? (
          <div className="px-5 py-10 text-center"><span className="text-3xl">🗓️</span><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{history.length === 0 ? 'No timesheets yet' : 'No timesheets match this date range'}</p></div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filteredHistory.map((t) => (
              <button key={t._id} onClick={() => setViewHistory(t)} className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.date.slice(0, 10)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.entries.length} task{t.entries.length !== 1 ? 's' : ''} · {fmtMinutes(t.totalMinutes)}</p>
                </div>
                <Badge className={STATUS_CLR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating window with full details for the selected history entry */}
      <Dialog open={!!viewHistory} onOpenChange={(o: boolean) => !o && setViewHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewHistory?.date.slice(0, 10)}
              {viewHistory && <Badge className={STATUS_CLR[viewHistory.status]}>{STATUS_LABEL[viewHistory.status]}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {viewHistory && (
            <DialogBody>
              <div className="space-y-2">
                {viewHistory.entries.map((e, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Task / Project</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.task}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Time Spent</p>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmtMinutes(e.timeSpentMinutes)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Description</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">{e.description || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Remarks</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 italic">{e.remarks || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-3">Total: <span className="text-gray-800 dark:text-gray-200">{fmtMinutes(viewHistory.totalMinutes)}</span></p>
              {viewHistory.rejectionReason && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Rejection reason</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{viewHistory.rejectionReason}</p>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Audit Trail</p>
                <div className="space-y-1">
                  {viewHistory.auditTrail.map((a, i) => (
                    <p key={i} className="text-[10px] text-gray-400">
                      <span className="font-semibold text-gray-600 dark:text-gray-300 capitalize">{a.action}</span> — {new Date(a.at).toLocaleString('en-IN')}{a.note ? ` — ${a.note}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            {(viewHistory?.status === 'draft' || viewHistory?.status === 'rejected') && (
              <Button variant="outline" className="flex-1" onClick={() => { loadForDate(viewHistory.date.slice(0, 10)); setViewHistory(null); }}>Edit</Button>
            )}
            <Button className="flex-1" onClick={() => setViewHistory(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start a new timesheet for a chosen date */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Timesheet</DialogTitle></DialogHeader>
          <DialogBody>
            <Label className="mb-1 block">Date</Label>
            <Input type="date" value={newDate} max={todayStr} onChange={(e) => setNewDate(e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-2">
              {timesheets.some((t) => t.date.slice(0, 10) === newDate)
                ? "A timesheet already exists for this date — you'll be taken to it."
                : "This will open a blank timesheet for the selected date."}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setNewModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { loadForDate(newDate); setNewModalOpen(false); }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
