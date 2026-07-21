import mongoose, { Document, Schema } from 'mongoose';

export type LeaveType = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'half_day' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ILeave extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  fromDate: Date;
  toDate: Date;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema = new Schema<ILeave>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: {
      type: String,
      enum: ['casual', 'sick', 'earned', 'maternity', 'paternity', 'half_day', 'unpaid'],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalDays: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LeaveSchema.pre('save', function (next) {
  if (this.fromDate && this.toDate) {
    const diffTime = Math.abs(this.toDate.getTime() - this.fromDate.getTime());
    this.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (this.leaveType === 'half_day') this.totalDays = 0.5;
  }
  next();
});

LeaveSchema.index({ employee: 1, status: 1 });
LeaveSchema.index({ fromDate: 1, toDate: 1 });

export default mongoose.model<ILeave>('Leave', LeaveSchema);
