import mongoose, { Document, Schema } from 'mongoose';

export interface IEmployee extends Document {
  _id: mongoose.Types.ObjectId;
  employeeCode: string;
  user: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: mongoose.Types.ObjectId;
  designation: string;
  reportingTo?: mongoose.Types.ObjectId;
  joiningDate: Date;
  salary?: number;
  avatar?: string;
  status: 'active' | 'inactive' | 'on_leave';
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  workLocation: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  gender?: string;
  dateOfBirth?: Date;
  bloodGroup?: string;
  bio?: string;
  skills?: string[];
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: false,
      default: null,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    reportingTo: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    joiningDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    salary: {
      type: Number,
      default: 0,
    },

    avatar: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave'],
      default: 'active',
    },

    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },

    workLocation: {
      type: String,
      default: 'HQ',
    },

    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },

    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },

    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
    gender:      { type: String, default: '' },
    dateOfBirth: { type: Date },
    bloodGroup:  { type: String, default: '' },
    bio:         { type: String, default: '' },
    skills:      [{ type: String }],
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

EmployeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Only keep indexes that are NOT already created by `unique: true`
EmployeeSchema.index({ department: 1, status: 1 });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);