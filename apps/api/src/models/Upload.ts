import mongoose, { Document, Schema } from 'mongoose';

export interface IUpload extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  employeeCode: string;
  employeeName: string;
  originalName: string;
  mimeType: string;
  size: number;
  data: string; // base64 encoded file content
  notes?: string;
  category: 'document' | 'image' | 'report' | 'other';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSchema = new Schema<IUpload>(
  {
    employee:     { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employeeCode: { type: String, required: true },
    employeeName: { type: String, required: true },
    originalName: { type: String, required: true, trim: true },
    mimeType:     { type: String, required: true },
    size:         { type: Number, required: true },
    data:         { type: String, required: true }, // base64
    notes:        { type: String },
    category:     { type: String, enum: ['document', 'image', 'report', 'other'], default: 'document' },
    uploadedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UploadSchema.index({ employee: 1, uploadedAt: -1 });
UploadSchema.index({ user: 1 });

export default mongoose.model<IUpload>('Upload', UploadSchema);
