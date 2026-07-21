import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useGetEventsQuery, useCreateEventMutation, useDeleteEventMutation } from '../../store/api/calendarApi';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 1 }, (_, i) => 2023 + i);
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type EventType = 'holiday' | 'meeting' | 'reminder' | 'deadline' | 'company_event' | 'birthday';

const ET_BG: Record<EventType, string> = {
  holiday: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  meeting: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  reminder: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  deadline: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  company_event: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  birthday: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
};
const ET_ICON: Record<EventType, string> = { holiday: '🏖️', meeting: '📅', reminder: '🔔', deadline: '⏰', company_event: '🎉', birthday: '🎂' };

const BLANK_EVENT = { title: '', type: 'meeting' as EventType, date: '', endDate: '', description: '' };

export default function EmployeeCalendar() {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const { data: apiEvents } = useGetEventsQuery();
  const [createEvent] = useCreateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();

  const userEvents = (apiEvents || []).map((e) => ({
    id: e._id, title: e.title, type: (e.type as EventType) || 'meeting',
    date: e.startDate?.slice(0, 10) || '', endDate: e.endDate?.slice(0, 10) || e.startDate?.slice(0, 10) || '',
    description: e.description || '',
  }));

  const [addModal, setAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState(BLANK_EVENT);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthEvents = userEvents.filter((e) => { const d = new Date(e.date); return d.getFullYear() === calYear && d.getMonth() === calMonth; }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate());
  const dayEvents = (day: number) => userEvents.filter((e) => { const d = new Date(e.date); return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day; });

  const addEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) { toast.error('Title and date are required'); return; }
    try {
      await createEvent({ title: newEvent.title, type: newEvent.type, startDate: newEvent.date, endDate: newEvent.endDate || newEvent.date, description: newEvent.description, visibleTo: 'employee' }).unwrap();
      toast.success('Event added to your calendar!');
    } catch { toast.error('Failed to add event'); }
    setAddModal(false);
    setNewEvent(BLANK_EVENT);
  };

  const deleteUserEvent = async (id: string) => {
    try { await deleteEvent(id).unwrap(); toast.success('Event removed'); }
    catch { toast.error('Failed to remove event'); }
    setDeleteConfirmId(null);
  };

  const isToday = (day: number) => day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
  const prevMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={prevMonth}>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Button>
            <Select value={String(calMonth)} onValueChange={(v: string) => setCalMonth(+v)}>
              <SelectTrigger className="w-32 h-8 text-sm border-0 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_FULL.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(calYear)} onValueChange={(v: string) => setCalYear(+v)}>
              <SelectTrigger className="w-20 h-8 text-sm border-0 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={nextMonth}>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Button>
            <span className="text-xs text-gray-400 ml-1">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</span>
          </div>
          <Button size="sm" className="rounded-xl" onClick={() => setAddModal(true)}>+ Add Event</Button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">{DAYS_LABEL.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="h-14 sm:h-16" />;
              const de = dayEvents(day);
              const isTd = isToday(day);
              return (
                <div key={day} className={`h-14 sm:h-16 rounded-xl p-1 border ${isTd ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700'} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                  <span className={`text-xs font-semibold block text-center w-5 h-5 rounded-full flex items-center justify-center mx-auto mb-0.5 ${isTd ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>{day}</span>
                  <div className="space-y-0.5 overflow-hidden">
                    {de.slice(0, 1).map((e) => <div key={e.id} className={`text-[9px] px-1 py-0.5 rounded font-medium truncate leading-tight ${ET_BG[e.type]}`}>{e.title}</div>)}
                    {de.length > 1 && <div className="text-[9px] text-gray-400 px-1">+{de.length - 1} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Events in {MONTHS_FULL[calMonth]} {calYear}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {monthEvents.length === 0 ? (
            <div className="px-4 py-12 text-center"><span className="text-3xl">📅</span><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No events in {MONTHS_FULL[calMonth]} {calYear}</p></div>
          ) : monthEvents.map((e) => (
            <div key={e.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${ET_BG[e.type]}`}>{ET_ICON[e.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{e.title}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge className={`capitalize ${ET_BG[e.type]}`}>{e.type.replace('_', ' ')}</Badge>
                    <button onClick={() => setDeleteConfirmId(e.id)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">📅 {e.date}{e.endDate && e.endDate !== e.date ? ` – ${e.endDate}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Calendar Event</DialogTitle></DialogHeader>
          <div className="p-5 space-y-3">
            <div><Label className="mb-1 block">Title <span className="text-red-500">*</span></Label><Input value={newEvent.title} placeholder="Event title…" onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} /></div>
            <div>
              <Label className="mb-1 block">Event Type</Label>
              <Select value={newEvent.type} onValueChange={(v: string) => setNewEvent((p) => ({ ...p, type: v as EventType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(['meeting', 'reminder', 'deadline', 'company_event', 'holiday', 'birthday'] as EventType[]).map((t) => <SelectItem key={t} value={t} className="capitalize">{ET_ICON[t]} {t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1 block">Start Date <span className="text-red-500">*</span></Label><Input type="date" value={newEvent.date} onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))} /></div>
              <div><Label className="mb-1 block">End Date</Label><Input type="date" value={newEvent.endDate} onChange={(e) => setNewEvent((p) => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div><Label className="mb-1 block">Description</Label><Textarea rows={2} value={newEvent.description} placeholder="Optional description…" onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl" onClick={addEvent}>Add Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o: boolean) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><span className="text-4xl">🗑️</span><AlertDialogTitle>Remove Event?</AlertDialogTitle><AlertDialogDescription>This event will be removed from your calendar.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteConfirmId && deleteUserEvent(deleteConfirmId)}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
