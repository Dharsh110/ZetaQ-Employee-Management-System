import mongoose, { Document, Schema } from 'mongoose';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ITaskComment {
  author: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface ITaskSubmittedFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadId?: mongoose.Types.ObjectId;
}

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  assignedTo: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  department?: mongoose.Types.ObjectId;
  dueDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  hoursWorked?: number;
  hoursEstimated?: number;
  link?: string;
  attachments?: ITaskSubmittedFile[];
  submittedAt?: Date;
  submittedDescription?: string;
  submittedFiles?: ITaskSubmittedFile[];
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  comments: ITaskComment[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskCommentSchema = new Schema<ITaskComment>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// NOTE: uses an explicit sub-schema (not an inline object literal) because the
// field named `type` below would otherwise be misread by Mongoose as the
// SchemaTypeOptions `type` key, silently collapsing this into an array of strings.
const TaskSubmittedFileSchema = new Schema<ITaskSubmittedFile>(
  {
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
    url: { type: String },
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload' },
  },
  { _id: false }
);

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'],
      default: 'pending',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent', 'critical'], default: 'medium' },
    hoursWorked: { type: Number, default: 0 },
    hoursEstimated: { type: Number },
    link: { type: String },
    attachments: [TaskSubmittedFileSchema],
    submittedAt: { type: Date },
    submittedDescription: { type: String },
    submittedFiles: [TaskSubmittedFileSchema],
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    comments: [TaskCommentSchema],
    tags: [{ type: String }],
  },
  { timestamps: true }
);

TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ department: 1 });

export default mongoose.model<ITask>('Task', TaskSchema);
