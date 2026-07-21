import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Task from '../models/Task';
import Employee from '../models/Employee';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');

  const tasks = await Task.find({ $or: [{ department: { $exists: false } }, { department: null }] });
  console.log(`Found ${tasks.length} tasks with no department`);

  let fixed = 0;
  for (const task of tasks) {
    if (!task.assignedTo) continue;
    const employee = await Employee.findById(task.assignedTo).select('department');
    if (employee?.department) {
      task.department = employee.department;
      await task.save();
      fixed++;
    }
  }

  console.log(`Backfilled department on ${fixed} task(s)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
