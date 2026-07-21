import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  head?: mongoose.Types.ObjectId;
  location: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    head: { type: Schema.Types.ObjectId, ref: 'Employee' },
    location: { type: String, required: true, default: 'HQ' },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
