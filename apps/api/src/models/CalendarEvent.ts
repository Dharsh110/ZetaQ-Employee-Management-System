import mongoose, { Document, Schema } from 'mongoose';

export interface ICalendarEvent extends Document {
  title: string;
  description?: string;
  type: 'holiday' | 'meeting' | 'reminder' | 'deadline' | 'company_event' | 'birthday';
  startDate: Date;
  endDate?: Date;
  location?: string;
  visibleTo: 'all' | 'admin' | 'manager' | 'employee' | 'team';
  createdBy: mongoose.Types.ObjectId;
  reminderSent?: boolean;
  isPersonal?: boolean;
  createdAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ['holiday', 'meeting', 'reminder', 'deadline', 'company_event', 'birthday'],
      default: 'company_event',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, trim: true },
    visibleTo: {
      type: String,
      enum: ['all', 'admin', 'manager', 'employee', 'team'],
      default: 'all',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reminderSent: { type: Boolean, default: false },
    // True for an employee's own personal calendar entry — scopes visibility/reminders
    // to just that employee instead of broadcasting to every user with role 'employee'.
    isPersonal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CalendarEventSchema.index({ startDate: 1 });
CalendarEventSchema.index({ visibleTo: 1 });

export default mongoose.model<ICalendarEvent>('CalendarEvent', CalendarEventSchema);
