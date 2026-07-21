import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Message from '../models/Message';
import Employee from '../models/Employee';
import User from '../models/User';
import { createNotification } from './notificationController';

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, priority, recipients, link, fileName, department } = req.body;

    // Resolve the sender's department from their Employee record if not provided
    let senderDept = department || '';
    if (!senderDept && req.user?.role === 'employee') {
      try {
        const emp = await Employee.findOne({ user: req.user._id }).populate('department', 'name');
        senderDept = (emp?.department as any)?.name || '';
      } catch {}
    }
    if (!senderDept && req.user?.role === 'manager') {
      senderDept = (req.user as any).department || '';
    }

    const recipientList: string[] = recipients || ['manager'];

    const msg = await Message.create({
      sender: req.user?._id,
      senderName: req.user?.name || '',
      senderRole: req.user?.role || 'employee',
      department: senderDept,
      title,
      description,
      priority: priority || 'normal',
      recipients: recipientList,
      link,
      fileName,
    });

    try {
      const notifyUsers: { _id: any; role: string }[] = [];
      if (recipientList.includes('admin')) {
        notifyUsers.push(...(await User.find({ role: 'admin' }).select('_id role')));
      }
      if (recipientList.includes('manager')) {
        // "Manager" targets ONLY the main/unscoped manager(s) — distinct from
        // "Dept Manager" below, which targets only the sender's own dept manager.
        notifyUsers.push(...(await User.find({
          role: 'manager',
          $or: [{ department: '' }, { department: { $exists: false } }, { department: null }],
        }).select('_id role')));
      }
      if (recipientList.includes('deptManager') && senderDept) {
        notifyUsers.push(...(await User.find({ role: 'manager', department: senderDept }).select('_id role')));
      }
      if (recipientList.includes('team') && senderDept) {
        const deptUsers = await User.find({ role: 'employee', department: senderDept }).select('_id role');
        notifyUsers.push(...deptUsers);
      }
      for (const u of notifyUsers) {
        if (u._id.toString() === req.user?._id?.toString()) continue;
        await createNotification(u._id.toString(), u.role, 'message', title || 'New message', description || `New message from ${req.user?.name}`, `/${u.role}/messages`, senderDept || undefined);
      }
    } catch { /* notification failure should not block message send */ }

    res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const { type = 'sent' } = req.query; // 'sent' | 'inbox'

    if (role === 'employee') {
      if (type === 'inbox') {
        // Employee inbox: messages from managers/admin sent to 'team' in their dept
        let empDept = '';
        try {
          const emp = await Employee.findOne({ user: req.user?._id }).populate('department', 'name');
          empDept = (emp?.department as any)?.name || '';
        } catch {}

        const filter: any = {
          senderRole: { $in: ['manager', 'admin'] },
          recipients: 'team',
        };
        if (empDept) filter.department = empDept;

        const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, messages });
      } else {
        // Employee outbox: messages they sent
        const messages = await Message.find({ sender: req.user?._id }).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, messages });
      }
      return;
    }

    if (role === 'manager') {
      const dept = (req.user as any)?.department;
      if (type === 'inbox') {
        // Manager inbox: a dept-scoped manager sees only messages from their own
        // dept's employees specifically targeted at 'deptManager'. The main/unscoped
        // manager sees only 'manager'-targeted messages (from any employee, plus
        // dept managers escalating to them) — never someone else's dept-manager-only
        // message. These are mutually exclusive on purpose (see Phase 3 of the plan).
        const filter: any = dept
          ? { senderRole: 'employee', department: dept, recipients: 'deptManager' }
          : { senderRole: { $in: ['employee', 'manager'] }, recipients: 'manager' };
        const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, messages });
      } else {
        // Manager outbox: messages they sent
        const messages = await Message.find({ sender: req.user?._id }).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, messages });
      }
      return;
    }

    // Admin
    if (type === 'inbox') {
      // Admin inbox: messages sent TO admin by employees/managers
      const messages = await Message.find({ recipients: 'admin' }).sort({ createdAt: -1 }).limit(200);
      res.json({ success: true, messages });
    } else {
      // Admin outbox: messages sent by admin
      const messages = await Message.find({ sender: req.user?._id }).sort({ createdAt: -1 }).limit(200);
      res.json({ success: true, messages });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.user?._id }, status: 'read' },
      { new: true }
    );
    if (!msg) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    res.json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await Message.findOneAndDelete({ _id: req.params.id, sender: req.user?._id });
    if (!msg) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
