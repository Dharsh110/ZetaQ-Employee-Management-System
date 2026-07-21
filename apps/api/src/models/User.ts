import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'manager' | 'employee';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  department?: string;
  employeeId?: mongoose.Types.ObjectId;
  avatar?: string;
  googleId?: string;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerified: boolean;
  emailVerifyToken?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false, minlength: 8 },
    role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
    department: { type: String, default: '' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    avatar: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String },
    lastLogin: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

export default mongoose.model<IUser>('User', UserSchema);
