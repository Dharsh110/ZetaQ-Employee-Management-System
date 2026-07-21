import { Router } from 'express';
import { protect } from '../middleware/auth';
import CalendarEvent from '../models/CalendarEvent';
import User from '../models/User';
import { createNotification } from '../controllers/notificationController';

const router = Router();
router.use(protect);

// GET /api/v1/calendar?year=2025&month=6
router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter: any = {};
    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      filter.$or = [
        { startDate: { $gte: start, $lte: end } },
        { endDate: { $gte: start, $lte: end } },
        { startDate: { $lte: start }, endDate: { $gte: end } },
      ];
    }
    // Filter by role visibility
    const role = (req as any).user?.role;
    const userId = (req as any).user?._id;
    const visFilter = filter.$or ? [
      ...filter.$or.map((f: any) => ({ ...f, visibleTo: { $in: [role, 'all'] } })),
    ] : [{ visibleTo: { $in: [role, 'all'] } }];
    delete filter.$or;
    // Personal entries (an employee's own calendar note) are only visible to their creator,
    // even though they share the 'employee' visibleTo value with admin/manager broadcasts.
    filter.$and = [{ $or: visFilter }, { $or: [{ isPersonal: { $ne: true } }, { createdBy: userId }] }];

    const events = await CalendarEvent.find(filter).sort({ startDate: 1 });
    res.json({ success: true, data: events });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/v1/calendar
router.post('/', async (req, res) => {
  try {
    const creatorRole = (req as any).user.role;
    const isPersonal = creatorRole === 'employee' && req.body.visibleTo === 'employee';
    const event = await CalendarEvent.create({ ...req.body, createdBy: (req as any).user._id, isPersonal });

    if (!isPersonal) {
      try {
        const creatorId = (req as any).user._id.toString();
        const recipients = event.visibleTo === 'all'
          ? await User.find({}).select('_id role')
          : await User.find({ role: event.visibleTo }).select('_id role');
        for (const u of recipients) {
          if (u._id.toString() === creatorId) continue;
          await createNotification(
            u._id.toString(), u.role, 'calendar',
            'New calendar event', `"${event.title}" was added to the calendar for ${event.startDate.toISOString().slice(0, 10)}.`,
            `/${u.role}/calendar`
          );
        }
      } catch { /* notification failure should not block event creation */ }
    }

    res.status(201).json({ success: true, data: event });
  } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
});

// PUT /api/v1/calendar/:id
router.put('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }
    res.json({ success: true, data: event });
  } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
});

// DELETE /api/v1/calendar/:id
router.delete('/:id', async (req, res) => {
  try {
    await CalendarEvent.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
