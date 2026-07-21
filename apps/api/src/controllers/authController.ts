import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/auth';
import { sendEmail, resetPasswordEmailHtml } from '../utils/email';

const signToken = (id: string, role: string): string =>
  jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

const sendAuthResponse = (res: Response, statusCode: number, user: any, token: string) => {
  const { password: _pw, ...safeUser } = user.toObject ? user.toObject() : user;
  res.status(statusCode).json({ success: true, token, user: safeUser });
};

const generateEmpCode = async (role: string): Promise<string> => {
  const prefix = role === 'admin' ? 'ADM' : role === 'manager' ? 'MGR' : 'EMP';
  const count = await Employee.countDocuments();
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    // Accepts either a real email or an Employee ID (e.g. "EMP004") in the same field —
    // resolve the ID to its linked User account before the password check.
    let loginQuery: any = { email };
    if (!String(email).includes('@')) {
      const empByCode = await Employee.findOne({ employeeCode: String(email).trim().toUpperCase() }).select('user');
      loginQuery = empByCode ? { _id: empByCode.user } : { _id: null };
    }

    const user = await User.findOne(loginQuery).select('+password');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found.' });
      return;
    }
    if (!(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    }

    if (role && user.role !== role) {
      res.status(403).json({ success: false, message: `Access denied for role: ${role}` });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated.' });
      return;
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Auto-create Employee record if missing (handles accounts created when DB was down)
    let empDoc = user.employeeId ? await Employee.findById(user.employeeId) : null;
    if (!empDoc) {
      empDoc = await Employee.findOne({ user: user._id });
    }
    if (!empDoc) {
      try {
        const [firstName, ...rest] = (user.name || email).trim().split(' ');
        const lastName = rest.join(' ') || '-';
        const empCode = await generateEmpCode(user.role);
        const desig = user.role === 'admin' ? 'Administrator' : user.role === 'manager' ? 'Manager' : 'Employee';
        empDoc = await Employee.create({
          employeeCode: empCode,
          user: user._id,
          firstName, lastName,
          email: user.email,
          designation: desig,
          joiningDate: user.createdAt || new Date(),
          phone: '',
          workLocation: 'HQ',
        });
        user.employeeId = empDoc._id as any;
        await user.save({ validateBeforeSave: false });
      } catch {}
    }

    let employeeData = null;
    if (empDoc) {
      employeeData = await Employee.findById(empDoc._id)
        .populate('department', 'name code')
        .select('firstName lastName employeeCode designation department avatar');
    }

    const token = signToken(String(user._id), user.role);
    const { password: _pw, ...safeUser } = user.toObject();

    res.status(200).json({
      success: true,
      token,
      user: { ...safeUser, employee: employeeData },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    let employee = null;
    if (user.employeeId) {
      employee = await Employee.findById(user.employeeId)
        .populate('department', 'name code')
        .populate('reportingTo', 'firstName lastName');
    }
    res.status(200).json({ success: true, user: { ...user.toObject(), employee } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// SMTP credentials in .env are unset/placeholder ("your_mailtrap_user" etc.) until an
// operator supplies real ones — treat that as "email service not configured" rather than
// letting nodemailer's auth error bubble up as an opaque failure on every request.
const isSmtpConfigured = (): boolean => {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  return !!user && !!pass && !user.startsWith('your_') && !pass.startsWith('your_');
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    if (isSmtpConfigured()) {
      try {
        await sendEmail({
          to: user.email,
          subject: 'ZetaQ EMS — Password Reset Request',
          html: resetPasswordEmailHtml(user.name, resetUrl),
        });
        res.status(200).json({ success: true, message: 'Password reset link sent to your email.' });
        return;
      } catch (mailErr) {
        console.error('Password reset email failed to send:', mailErr);
        // fall through — dev environments still get a usable link below
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📧 [DEV] SMTP not configured — password reset link for ${user.email}:\n${resetUrl}\n`);
      res.status(200).json({
        success: true,
        message: 'Email service is not configured in this environment. Reset link generated — see server console, or use the link below.',
        devResetUrl: resetUrl,
      });
      return;
    }

    res.status(500).json({ success: false, message: 'Could not send email. Try again later.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const authToken = signToken(String(user._id), user.role);
    sendAuthResponse(res, 200, user, authToken);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    res.status(200).json({ success: true, message: 'Password updated successfully.', passwordChangedAt: user.passwordChangedAt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = (_req: AuthRequest, res: Response): void => {
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// Google OAuth temporarily disabled — uncomment to re-enable, and the route in routes/auth.ts
// export const googleCallback = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { googleId, email, name } = req.body as { googleId: string; email: string; name: string };
//     if (!googleId || !email) {
//       res.status(400).json({ success: false, message: 'Missing Google profile data.' });
//       return;
//     }
//
//     const user = await User.findOne({ $or: [{ googleId }, { email }] });
//
//     // No self-service account creation — Google sign-in only links/authenticates
//     // an account an admin has already provisioned.
//     if (!user) {
//       res.status(404).json({ success: false, message: 'No account found for this Google email. Ask your administrator to set up your account first.' });
//       return;
//     }
//     if (!user.googleId) {
//       user.googleId = googleId;
//       await user.save({ validateBeforeSave: false });
//     }
//
//     if (!user.isActive) {
//       res.status(403).json({ success: false, message: 'Account is deactivated.' });
//       return;
//     }
//
//     const token = signToken(String(user._id), user.role);
//     const { password: _pw, ...safeUser } = user.toObject();
//     res.status(200).json({ success: true, token, user: safeUser });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
