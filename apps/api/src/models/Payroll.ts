import mongoose, { Document, Schema } from 'mongoose';

export type PayrollStatus = 'pending' | 'processed' | 'paid' | 'failed';

export interface IPayroll extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  month: number;
  year: number;
  basicSalary: number;
  allowances: {
    hra: number;
    transport: number;
    medical: number;
    other: number;
  };
  deductions: {
    pf: number;
    tax: number;
    other: number;
  };
  totalAllowances: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  overtime: number;
  overtimePay: number;
  status: PayrollStatus;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  paidAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema = new Schema<IPayroll>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    allowances: {
      hra: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    deductions: {
      pf: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    totalAllowances: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    workingDays: { type: Number, default: 26 },
    presentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'processed', 'paid', 'failed'], default: 'pending' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    paidAt: { type: Date },
    remarks: { type: String },
  },
  { timestamps: true }
);

PayrollSchema.pre('save', function (next) {
  this.totalAllowances =
    this.allowances.hra + this.allowances.transport + this.allowances.medical + this.allowances.other;
  this.totalDeductions = this.deductions.pf + this.deductions.tax + this.deductions.other;
  this.grossSalary = this.basicSalary + this.totalAllowances + this.overtimePay;
  this.netSalary = this.grossSalary - this.totalDeductions;
  next();
});

PayrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model<IPayroll>('Payroll', PayrollSchema);
