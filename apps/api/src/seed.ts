/**
 * ZetaQ EMS — Database Seed Script
 * Run: npx ts-node src/seed.ts
 * Seeds demo users, departments, employees, attendance, tasks, leaves, and daily reports.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Models ──────────────────────────────────────────────────────────────────
import User from './models/User';
import Employee from './models/Employee';
import Department from './models/Department';
import Task from './models/Task';
import Attendance from './models/Attendance';
import Leave from './models/Leave';
import DailyReport from './models/DailyReport';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zetaq_ems';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    (Employee as any).deleteMany({}),
    Department.deleteMany({}),
    Task.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    DailyReport.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Departments ──────────────────────────────────────────────────────────
  const deptDocs = await Department.insertMany([
    { name: 'Engineering',       code: 'ENG', location: 'HQ', description: 'Software Engineering', isActive: true },
    { name: 'Product',           code: 'PRD', location: 'HQ', description: 'Product Management',   isActive: true },
    { name: 'Design',            code: 'DSN', location: 'HQ', description: 'UI/UX Design',         isActive: true },
    { name: 'HR',                code: 'HRD', location: 'HQ', description: 'Human Resources',      isActive: true },
    { name: 'Sales & Marketing', code: 'SMK', location: 'HQ', description: 'Sales and Marketing',  isActive: true },
    { name: 'Finance',           code: 'FIN', location: 'HQ', description: 'Finance & Accounts',   isActive: true },
    { name: 'Support',           code: 'SUP', location: 'HQ', description: 'Customer Support',     isActive: true },
    { name: 'Security',          code: 'SEC', location: 'HQ', description: 'IT Security',          isActive: true },
  ]);
  const deptMap: Record<string, mongoose.Types.ObjectId> = {};
  deptDocs.forEach(d => { deptMap[d.name] = d._id as mongoose.Types.ObjectId; });
  console.log('🏢 Departments seeded');

  // ── Users (admin, manager, employees) ───────────────────────────────────
  const hashPw = (pw: string) => bcrypt.hashSync(pw, 12);

  const adminUser = await User.create({
    name: 'Admin ZetaQ', email: 'admin@zetaq.com', password: hashPw('Admin@1234'),
    role: 'admin', isActive: true, emailVerified: true,
  });

  // ── Department Managers (one per dept, IDs 0101–0108) ────────────────────
  const mgrSeed = [
    { name:'Ravi Kumar',   email:'eng.manager@zetaq.com',     pw:'EngMgr@1234',    dept:'Engineering',       desig:'Engineering Manager',       code:'MGR0101' },
    { name:'Vikram Nair',  email:'prod.manager@zetaq.com',    pw:'ProdMgr@1234',   dept:'Product',           desig:'Product Manager',           code:'MGR0102' },
    { name:'Pooja Menon',  email:'design.manager@zetaq.com',  pw:'DsnMgr@1234',    dept:'Design',            desig:'Design Manager',            code:'MGR0103' },
    { name:'Meena Iyer',   email:'hr.manager@zetaq.com',      pw:'HrMgr@1234',     dept:'HR',                desig:'HR Manager',                code:'MGR0104' },
    { name:'Ananya Singh', email:'sales.manager@zetaq.com',   pw:'SalesMgr@1234',  dept:'Sales & Marketing', desig:'Sales & Marketing Manager', code:'MGR0105' },
    { name:'Karthik Raja', email:'finance.manager@zetaq.com', pw:'FinMgr@1234',    dept:'Finance',           desig:'Finance Manager',           code:'MGR0106' },
    { name:'Kavya Sharma', email:'support.manager@zetaq.com', pw:'SupportMgr@1234',dept:'Support',           desig:'Support Manager',           code:'MGR0107' },
    { name:'Nikhil Gupta', email:'security.manager@zetaq.com',pw:'SecMgr@1234',    dept:'Security',          desig:'Security Manager',          code:'MGR0108' },
  ];
  // Main manager: no linked Employee and no department string, so the `protect`
  // middleware never backfills a department onto this account — every
  // department-scoped controller treats an empty department as "see everything",
  // which is what makes this the cross-department, admin-like main manager.
  await User.create({
    name: 'Ravi Kumar', email: 'manager@zetaq.com', password: hashPw('MainMgr@1234'),
    role: 'manager', isActive: true, emailVerified: true,
  });

  const mgrUserIds: Record<string, mongoose.Types.ObjectId> = {};
  const mgrObjIds:  Record<string, mongoose.Types.ObjectId> = {};

  for (const m of mgrSeed) {
    const u = await User.create({
      name: m.name, email: m.email, password: hashPw(m.pw),
      role: 'manager', isActive: true, emailVerified: true,
    });
    mgrUserIds[m.code] = u._id as mongoose.Types.ObjectId;
  }
  for (const m of mgrSeed) {
    const parts = m.name.split(' ');
    const emp = await (Employee as any).create({
      employeeCode: m.code,
      user: mgrUserIds[m.code],
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || '',
      email: m.email,
      phone: `+91 9876${Math.floor(100000 + Math.random() * 900000)}`,
      department: deptMap[m.dept],
      designation: m.desig,
      joiningDate: new Date('2020-06-01'),
      salary: 90000 + Math.floor(Math.random() * 30000),
      status: 'active',
      employmentType: 'full_time',
      workLocation: 'Chennai',
    });
    mgrObjIds[m.code] = emp._id as mongoose.Types.ObjectId;
    await User.findByIdAndUpdate(mgrUserIds[m.code], { employeeId: emp._id });
    // Set as dept head
    await Department.findByIdAndUpdate(deptMap[m.dept], { head: emp._id });
  }
  const mgrUser = { _id: mgrUserIds['MGR0101'] }; // Engineering manager for task assignments below

  const empSeed = [
    { name:'Arjun Kumar',   email:'arjun@zetaq.com',   pw:'Arjun@1234',   dept:'Engineering',       desig:'Software Engineer',    code:'EMP001' },
    { name:'Ravi Kumar',    email:'ravi@zetaq.com',    pw:'Ravi@1234',    dept:'Engineering',       desig:'Senior Developer',     code:'EMP002' },
    { name:'Lalitha M',     email:'lalitha@zetaq.com', pw:'Lalitha@1234', dept:'Engineering',       desig:'Backend Developer',    code:'EMP003' },
    { name:'Kiran Raj',     email:'kiran@zetaq.com',   pw:'Kiran@1234',   dept:'Engineering',       desig:'DevOps Engineer',      code:'EMP004' },
    { name:'Priya Sharma',  email:'priya@zetaq.com',   pw:'Priya@1234',   dept:'Engineering',       desig:'QA Engineer',          code:'EMP005' },
    { name:'Vikram Nair',   email:'vikram@zetaq.com',  pw:'Vikram@1234',  dept:'Product',           desig:'Product Manager',      code:'EMP006' },
    { name:'Rohini Balaji', email:'rohini@zetaq.com',  pw:'Rohini@1234',  dept:'Product',           desig:'Product Analyst',      code:'EMP007' },
    { name:'Pooja Menon',   email:'pooja@zetaq.com',   pw:'Pooja@1234',   dept:'Design',            desig:'UI/UX Designer',       code:'EMP008' },
    { name:'Deepa Nair',    email:'deepa@zetaq.com',   pw:'Deepa@1234',   dept:'Design',            desig:'Graphic Designer',     code:'EMP009' },
    { name:'Meena Iyer',    email:'meena@zetaq.com',   pw:'Meena@1234',   dept:'HR',                desig:'HR Manager',           code:'EMP010' },
    { name:'Sunita Pillai', email:'sunita@zetaq.com',  pw:'Sunita@1234',  dept:'HR',                desig:'HR Executive',         code:'EMP011' },
    { name:'Mohan Das',     email:'mohan@zetaq.com',   pw:'Mohan@1234',   dept:'Sales & Marketing', desig:'Marketing Executive',  code:'EMP012' },
    { name:'Ananya Singh',  email:'ananya@zetaq.com',  pw:'Ananya@1234',  dept:'Sales & Marketing', desig:'Sales Manager',        code:'EMP013' },
    { name:'Sneha Iyer',    email:'sneha@zetaq.com',   pw:'Sneha@1234',   dept:'Finance',           desig:'Finance Analyst',      code:'EMP014' },
    { name:'Arun Pillai',   email:'arun@zetaq.com',    pw:'Arun@1234',    dept:'Support',           desig:'Support Engineer',     code:'EMP015' },
    { name:'Kavya Sharma',  email:'kavya@zetaq.com',   pw:'Kavya@1234',   dept:'Support',           desig:'Support Lead',         code:'EMP016' },
    { name:'Nikhil Gupta',  email:'nikhil@zetaq.com',  pw:'Nikhil@1234',  dept:'Security',          desig:'Security Analyst',     code:'EMP017' },
  ];

  const empUserIds: Record<string, mongoose.Types.ObjectId> = {};
  const empObjIds: Record<string, mongoose.Types.ObjectId> = {};

  for (const e of empSeed) {
    const u = await User.create({
      name: e.name, email: e.email, password: hashPw(e.pw),
      role: 'employee', isActive: true, emailVerified: true,
    });
    empUserIds[e.code] = u._id as mongoose.Types.ObjectId;
  }

  // Create Employee documents
  for (const e of empSeed) {
    const parts = e.name.split(' ');
    const emp = await (Employee as any).create({
      employeeCode: e.code,
      user: empUserIds[e.code],
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || '',
      email: e.email,
      phone: `+91 9876${Math.floor(100000 + Math.random() * 900000)}`,
      department: deptMap[e.dept],
      designation: e.desig,
      joiningDate: new Date('2022-01-15'),
      salary: 50000 + Math.floor(Math.random() * 50000),
      status: 'active',
      employmentType: 'full_time',
      workLocation: 'Chennai',
    });
    empObjIds[e.code] = emp._id as mongoose.Types.ObjectId;

    // Link user → employee
    await User.findByIdAndUpdate(empUserIds[e.code], { employeeId: emp._id });
  }
  console.log('👥 Employees seeded');

  // ── Attendance (last 7 days) ─────────────────────────────────────────────
  const today = new Date();
  const attRecords: any[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    const dateStr = day.toISOString().slice(0, 10);
    for (const e of empSeed) {
      const rand = Math.random();
      const status = rand > 0.9 ? 'absent' : rand > 0.85 ? 'late' : 'present';
      const checkIn = status === 'absent' ? undefined : new Date(`${dateStr}T0${8 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}:00`);
      const checkOut = checkIn ? new Date(checkIn.getTime() + (8 + Math.random() * 2) * 3600000) : undefined;
      attRecords.push({
        employee: empObjIds[e.code],
        date: day,
        checkIn,
        checkOut,
        totalHours: checkIn && checkOut ? +((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(1) : 0,
        status: status === 'late' ? 'present' : status,
        isLate: status === 'late',
        lateByMinutes: status === 'late' ? Math.floor(Math.random() * 30) + 5 : 0,
        notes: status === 'late' ? 'Traffic delay' : '',
      });
    }
  }
  await Attendance.insertMany(attRecords);
  console.log('📅 Attendance seeded');

  // ── Tasks ────────────────────────────────────────────────────────────────
  const tasks = [
    { title:'API Integration Module',         assignedTo:empObjIds['EMP001'], dept:'Engineering',       status:'in_progress', priority:'high',     due:'2026-07-05', progress:65 },
    { title:'Server Infrastructure Upgrade',  assignedTo:empObjIds['EMP002'], dept:'Engineering',       status:'overdue',     priority:'critical', due:'2026-06-25', progress:40 },
    { title:'Monthly Financial Report',       assignedTo:empObjIds['EMP014'], dept:'Finance',           status:'completed',   priority:'high',     due:'2026-06-30', progress:100 },
    { title:'HR Policy Document Update',      assignedTo:empObjIds['EMP010'], dept:'HR',                status:'pending',     priority:'medium',   due:'2026-07-15', progress:0 },
    { title:'Social Media Campaign Jun',      assignedTo:empObjIds['EMP012'], dept:'Sales & Marketing', status:'in_progress', priority:'medium',   due:'2026-06-30', progress:80 },
    { title:'Q3 Budget Planning',             assignedTo:empObjIds['EMP014'], dept:'Finance',           status:'pending',     priority:'high',     due:'2026-07-20', progress:10 },
    { title:'Employee Onboarding Checklist',  assignedTo:empObjIds['EMP011'], dept:'HR',                status:'completed',   priority:'low',      due:'2026-06-15', progress:100 },
    { title:'Product Launch Content',         assignedTo:empObjIds['EMP013'], dept:'Sales & Marketing', status:'in_progress', priority:'critical', due:'2026-07-01', progress:55 },
    { title:'Database Performance Tuning',    assignedTo:empObjIds['EMP003'], dept:'Engineering',       status:'pending',     priority:'high',     due:'2026-07-10', progress:0 },
    { title:'Security Audit Q2',              assignedTo:empObjIds['EMP017'], dept:'Security',          status:'completed',   priority:'critical', due:'2026-06-28', progress:100 },
    { title:'UI Component Library',           assignedTo:empObjIds['EMP008'], dept:'Design',            status:'in_progress', priority:'medium',   due:'2026-07-08', progress:45 },
    { title:'Product Roadmap Q3',             assignedTo:empObjIds['EMP006'], dept:'Product',           status:'pending',     priority:'high',     due:'2026-07-12', progress:20 },
    { title:'Customer Support Portal',        assignedTo:empObjIds['EMP015'], dept:'Support',           status:'in_progress', priority:'high',     due:'2026-07-03', progress:60 },
  ];

  for (const t of tasks) {
    await Task.create({
      title: t.title,
      description: `Task: ${t.title}`,
      assignedTo: t.assignedTo,
      assignedBy: adminUser._id,
      department: deptMap[t.dept],
      dueDate: new Date(t.due),
      status: t.status,
      priority: t.priority as any,
      hoursWorked: 0,
    });
  }
  console.log('📋 Tasks seeded');

  // ── Leave Requests ───────────────────────────────────────────────────────
  await Leave.insertMany([
    { employee:empObjIds['EMP002'], leaveType:'sick',   fromDate:new Date('2026-07-01'), toDate:new Date('2026-07-02'), totalDays:2, reason:'Fever',        status:'pending',  appliedAt:new Date('2026-06-28') },
    { employee:empObjIds['EMP005'], leaveType:'casual', fromDate:new Date('2026-07-05'), toDate:new Date('2026-07-05'), totalDays:1, reason:'Personal work', status:'pending',  appliedAt:new Date('2026-06-27') },
    { employee:empObjIds['EMP003'], leaveType:'earned', fromDate:new Date('2026-07-10'), toDate:new Date('2026-07-12'), totalDays:3, reason:'Family trip',   status:'approved', appliedAt:new Date('2026-06-25'), approvedBy:adminUser._id, approvedAt:new Date() },
    { employee:empObjIds['EMP015'], leaveType:'sick',   fromDate:new Date('2026-06-25'), toDate:new Date('2026-06-26'), totalDays:2, reason:'Surgery',       status:'rejected', appliedAt:new Date('2026-06-22'), rejectionReason:'Coverage issue' },
    { employee:empObjIds['EMP012'], leaveType:'casual', fromDate:new Date('2026-07-20'), toDate:new Date('2026-07-21'), totalDays:2, reason:'Travel',        status:'pending',  appliedAt:new Date('2026-06-26') },
  ]);
  console.log('🗓️  Leaves seeded');

  // ── Daily Reports ────────────────────────────────────────────────────────
  await DailyReport.insertMany([
    { employee:empObjIds['EMP001'], empCode:'EMP001', empName:'Arjun Kumar',  department:'Engineering',  date:'2026-06-29', taskTitle:'API Integration Work',    description:'Completed REST API integration', hoursWorked:8, status:'completed',   recipients:['manager'], submittedAt:new Date() },
    { employee:empObjIds['EMP002'], empCode:'EMP002', empName:'Ravi Kumar',   department:'Engineering',  date:'2026-06-29', taskTitle:'Server Upgrade Prep',      description:'Upgraded dev server packages',  hoursWorked:7, status:'in_progress', recipients:['manager'], submittedAt:new Date() },
    { employee:empObjIds['EMP014'], empCode:'EMP014', empName:'Sneha Iyer',   department:'Finance',      date:'2026-06-29', taskTitle:'Q2 Financial Summary',     description:'Prepared financial summary doc', hoursWorked:6, status:'completed',   recipients:['admin'],   submittedAt:new Date() },
    { employee:empObjIds['EMP010'], empCode:'EMP010', empName:'Meena Iyer',   department:'HR',           date:'2026-06-29', taskTitle:'Policy Update Review',     description:'Reviewed HR policies',          hoursWorked:5, status:'completed',   recipients:['admin'],   submittedAt:new Date() },
    { employee:empObjIds['EMP012'], empCode:'EMP012', empName:'Mohan Das',    department:'Sales & Marketing', date:'2026-06-29', taskTitle:'Campaign Analytics',  description:'Analyzed campaign data',        hoursWorked:8, status:'completed',   recipients:['manager'], submittedAt:new Date() },
  ]);
  console.log('📝 Daily Reports seeded');

  console.log('\n✅ Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  Admin:                 admin@zetaq.com / Admin@1234');
  console.log('  Main Manager (all-dept): manager@zetaq.com / MainMgr@1234');
  console.log('  Engineering [MGR0101]: eng.manager@zetaq.com / EngMgr@1234');
  console.log('  Product     [MGR0102]: prod.manager@zetaq.com / ProdMgr@1234');
  console.log('  Design      [MGR0103]: design.manager@zetaq.com / DsnMgr@1234');
  console.log('  HR          [MGR0104]: hr.manager@zetaq.com / HrMgr@1234');
  console.log('  Sales       [MGR0105]: sales.manager@zetaq.com / SalesMgr@1234');
  console.log('  Finance     [MGR0106]: finance.manager@zetaq.com / FinMgr@1234');
  console.log('  Support     [MGR0107]: support.manager@zetaq.com / SupportMgr@1234');
  console.log('  Security    [MGR0108]: security.manager@zetaq.com / SecMgr@1234');
  console.log('  Employee:              arjun@zetaq.com / Arjun@1234');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
