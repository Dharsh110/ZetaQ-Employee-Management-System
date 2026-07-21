import axios from 'axios';
import { API_BASE_URL } from '../lib/apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ems_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ems_token');
      localStorage.removeItem('ems_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data: { email: string; password: string; role?: string }) => api.post('/auth/login', data),
  getMe:          () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token: string, password: string) => api.put(`/auth/reset-password/${token}`, { password }),
  changePassword: (currentPassword: string, newPassword: string) => api.put('/auth/change-password', { currentPassword, newPassword }),
  logout:         () => api.post('/auth/logout'),
};

// ─── Employees ───────────────────────────────────────────────────────────────
export const employeeAPI = {
  getAll:          (params?: object) => api.get('/employees', { params }),
  getById:         (id: string) => api.get(`/employees/${id}`),
  create:          (data: object) => api.post('/employees', data),
  update:          (id: string, data: object) => api.put(`/employees/${id}`, data),
  delete:          (id: string) => api.delete(`/employees/${id}`),
  getMyProfile:    () => api.get('/employees/me/profile'),
  updateMyProfile: (data: object) => api.put('/employees/me/profile', data),
  getStats:        () => api.get('/employees/stats'),
};

// ─── Departments ─────────────────────────────────────────────────────────────
export const departmentAPI = {
  getAll:  () => api.get('/departments'),
  create:  (data: object) => api.post('/departments', data),
  update:  (id: string, data: object) => api.put(`/departments/${id}`, data),
  delete:  (id: string) => api.delete(`/departments/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendanceAPI = {
  checkIn:          () => api.post('/attendance/check-in'),
  checkOut:         () => api.post('/attendance/check-out'),
  getMyAttendance:  (params?: object) => api.get('/attendance/my', { params }),
  getToday:         () => api.get('/attendance/today'),
  getMonthlyReport: (params?: object) => api.get('/attendance/monthly-report', { params }),
  markAttendance:   (data: object) => api.post('/attendance/mark', data),
};

// ─── Leaves ──────────────────────────────────────────────────────────────────
export const leaveAPI = {
  apply:        (data: object) => api.post('/leaves', data),
  getMyLeaves:  (params?: object) => api.get('/leaves/my', { params }),
  getAll:       (params?: object) => api.get('/leaves', { params }),
  // status = 'approved' | 'rejected', reason optional
  updateStatus: (id: string, status: string, reason?: string) =>
    api.put(`/leaves/${id}/status`, { status, rejectionReason: reason }),
  cancel:       (id: string) => api.delete(`/leaves/${id}/cancel`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const taskAPI = {
  create:       (data: object) => api.post('/tasks', data),
  getAll:       (params?: object) => api.get('/tasks', { params }),
  getMyTasks:   (params?: object) => api.get('/tasks/my', { params }),
  update:       (id: string, data: object) => api.put(`/tasks/${id}`, data),
  // employee submits work update
  submitUpdate: (id: string, data: object) => api.put(`/tasks/${id}/submit`, data),
  addComment:   (id: string, text: string) => api.post(`/tasks/${id}/comments`, { text }),
  delete:       (id: string) => api.delete(`/tasks/${id}`),
};

// ─── Payroll ──────────────────────────────────────────────────────────────────
export const payrollAPI = {
  generate:       (data: object) => api.post('/payroll/generate', data),
  getAll:         (params?: object) => api.get('/payroll', { params }),
  getMyPayslips:  () => api.get('/payroll/my'),
  processPayment: (id: string) => api.put(`/payroll/${id}/pay`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportAPI = {
  getSummary: (params?: object) => api.get('/reports/summary', { params }),
  download:   (params?: object) => api.get('/reports/download', { params, responseType: 'blob' as const }),
};

// ─── Daily Reports ───────────────────────────────────────────────────────────
export const dailyReportAPI = {
  create:    (data: object) => api.post('/daily-reports', data),
  getMine:   () => api.get('/daily-reports/mine'),
  getAll:    (params?: object) => api.get('/daily-reports', { params }),
  update:    (id: string, data: object) => api.put(`/daily-reports/${id}`, data),
  delete:    (id: string) => api.delete(`/daily-reports/${id}`),
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const messageAPI = {
  send:     (data: object) => api.post('/messages', data),
  getSent:  () => api.get('/messages', { params: { type: 'sent' } }),
  getInbox: () => api.get('/messages', { params: { type: 'inbox' } }),
  getAll:   (params?: object) => api.get('/messages', { params }),
  markRead: (id: string) => api.put(`/messages/${id}/read`),
  delete:   (id: string) => api.delete(`/messages/${id}`),
};

// ─── Calendar ────────────────────────────────────────────────────────────────
export const calendarAPI = {
  getEvents:   (params?: object) => api.get('/calendar', { params }),
  createEvent: (data: object) => api.post('/calendar', data),
  updateEvent: (id: string, data: object) => api.put(`/calendar/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/calendar/${id}`),
};

// ─── Uploads ─────────────────────────────────────────────────────────────────
export const uploadAPI = {
  upload:    (data: object) => api.post('/uploads', data),
  getMine:   () => api.get('/uploads/my'),
  getById:   (id: string) => api.get(`/uploads/${id}`),
  update:    (id: string, data: object) => api.put(`/uploads/${id}`, data),
  delete:    (id: string) => api.delete(`/uploads/${id}`),
  getAll:    (params?: object) => api.get('/uploads', { params }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll:     () => api.get('/notifications'),
  markRead:   (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead:() => api.put('/notifications/read-all'),
  delete:     (id: string) => api.delete(`/notifications/${id}`),
};
