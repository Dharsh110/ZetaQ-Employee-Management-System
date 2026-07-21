import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Upload from '../models/Upload';
import Employee from '../models/Employee';

const getOrCreateEmp = async (userId: any, userName?: string, userEmail?: string) => {
  let emp = await Employee.findOne({ user: userId });
  if (!emp) {
    const count = await Employee.countDocuments();
    const [firstName, ...rest] = (userName || 'User').split(' ');
    emp = await Employee.create({
      employeeCode: `EMP${String(count + 1).padStart(3, '0')}`,
      user: userId, firstName, lastName: rest.join(' ') || '-',
      email: userEmail || '', designation: 'Employee',
      joiningDate: new Date(), phone: '', workLocation: 'HQ',
    });
  }
  return emp;
};

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { originalName, mimeType, size, data, notes, category } = req.body;
    if (!originalName || !data) {
      res.status(400).json({ success: false, message: 'File name and data are required.' });
      return;
    }

    const emp = await getOrCreateEmp(req.user?._id, req.user?.name, req.user?.email);

    const upload = await Upload.create({
      employee:     emp._id,
      user:         req.user?._id,
      employeeCode: emp.employeeCode,
      employeeName: req.user?.name || `${emp.firstName} ${emp.lastName}`,
      originalName,
      mimeType:     mimeType || 'application/octet-stream',
      size:         size || 0,
      data,
      notes,
      category:     category || 'document',
    });

    res.status(201).json({ success: true, data: upload, message: 'File uploaded successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uploads = await Upload.find({ user: req.user?._id })
      .sort({ uploadedAt: -1 })
      .select('-data'); // exclude base64 from list (only load on demand)
    res.json({ success: true, data: uploads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUploadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const upload = await Upload.findOne({ _id: req.params.id, user: req.user?._id });
    if (!upload) { res.status(404).json({ success: false, message: 'File not found.' }); return; }
    res.json({ success: true, data: upload });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notes, originalName } = req.body;
    const upload = await Upload.findOneAndUpdate(
      { _id: req.params.id, user: req.user?._id },
      { notes, originalName },
      { new: true }
    ).select('-data');
    if (!upload) { res.status(404).json({ success: false, message: 'File not found.' }); return; }
    res.json({ success: true, data: upload });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const upload = await Upload.findOneAndDelete({ _id: req.params.id, user: req.user?._id });
    if (!upload) { res.status(404).json({ success: false, message: 'File not found.' }); return; }
    res.json({ success: true, message: 'File deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin/manager: get all uploads (optionally filtered by dept)
export const getAllUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeCode, category } = req.query;
    const filter: any = {};
    if (employeeCode) filter.employeeCode = employeeCode;
    if (category) filter.category = category;

    // Manager dept scoping
    const dept = (req.user as any)?.department;
    if (dept && req.user?.role === 'manager') {
      const Employee2 = (await import('../models/Employee')).default;
      const Department = (await import('../models/Department')).default;
      const deptDoc = await Department.findOne({ name: dept });
      if (deptDoc) {
        const emps = await Employee2.find({ department: deptDoc._id }).select('_id');
        filter.employee = { $in: emps.map((e: any) => e._id) };
      }
    }

    const uploads = await Upload.find(filter).sort({ uploadedAt: -1 }).select('-data');
    res.json({ success: true, data: uploads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
