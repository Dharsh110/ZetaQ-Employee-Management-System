import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Department from '../models/Department';
import Employee from '../models/Employee';

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Employee.deleteMany({})
    ]);

    // Create Departments
    const depts = await Department.insertMany([
      {
        name: 'Engineering',
        code: 'ENG',
        location: 'Chennai',
        description: 'Software Development',
        isActive: true
      },
      {
        name: 'Human Resources',
        code: 'HR',
        location: 'Chennai',
        description: 'HR and Recruitment',
        isActive: true
      },
      {
        name: 'Sales',
        code: 'SAL',
        location: 'Bangalore',
        description: 'Sales Department',
        isActive: true
      },
      {
        name: 'Finance',
        code: 'FIN',
        location: 'Chennai',
        description: 'Finance Department',
        isActive: true
      },
      {
        name: 'Marketing',
        code: 'MKT',
        location: 'Mumbai',
        description: 'Marketing Department',
        isActive: true
      }
    ]);

    console.log(`Created ${depts.length} departments`);

    // ==========================
    // ADMIN USER
    // ==========================
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@zetaq.com',
      password: 'Admin@1234',
      role: 'admin',
      isActive: true,
      isEmailVerified: true
    });

    // ==========================
    // MANAGER USER
    // ==========================
    const managerUser = await User.create({
      name: 'Sneha Iyer',
      email: 'manager@zetaq.com',
      password: 'Manager@1234',
      role: 'manager',
      isActive: true,
      isEmailVerified: true
    });

    // ==========================
    // MANAGER EMPLOYEE
    // ==========================
    const managerEmp = await Employee.create({
      user: managerUser._id,
      employeeCode: 'EMP-0001',
      firstName: 'Sneha',
      lastName: 'Iyer',
      email: 'manager@zetaq.com',
      phone: '9876543210',
      department: depts[0]._id,
      designation: 'Engineering Manager',
      joiningDate: new Date('2022-01-15'),
      salary: 120000,
      status: 'active',
      employmentType: 'full_time',
      workLocation: 'Chennai'
    });

    // ==========================
    // EMPLOYEE USERS
    // ==========================
    const empUsers = await User.insertMany([
      {
        name: 'Arjun Kumar',
        email: 'arjun@zetaq.com',
        password: 'Arjun@1234',
        role: 'employee',
        isActive: true,
        isEmailVerified: true
      },
      {
        name: 'Priya Sharma',
        email: 'priya@zetaq.com',
        password: 'Priya@1234',
        role: 'employee',
        isActive: true,
        isEmailVerified: true
      },
      {
        name: 'Ravi Mohan',
        email: 'ravi@zetaq.com',
        password: 'Ravi@1234',
        role: 'employee',
        isActive: true,
        isEmailVerified: true
      },
      {
        name: 'Lalitha Devi',
        email: 'lalitha@zetaq.com',
        password: 'Lalitha@1234',
        role: 'employee',
        isActive: true,
        isEmailVerified: true
      }
    ]);

    // ==========================
    // EMPLOYEE RECORDS
    // ==========================
    const empRecords = await Employee.insertMany([
      {
        user: empUsers[0]._id,
        employeeCode: 'EMP-0002',
        firstName: 'Arjun',
        lastName: 'Kumar',
        email: 'arjun@zetaq.com',
        phone: '9876500001',
        department: depts[0]._id,
        designation: 'Software Engineer',
        joiningDate: new Date('2023-03-01'),
        salary: 75000,
        reportingTo: managerEmp._id,
        status: 'active',
        employmentType: 'full_time',
        workLocation: 'Chennai'
      },
      {
        user: empUsers[1]._id,
        employeeCode: 'EMP-0003',
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya@zetaq.com',
        phone: '9876500002',
        department: depts[1]._id,
        designation: 'HR Executive',
        joiningDate: new Date('2022-08-10'),
        salary: 60000,
        status: 'active',
        employmentType: 'full_time',
        workLocation: 'Chennai'
      },
      {
        user: empUsers[2]._id,
        employeeCode: 'EMP-0004',
        firstName: 'Ravi',
        lastName: 'Mohan',
        email: 'ravi@zetaq.com',
        phone: '9876500003',
        department: depts[2]._id,
        designation: 'Sales Executive',
        joiningDate: new Date('2023-01-15'),
        salary: 55000,
        status: 'active',
        employmentType: 'full_time',
        workLocation: 'Bangalore'
      },
      {
        user: empUsers[3]._id,
        employeeCode: 'EMP-0005',
        firstName: 'Lalitha',
        lastName: 'Devi',
        email: 'lalitha@zetaq.com',
        phone: '9876500004',
        department: depts[3]._id,
        designation: 'Finance Analyst',
        joiningDate: new Date('2022-11-01'),
        salary: 70000,
        status: 'active',
        employmentType: 'full_time',
        workLocation: 'Chennai'
      }
    ]);

    console.log(`Created ${empRecords.length + 1} employee records`);

    console.log('\n✅ Seed Complete!\n');

    console.log('Login Credentials');
    console.log('---------------------------------------');
    console.log('Admin');
    console.log('Email    : admin@zetaq.com');
    console.log('Password : Admin@1234');
    console.log('');

    console.log('Manager');
    console.log('Email    : manager@zetaq.com');
    console.log('Password : Manager@1234');
    console.log('');

    console.log('Employee');
    console.log('Email    : arjun@zetaq.com');
    console.log('Password : Arjun@1234');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed(); 