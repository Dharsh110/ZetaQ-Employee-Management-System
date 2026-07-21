import mongoose, { Document, Schema } from 'mongoose';

export type TimesheetStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface ITimesheetEntry {
  task: string;
  description?: string;
  timeSpentMinutes: number;
  remarks?: string;
}

export interface ITimesheetAuditEntry {
  action: 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'resubmitted';
  by: mongoose.Types.ObjectId;
  at: Date;
  note?: string;
}

export interface ITimesheet extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  date: Date;
  entries: ITimesheetEntry[];
  totalMinutes: number;
  status: TimesheetStatus;
  submittedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  auditTrail: ITimesheetAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Explicit sub-schema (not an inline object literal) — a field named `type` would
// otherwise be misread by Mongoose as the SchemaTypeOptions `type` key. No `type`
// field here, but keeping the same defensive pattern used by Task/DailyReport/CalendarEvent.
const TimesheetEntrySchema = new Schema<ITimesheetEntry>(
  {
    task: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    timeSpentMinutes: { type: Number, required: true, min: 1 },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const TimesheetAuditEntrySchema = new Schema<ITimesheetAuditEntry>(
  {
    action: { type: String, enum: ['created', 'updated', 'submitted', 'approved', 'rejected', 'resubmitted'], required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const TimesheetSchema = new Schema<ITimesheet>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    entries: [TimesheetEntrySchema],
    totalMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected'],
      default: 'draft',
    },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    auditTrail: [TimesheetAuditEntrySchema],
  },
  { timestamps: true }
);

TimesheetSchema.pre('save', function (next) {
  if (this.isModified('entries')) {
    this.totalMinutes = this.entries.reduce((sum, e) => sum + (e.timeSpentMinutes || 0), 0);
  }
  next();
});

// One timesheet per employee per day — multiple task entries live inside it (spec 3.1).
TimesheetSchema.index({ employee: 1, date: 1 }, { unique: true });
TimesheetSchema.index({ status: 1, date: -1 });

export default mongoose.model<ITimesheet>('Timesheet', TimesheetSchema);
