import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiAttendance {
  _id: string;
  employee: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  overtimeHours?: number;
  // Sourced only from the APPROVED timesheet for the same employee+date — kept
  // separate from clock-based totalHours per the attendance/timesheet spec.
  // null/undefined means no approved timesheet exists for that day yet.
  officialWorkMinutes?: number | null;
  status: 'present' | 'absent' | 'leave' | 'half_day' | 'holiday' | 'weekend';
  isLate: boolean;
  lateByMinutes?: number;
  notes?: string;
}

// Shape returned by /attendance/monthly-report: ONE pre-aggregated row per employee
// for the requested month (not a per-day record) — distinct from ApiAttendance, which
// is a flat daily record. Mixing these up silently zeroes out every consumer that reads
// per-day fields (status/isLate/checkIn) off these rows, since none of those exist here.
export interface MonthlyAttendanceRow {
  employee: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  late: number;
  totalHours: number;
  overtimeHours: number;
  officialWorkMinutes?: number | null;
}

export interface AttendanceSummary {
  totalEmployees?: number;
  present: number;
  absent: number;
  late: number;
  onLeave?: number;
}

function summarize(list: ApiAttendance[]): AttendanceSummary {
  return {
    totalEmployees: list.length,
    present: list.filter((a) => a.status === 'present' || a.status === 'half_day').length,
    absent: list.filter((a) => a.status === 'absent').length,
    late: list.filter((a) => a.isLate).length,
    onLeave: list.filter((a) => a.status === 'leave').length,
  };
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const attendanceApi = createApi({
  reducerPath: 'attendanceApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Attendance'],
  endpoints: (builder) => ({
    getToday: builder.query<{ records: ApiAttendance[]; summary: AttendanceSummary }, { date?: string; role?: 'manager' | 'employee' } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const params: Record<string, string> = {};
        if (arg?.date) params.date = arg.date;
        if (arg?.role) params.role = arg.role;
        const result = await baseQuery({ url: '/attendance/today', params: Object.keys(params).length ? params : undefined });
        const body = result.data as { success: boolean; data: ApiAttendance[]; summary?: AttendanceSummary } | undefined;
        if (!result.error && body?.data) return { data: { records: body.data, summary: body.summary || summarize(body.data) } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (_result, _error, arg) => [{ type: 'Attendance', id: `${arg?.date || 'TODAY'}-${arg?.role || 'all'}` }],
    }),
    getMonthlyReport: builder.query<MonthlyAttendanceRow[], { month: number; year: number; department?: string; role?: 'manager' | 'employee' }>({
      queryFn: async ({ month, year, department, role }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/monthly-report', params: { month, year, department, role } });
        const data = (result.data as { success: boolean; data: MonthlyAttendanceRow[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Attendance', id: 'MONTHLY' }],
    }),
    // Flat list of individual daily records (not the monthly aggregate from getMonthlyReport)
    // — used by report pages needing real dates/check-in-out for Today/Week/Month/Year filtering.
    getAllAttendance: builder.query<ApiAttendance[], { department?: string; role?: 'manager' | 'employee'; from?: string; to?: string; limit?: number } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/records', params: arg || {} });
        const data = (result.data as { success: boolean; data: ApiAttendance[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Attendance', id: 'RECORDS' }],
    }),
    getAttendanceTrend: builder.query<{ month: string; year: number; present: number; absent: number; late: number; leaves: number }[], { months?: number } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const MOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const count = arg?.months ?? 6;
        const now = new Date();
        const targets = Array.from({ length: count }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
          return { month: d.getMonth() + 1, year: d.getFullYear() };
        });
        const results = await Promise.all(targets.map((t) => baseQuery({ url: '/attendance/monthly-report', params: t })));
        const rows = results.map((result, i) => {
          // Each row here is already a per-employee monthly aggregate (present/absent/late
          // as counts), not a per-day record — sum across employees, don't re-filter by status.
          const data = (result.data as { success: boolean; data: MonthlyAttendanceRow[] } | undefined)?.data || [];
          return {
            month: MOS[targets[i].month - 1],
            year: targets[i].year,
            present: data.reduce((s, a) => s + (a.present || 0) + (a.halfDay || 0), 0),
            absent: data.reduce((s, a) => s + (a.absent || 0), 0),
            late: data.reduce((s, a) => s + (a.late || 0), 0),
            leaves: data.reduce((s, a) => s + (a.leave || 0), 0),
          };
        });
        return { data: rows };
      },
      providesTags: [{ type: 'Attendance', id: 'TREND' }],
    }),
    getMyAttendance: builder.query<ApiAttendance[], { month?: number; year?: number } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/my', params: arg || {} });
        const data = (result.data as { success: boolean; data: ApiAttendance[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Attendance', id: 'MINE' }],
    }),
    checkIn: builder.mutation<ApiAttendance, void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/check-in', method: 'POST' });
        const saved = (result.data as { success: boolean; data: ApiAttendance } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Attendance', id: 'MINE' }, { type: 'Attendance', id: 'TODAY' }],
    }),
    checkOut: builder.mutation<ApiAttendance, void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/check-out', method: 'POST' });
        const saved = (result.data as { success: boolean; data: ApiAttendance } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Attendance', id: 'MINE' }, { type: 'Attendance', id: 'TODAY' }],
    }),
    markAttendance: builder.mutation<ApiAttendance, { employeeId: string; status: string; date?: string }>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/attendance/mark', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiAttendance } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Attendance', id: 'TODAY' }, { type: 'Attendance', id: 'MONTHLY' }],
    }),
  }),
});

export const {
  useGetTodayQuery,
  useGetMonthlyReportQuery,
  useGetAllAttendanceQuery,
  useGetAttendanceTrendQuery,
  useGetMyAttendanceQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useMarkAttendanceMutation,
} = attendanceApi;
