import mongoose, { Document, Schema } from 'mongoose';

export type DailyReportStatus = 'in_progress' | 'completed' | 'blocked' | 'pending_review';
export type DailyReportMood = 'great' | 'good' | 'neutral' | 'tired' | 'stressed';

export interface IDailyReportComment {
  author: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: string;
  text: string;
  createdAt: Date;
}

export interface IDailyReportFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadId?: mongoose.Types.ObjectId;
}

export interface IDailyReport extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  empCode: string;
  empName: string;
  department: string;
  date: string;
  taskTitle: string;
  description: string;
  achievements?: string;
  challenges?: string;
  nextPlan?: string;
  mood: DailyReportMood;
  hoursWorked: number;
  status: DailyReportStatus;
  recipients: ('manager' | 'admin' | 'team')[];
  link?: string;
  files: IDailyReportFile[];
  comments: IDailyReportComment[];
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyReportCommentSchema = new Schema<IDailyReportComment>({
  author:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, default: '' },
  text:       { type: String, required: true },
  createdAt:  { type: Date, default: Date.now },
});

// NOTE: explicit sub-schema (not an inline object literal) — a field named
// `type` inside an inline array-of-objects definition gets misread by
// Mongoose as the SchemaTypeOptions `type` key, silently collapsing the
// whole array into an array of strings.
const DailyReportFileSchema = new Schema<IDailyReportFile>(
  {
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
    url:  { type: String },
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload' },
  },
  { _id: false }
);

const DailyReportSchema = new Schema<IDailyReport>(
  {
    employee:    { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    empCode:     { type: String, required: true },
    empName:     { type: String, required: true },
    department:  { type: String, required: true },
    date:        { type: String, required: true },
    taskTitle:   { type: String, required: true, trim: true },
    description: { type: String, required: true },
    achievements: { type: String, trim: true },
    challenges:   { type: String, trim: true },
    nextPlan:     { type: String, trim: true },
    mood:        { type: String, enum: ['great','good','neutral','tired','stressed'], default: 'good' },
    hoursWorked: { type: Number, required: true, min: 0, max: 24 },
    status:      { type: String, enum: ['in_progress','completed','blocked','pending_review'], default: 'in_progress' },
    recipients:  [{ type: String, enum: ['manager','admin','team'] }],
    link:        { type: String },
    files:       [DailyReportFileSchema],
    comments:    [DailyReportCommentSchema],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DailyReportSchema.index({ employee: 1, date: 1 });
DailyReportSchema.index({ department: 1, date: 1 });
DailyReportSchema.index({ date: -1 });

export default mongoose.model<IDailyReport>('DailyReport', DailyReportSchema);
