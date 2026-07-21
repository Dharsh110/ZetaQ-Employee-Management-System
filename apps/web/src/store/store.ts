import { configureStore } from '@reduxjs/toolkit';
import { employeesApi } from './api/employeesApi';
import { departmentsApi } from './api/departmentsApi';
import { attendanceApi } from './api/attendanceApi';
import { leavesApi } from './api/leavesApi';
import { tasksApi } from './api/tasksApi';
import { payrollApi } from './api/payrollApi';
import { messagesApi } from './api/messagesApi';
import { dailyReportsApi } from './api/dailyReportsApi';
import { calendarApi } from './api/calendarApi';
import { uploadsApi } from './api/uploadsApi';
import { timesheetsApi } from './api/timesheetsApi';

// This store runs alongside the existing Zustand + TanStack Query setup —
// it now powers the Admin, Manager, and Employee portals (Employees, Departments,
// Attendance, Leaves, Tasks, Payroll, Messages, Daily Reports, Calendar, Uploads).
// Other modules keep using the existing state/data-fetching stack untouched.
export const store = configureStore({
  reducer: {
    [employeesApi.reducerPath]: employeesApi.reducer,
    [departmentsApi.reducerPath]: departmentsApi.reducer,
    [attendanceApi.reducerPath]: attendanceApi.reducer,
    [leavesApi.reducerPath]: leavesApi.reducer,
    [tasksApi.reducerPath]: tasksApi.reducer,
    [payrollApi.reducerPath]: payrollApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    [dailyReportsApi.reducerPath]: dailyReportsApi.reducer,
    [calendarApi.reducerPath]: calendarApi.reducer,
    [uploadsApi.reducerPath]: uploadsApi.reducer,
    [timesheetsApi.reducerPath]: timesheetsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      employeesApi.middleware,
      departmentsApi.middleware,
      attendanceApi.middleware,
      leavesApi.middleware,
      tasksApi.middleware,
      payrollApi.middleware,
      messagesApi.middleware,
      dailyReportsApi.middleware,
      calendarApi.middleware,
      uploadsApi.middleware,
      timesheetsApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
