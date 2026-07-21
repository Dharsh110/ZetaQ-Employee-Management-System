import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.user?._id })
      .sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ recipient: req.user?._id, isRead: false });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user?._id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ recipient: req.user?._id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user?._id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to create a notification (used by other controllers)
export const createNotification = async (
  recipient: string, role: string, type: string, title: string, message: string, link?: string, department?: string
) => {
  try {
    await Notification.create({ recipient, recipientRole: role, type, title, message, link, department });
  } catch {}
};
