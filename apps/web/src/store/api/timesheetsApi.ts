import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export type TimesheetStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface ApiTimesheetEntry {
  task: string;
  description?: string;
  timeSpentMinutes: number;
  remarks?: string;
}

export interface ApiTimesheetAuditEntry {
  action: 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'resubmitted';
  by: string;
  at: string;
  note?: string;
}

export interface ApiTimesheet {
  _id: string;
  employee: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string;
  date: string;
  entries: ApiTimesheetEntry[];
  totalMinutes: number;
  status: TimesheetStatus;
  submittedAt?: string;
  approvedBy?: { _id: string; name: string } | string;
  approvedAt?: string;
  rejectionReason?: string;
  auditTrail: ApiTimesheetAuditEntry[];
  createdAt?: string;
}

export interface TimesheetSummary {
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalCount: number;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const timesheetsApi = createApi({
  reducerPath: 'timesheetsApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Timesheet'],
  endpoints: (builder) => ({
    getMyTimesheets: builder.query<ApiTimesheet[], { from?: string; to?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/timesheets/my', params: arg || {} });
        const data = (result.data as { success: boolean; data: ApiTimesheet[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Timesheet', id: 'MINE' }],
    }),
    saveTimesheetDraft: builder.mutation<ApiTimesheet, { date: string; entries: ApiTimesheetEntry[] }>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/timesheets', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiTimesheet } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Timesheet', id: 'MINE' }, { type: 'Timesheet', id: 'LIST' }],
    }),
    submitTimesheet: builder.mutation<ApiTimesheet, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/timesheets/${id}/submit`, method: 'PUT' });
        const saved = (result.data as { success: boolean; data: ApiTimesheet } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Timesheet', id: 'MINE' }, { type: 'Timesheet', id: 'LIST' }],
    }),
    resubmitTimesheet: builder.mutation<ApiTimesheet, { id: string; entries?: ApiTimesheetEntry[] }>({
      queryFn: async ({ id, entries }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/timesheets/${id}/resubmit`, method: 'PUT', body: { entries } });
        const saved = (result.data as { success: boolean; data: ApiTimesheet } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Timesheet', id: 'MINE' }, { type: 'Timesheet', id: 'LIST' }],
    }),
    getAllTimesheets: builder.query<ApiTimesheet[], { status?: string; department?: string; employeeId?: string; from?: string; to?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/timesheets', params: { limit: 200, ...(arg || {}) } });
        const data = (result.data as { success: boolean; data: ApiTimesheet[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Timesheet', id: 'LIST' }],
    }),
    approveTimesheet: builder.mutation<ApiTimesheet, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/timesheets/${id}/approve`, method: 'PUT' });
        const saved = (result.data as { success: boolean; data: ApiTimesheet } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Timesheet', id: 'LIST' }],
    }),
    rejectTimesheet: builder.mutation<ApiTimesheet, { id: string; reason: string }>({
      queryFn: async ({ id, reason }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/timesheets/${id}/reject`, method: 'PUT', body: { reason } });
        const saved = (result.data as { success: boolean; data: ApiTimesheet } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Timesheet', id: 'LIST' }],
    }),
    getTimesheetSummary: builder.query<TimesheetSummary, { from?: string; to?: string; department?: string; employeeId?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/timesheets/summary', params: arg || {} });
        const parsed = result.data as { success: boolean; summary: TimesheetSummary } | undefined;
        if (!result.error && parsed?.summary) return { data: parsed.summary };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Timesheet', id: 'SUMMARY' }],
    }),
  }),
});

export const {
  useGetMyTimesheetsQuery,
  useSaveTimesheetDraftMutation,
  useSubmitTimesheetMutation,
  useResubmitTimesheetMutation,
  useGetAllTimesheetsQuery,
  useApproveTimesheetMutation,
  useRejectTimesheetMutation,
  useGetTimesheetSummaryQuery,
} = timesheetsApi;
