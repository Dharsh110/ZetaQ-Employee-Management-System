import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  recipientRole: 'admin' | 'manager' | 'employee';
  type: 'leave' | 'task' | 'attendance' | 'payroll' | 'message' | 'system' | 'calendar' | 'timesheet';
  title: string;
  message: string;
  link?: string;
  department?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientRole: { type: String, enum: ['admin','manager','employee'] },
    type:          { type: String, enum: ['leave','task','attendance','payroll','message','system','calendar','timesheet'], default: 'system' },
    title:         { type: String, required: true },
    message:       { type: String, required: true },
    link:          { type: String },
    department:    { type: String },
    isRead:        { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
