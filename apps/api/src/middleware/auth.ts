import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';

// @types/passport declares a global Express.User = {} and augments Request.user
// with it. Re-declaring `user` as IUser on a separate AuthRequest-extends-Request
// interface makes every route handler's (req: AuthRequest) => ... fail Express's
// RequestHandler assignability check under strict mode, since Express.User isn't
// assignable to IUser. Augmenting the same global Request in place avoids the
// conflict entirely — AuthRequest is now just an alias, so no call sites change.
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export type AuthRequest = Request;

interface JwtPayload {
  id: string;
  role: UserRole;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized. No token.' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await User.findById(decoded.id).select('+password');

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated.' });
      return;
    }

    // User.department is a denormalized string that isn't always kept in sync
    // with the linked Employee's real department (e.g. accounts created before
    // that field was populated at signup time). Every controller's manager
    // department-scoping reads req.user.department, so backfill it here from
    // the authoritative Employee record rather than fixing each controller.
    if (!user.department && user.employeeId) {
      const Employee = (await import('../models/Employee')).default;
      const emp = await Employee.findById(user.employeeId).populate('department', 'name');
      const deptName = emp?.department && typeof emp.department === 'object' ? (emp.department as any).name : '';
      if (deptName) user.department = deptName;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized for this action.`,
      });
      return;
    }
    next();
  };
};
