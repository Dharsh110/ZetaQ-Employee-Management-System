import { Request, Response } from 'express';
import Task from '../models/Task';
import Employee from '../models/Employee';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, assignedTo, dueDate, priority, hoursEstimated, tags, department, link, attachments } = req.body;

    // Neither the Admin nor the Manager "Assign Task" UI sends `department` —
    // derive it from the assignee's own Employee record so this task is still
    // visible to department-scoped views (dept manager Task Review, the
    // department breakdown stats) that filter strictly on Task.department.
    let taskDepartment = department;
    if (!taskDepartment && assignedTo) {
      const assigneeEmployee = await Employee.findById(assignedTo).select('department');
      taskDepartment = assigneeEmployee?.department;
    }

    const task = await Task.create({
      title, description, assignedTo, assignedBy: req.user?._id,
      dueDate, priority, hoursEstimated, tags, department: taskDepartment, link, attachments,
    });

    const populated = await Task.findById(task._id)
      .populate({
        path: 'assignedTo',
        select: 'firstName lastName employeeCode department',
        populate: { path: 'department', select: 'name' },
      })
      .populate('assignedBy', 'name')
      .populate('department', 'name');

    const assignee = await Employee.findById(assignedTo);
    if (assignee?.user) {
      await createNotification(
        assignee.user.toString(), 'employee', 'task',
        'New task assigned', `You've been assigned: "${title}"`, '/employee/tasks'
      );
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, assignedTo, department, page = 1, limit = 100 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // `department` here is a department NAME (as sent by the frontend), not an
    // ObjectId — resolve it before filtering the ObjectId-ref `department` path.
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    if (deptNameFilter) {
      const deptDoc = await (await import('../models/Department')).default.findOne({ name: deptNameFilter });
      filter.department = deptDoc ? deptDoc._id : { $in: [] };
    }

    const overdueCutoff = new Date();
    await Task.updateMany(
      { dueDate: { $lt: overdueCutoff }, status: { $in: ['pending', 'in_progress'] } },
      { status: 'overdue' }
    );

    const skip = (Number(page) - 1) * Number(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate({
          path: 'assignedTo',
          select: 'firstName lastName employeeCode avatar department',
          populate: { path: 'department', select: 'name' },
        })
        .populate('assignedBy', 'name')
        .populate('department', 'name')
        .skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: tasks,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const tasks = await Task.find({ assignedTo: employee._id })
      .populate('assignedBy', 'name')
      .sort({ dueDate: 1 });

    const summary = {
      pending: tasks.filter((t) => t.status === 'pending').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
    };

    res.status(200).json({ success: true, data: tasks, summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('assignedTo', 'firstName lastName')
      .populate('assignedBy', 'name');

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    res.status(200).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitTaskUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { hoursWorked, submittedDescription, status, submittedFiles } = req.body;
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) {
      res.status(403).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const task = await Task.findOne({ _id: req.params.id, assignedTo: employee._id });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found or not assigned to you.' });
      return;
    }

    task.hoursWorked = hoursWorked || task.hoursWorked;
    task.submittedDescription = submittedDescription;
    task.submittedAt = new Date();
    if (Array.isArray(submittedFiles)) task.submittedFiles = submittedFiles;
    if (status) task.status = status;
    await task.save();

    if (status === 'cancelled') {
      try {
        const populatedEmp = await Employee.findById(employee._id).populate('department', 'name');
        const deptName = (populatedEmp?.department as any)?.name || '';
        const notifyUsers: { _id: any; role: string }[] = await User.find({
          $or: [
            { role: 'admin' },
            { role: 'manager', $or: [{ department: '' }, { department: { $exists: false } }, { department: null }] },
            ...(deptName ? [{ role: 'manager', department: deptName }] : []),
          ],
        }).select('_id role');
        for (const u of notifyUsers) {
          await createNotification(
            u._id.toString(), u.role, 'task',
            'Task cancelled', `${employee.firstName} ${employee.lastName} cancelled "${task.title}". Reason: ${submittedDescription || 'No reason given'}`,
            u.role === 'admin' ? '/admin/tasks' : '/manager/tasks', deptName || undefined
          );
        }
      } catch { /* notification failure should not block cancellation */ }
    } else if (task.assignedBy) {
      const assigner = await User.findById(task.assignedBy).select('role');
      if (assigner) {
        const populatedEmp = await Employee.findById(employee._id).populate('department', 'name');
        const deptName = (populatedEmp?.department as any)?.name || '';
        await createNotification(
          task.assignedBy.toString(), assigner.role, 'task',
          'Task submitted', `${employee.firstName} ${employee.lastName} submitted an update for "${task.title}"`,
          assigner.role === 'admin' ? '/admin/tasks' : '/manager/tasks', deptName || undefined
        );
      }
    }

    res.status(200).json({ success: true, data: task, message: 'Task update submitted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }

    task.comments.push({ author: req.user?._id as any, text: req.body.text, createdAt: new Date() });
    await task.save();

    const updated = await Task.findById(task._id).populate('comments.author', 'name avatar');
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Task deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
