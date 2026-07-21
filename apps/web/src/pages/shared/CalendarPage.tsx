import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useGetEventsQuery, useCreateEventMutation, useDeleteEventMutation, type ApiCalendarEvent } from '../../store/api/calendarApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog';

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2023 + 2 }, (_, i) => 2023 + i);
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type EventType = 'holiday' | 'meeting' | 'reminder' | 'deadline' | 'company_event' | 'birthday';
type VisibleTo = 'all' | 'admin' | 'manager' | 'employee';
type CalEvent = { id: string; title: string; type: EventType; date: string; endDate: string; visibleTo: VisibleTo; description: string };

const ET_BG: Record<EventType, string> = {
  holiday: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reminder: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  deadline: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  company_event: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  birthday: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};
const ET_ICON: Record<EventType, string> = { holiday: '🏖️', meeting: '📅', reminder: '🔔', deadline: '⏰', company_event: '🎉', birthday: '🎂' };
const initForm = { title: '', type: 'meeting' as EventType, date: '', endDate: '', visibleTo: 'all' as VisibleTo, description: '' };

function mapEvent(e: ApiCalendarEvent): CalEvent {
  return { id: e._id, title: e.title, type: e.type || 'meeting', date: e.startDate?.slice(0, 10) || '', endDate: e.endDate?.slice(0, 10) || e.startDate?.slice(0, 10) || '', visibleTo: e.visibleTo || 'all', description: e.description || '' };
}

export default function CalendarPage() {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(initForm);
  const [viewEvt, setViewEvt] = useState<CalEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: apiEvents = [] } = useGetEventsQuery();
  const [createEvent] = useCreateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const events = useMemo(() => apiEvents.map(mapEvent), [apiEvents]);

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthEvents = events.filter((e) => { const d = new Date(e.date); return d.getFullYear() === calYear && d.getMonth() === calMonth; }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate());
  const dayEvents = (day: number) => events.filter((e) => { const d = new Date(e.date); return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day; });
  const isToday = (day: number) => day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

  const openAdd = (day?: number) => {
    const dateStr = day ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
    setForm({ ...initForm, date: dateStr, endDate: dateStr });
    setModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.date) { toast.error('Title and date are required'); return; }
    try {
      await createEvent({ title: form.title, type: form.type, startDate: form.date, endDate: form.endDate || form.date, description: form.description, visibleTo: form.visibleTo }).unwrap();
      toast.success('Event added!');
      setModal(false); setForm(initForm);
    } catch { toast.error('Failed to add event'); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await deleteEvent(deleteId).unwrap(); toast.success('Event removed'); } catch { toast.error('Failed to delete'); }
    setDeleteId(null); setViewEvt(null);
  };

  const prevMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <Select value={String(calMonth)} onValueChange={(v: string) => setCalMonth(Number(v))}>
              <SelectTrigger className="border-0 shadow-none w-32 text-sm font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_FULL.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(calYear)} onValueChange={(v: string) => setCalYear(Number(v))}>
              <SelectTrigger className="border-0 shadow-none w-20 text-sm font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); }}>Today</Button>
            <span className="text-xs text-gray-400 ml-1">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</span>
          </div>
          <Button size="sm" onClick={() => openAdd()}><Plus className="w-3.5 h-3.5" /> Add Event</Button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">{DAYS_LABEL.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-16 sm:h-20" />;
              const de = dayEvents(day);
              const isTd = isToday(day);
              return (
                <div key={day} onClick={() => openAdd(day)} className={`h-16 sm:h-20 rounded-xl p-1.5 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 border ${isTd ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700'}`}>
                  <span className={`text-xs font-semibold block text-center w-5 h-5 rounded-full flex items-center justify-center mx-auto mb-1 ${isTd ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>{day}</span>
                  <div className="space-y-0.5 overflow-hidden">
                    {de.slice(0, 2).map((e) => <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setViewEvt(e); }} className={`text-[9px] px-1 py-0.5 rounded font-medium truncate leading-tight ${ET_BG[e.type]}`}>{e.title}</div>)}
                    {de.length > 2 && <div className="text-[9px] text-gray-400 px-1">+{de.length - 2} more</div>}
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
          <p className="text-xs text-gray-400 mt-0.5">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''} this month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>{['Date', 'Event', 'Type', 'Visible To', 'Description', 'Action'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {monthEvents.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2"><span className="text-3xl">📅</span><p className="text-sm font-medium text-gray-500 dark:text-gray-400">No events in {MONTHS_FULL[calMonth]} {calYear}</p><p className="text-xs text-gray-400">Click on a day in the calendar or use "Add Event" to create one</p></div></td></tr>
              ) : monthEvents.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{e.date}{e.endDate && e.endDate !== e.date ? ` – ${e.endDate}` : ''}</td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="text-base">{ET_ICON[e.type]}</span><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.title}</span></div></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${ET_BG[e.type]}`}>{e.type.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium capitalize whitespace-nowrap">{e.visibleTo}</span></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[220px] truncate" title={e.description}>{e.description}</td>
                  <td className="px-4 py-2.5"><Button size="sm" variant="secondary" className="h-auto py-0.5 text-[10px] bg-red-50 text-red-500" onClick={() => setDeleteId(e.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <DialogBody>
            <div><Label>Event Title *</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Team Meeting, Holiday…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date *</Label><Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, endDate: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input className="mt-1" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Event Type</Label>
                <Select value={form.type} onValueChange={(v: string) => setForm((p) => ({ ...p, type: v as EventType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{(['meeting', 'holiday', 'reminder', 'deadline', 'company_event', 'birthday'] as EventType[]).map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visible To</Label>
                <Select value={form.visibleTo} onValueChange={(v: string) => setForm((p) => ({ ...p, visibleTo: v as VisibleTo }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="admin">Admin Only</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="employee">Employee</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional event details…" /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>Add Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewEvt} onOpenChange={(o: boolean) => !o && setViewEvt(null)}>
        <DialogContent className="max-w-sm">
          {viewEvt && (
            <>
              <DialogHeader><DialogTitle>{ET_ICON[viewEvt.type]} {viewEvt.title}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"><p className="text-[10px] text-gray-400">Date</p><p className="font-semibold text-gray-700 dark:text-gray-300">{viewEvt.date}{viewEvt.endDate && viewEvt.endDate !== viewEvt.date ? ` – ${viewEvt.endDate}` : ''}</p></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"><p className="text-[10px] text-gray-400">Type</p><p className="font-semibold text-gray-700 dark:text-gray-300 capitalize">{viewEvt.type.replace('_', ' ')}</p></div>
                </div>
                {viewEvt.description && <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">{viewEvt.description}</p>}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" className="flex-1" onClick={() => setViewEvt(null)}>Close</Button>
                <Button variant="secondary" className="bg-red-50 text-red-500" onClick={() => setDeleteId(viewEvt.id)}>Delete</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="text-4xl">🗑️</span>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>This event will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
