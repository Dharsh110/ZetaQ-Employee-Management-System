import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: 'admin' | 'manager' | 'employee';
  department?: string;
  title: string;
  description: string;
  priority: 'normal' | 'urgent' | 'info';
  recipients: ('manager' | 'deptManager' | 'admin' | 'team')[];
  status: 'sent' | 'delivered' | 'read';
  link?: string;
  fileName?: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName:  { type: String, required: true },
    senderRole:  { type: String, enum: ['admin','manager','employee'], required: true },
    department:  { type: String },
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    priority:    { type: String, enum: ['normal','urgent','info'], default: 'normal' },
    recipients:  [{ type: String, enum: ['manager','deptManager','admin','team'] }],
    status:      { type: String, enum: ['sent','delivered','read'], default: 'sent' },
    link:        { type: String },
    fileName:    { type: String },
    readBy:      [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ department: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
