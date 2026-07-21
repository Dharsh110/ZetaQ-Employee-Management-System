export type UserRole = 'admin' | 'manager' | 'employee';
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day' | 'holiday' | 'weekend';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'half_day' | 'unpaid';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PayrollStatus = 'pending' | 'processed' | 'paid' | 'failed';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  employee?: Employee;
  createdAt: string;
  department?: string;
  designation?: string;
  managerId?: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  head?: Employee;
  location: string;
  description?: string;
  employeeCount?: number;
  isActive: boolean;
}

export interface Employee {
  _id: string;
  employeeCode: string;
  user: string | User;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  department: Department | string;
  designation: string;
  reportingTo?: Employee;
  joiningDate: string;
  salary?: number;
  avatar?: string;
  status: 'active' | 'inactive' | 'on_leave';
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  workLocation: string;
  address?: { street?: string; city?: string; state?: string; pincode?: string };
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  createdAt: string;
}

export interface Attendance {
  _id: string;
  employee: Employee | string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  overtimeHours?: number;
  status: AttendanceStatus;
  isLate: boolean;
  lateByMinutes?: number;
  notes?: string;
}

export interface Leave {
  _id: string;
  employee: Employee | string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: User;
  approvedAt?: string;
  rejectionReason?: string;
  appliedAt: string;
  createdAt: string;
}

export interface TaskComment {
  _id: string;
  author: User;
  text: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  assignedTo: Employee | string;
  assignedBy: User | string;
  department?: Department | string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  hoursWorked?: number;
  hoursEstimated?: number;
  submittedAt?: string;
  submittedDescription?: string;
  approvedBy?: User;
  comments: TaskComment[];
  tags?: string[];
  createdAt: string;
}

export interface Payroll {
  _id: string;
  employee: Employee;
  month: number;
  year: number;
  basicSalary: number;
  allowances: { hra: number; transport: number; medical: number; other: number };
  deductions: { pf: number; tax: number; other: number };
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
  paidAt?: string;
  createdAt: string;
}

export interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  type: 'meeting' | 'holiday' | 'event' | 'reminder' | 'deadline';
  color?: string;
  location?: string;
  isPublic: boolean;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: Pagination;
  summary?: Record<string, number>;
}

export interface AttendanceSummary {
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
}
