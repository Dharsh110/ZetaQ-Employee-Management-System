import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
};

export const resetPasswordEmailHtml = (name: string, resetUrl: string): string => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1a4fd6,#0d3099);padding:32px;text-align:center;">
      <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <span style="color:#fff;font-size:22px;">🏢</span>
      </div>
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:600;">ZetaQ EMS</h1>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Reset your password</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">Hi ${name}, we received a request to reset your password. Click the button below to create a new password. This link expires in <strong>30 minutes</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="background:#1a4fd6;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">Reset password</a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Or copy this link: <span style="color:#1a4fd6;">${resetUrl}</span></p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">© 2026 ZetaQ Technologies. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

export const welcomeEmailHtml = (name: string, role: string, tempPassword: string): string => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1a4fd6,#0d3099);padding:32px;text-align:center;">
      <h1 style="color:#fff;font-size:20px;margin:0;">Welcome to ZetaQ EMS</h1>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Hello, ${name}!</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.6;">Your account has been created. Here are your login credentials:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>Role:</strong> ${role}</p>
        <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>Temporary Password:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${tempPassword}</span></p>
      </div>
      <p style="color:#ef4444;font-size:13px;">Please change your password after your first login.</p>
    </div>
  </div>
</body>
</html>`;
