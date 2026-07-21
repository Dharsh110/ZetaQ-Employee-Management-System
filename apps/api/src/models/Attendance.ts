import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day' | 'holiday' | 'weekend';

export interface IAttendance extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  totalHours?: number;
  overtimeHours?: number;
  status: AttendanceStatus;
  isLate: boolean;
  lateByMinutes?: number;
  notes?: string;
  markedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    totalHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave', 'half_day', 'holiday', 'weekend'],
      default: 'absent',
    },
    isLate: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    notes: { type: String },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AttendanceSchema.pre('save', function (next) {
  if (this.checkIn && this.checkOut) {
    const diffMs = this.checkOut.getTime() - this.checkIn.getTime();
    this.totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    const standardHours = 9;
    if (this.totalHours > standardHours) {
      this.overtimeHours = parseFloat((this.totalHours - standardHours).toFixed(2));
    }
  }

  if (this.checkIn) {
    const checkInHour = this.checkIn.getHours();
    const checkInMin = this.checkIn.getMinutes();
    const totalMinutes = checkInHour * 60 + checkInMin;
    const startTime = 9 * 60 + 15; // 9:15 AM threshold
    if (totalMinutes > startTime) {
      this.isLate = true;
      this.lateByMinutes = totalMinutes - 9 * 60;
    }
  }
  next();
});

AttendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, status: 1 });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
