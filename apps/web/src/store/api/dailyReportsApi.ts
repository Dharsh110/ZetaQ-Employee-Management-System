import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export interface ApiFileAttachment { name: string; type: string; size: number; url?: string; uploadId?: string; data?: string }
export interface ApiComment { id: string; by: string; role?: string; text: string; at: string }

interface RawComment { _id: string; authorName: string; authorRole?: string; text: string; createdAt: string }

// Must match the backend DailyReport model's status enum exactly (apps/api/src/models/DailyReport.ts)
export type DailyReportStatus = 'in_progress' | 'completed' | 'blocked' | 'pending_review';

export interface ApiDailyReport {
  _id: string;
  employee?: { _id: string; firstName: string; lastName: string; department?: { name: string } | string } | string;
  empCode?: string;
  empName?: string;
  department?: string;
  date: string;
  taskTitle?: string;
  description?: string;
  hoursWorked?: number;
  status?: DailyReportStatus;
  recipients?: string[];
  link?: string;
  achievements?: string;
  challenges?: string;
  nextPlan?: string;
  mood?: 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
  files?: ApiFileAttachment[];
  comments?: ApiComment[];
  submittedAt?: string;
  createdAt?: string;
}

export interface CreateDailyReportInput {
  empCode?: string;
  empName?: string;
  department?: string;
  date: string;
  taskTitle: string;
  description: string;
  achievements?: string;
  challenges?: string;
  nextPlan?: string;
  mood?: 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
  hoursWorked: number;
  status: DailyReportStatus;
  recipients: string[];
  link?: string;
  files?: ApiFileAttachment[];
}

export type UpdateDailyReportInput = Partial<CreateDailyReportInput> & { id: string };

interface RawDailyReport extends Omit<ApiDailyReport, 'comments'> {
  comments?: RawComment[];
}

const mapComments = (comments?: RawComment[]): ApiComment[] =>
  (comments || []).map((c) => ({ id: c._id, by: c.authorName, role: c.authorRole, text: c.text, at: c.createdAt }));

const mapReport = (r: RawDailyReport): ApiDailyReport => ({ ...r, comments: mapComments(r.comments) });

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const dailyReportsApi = createApi({
  reducerPath: 'dailyReportsApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['DailyReport'],
  endpoints: (builder) => ({
    getDailyReports: builder.query<ApiDailyReport[], { department?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/daily-reports', params: arg || {} });
        const reports = (result.data as { success: boolean; reports: RawDailyReport[] } | undefined)?.reports;
        if (!result.error && Array.isArray(reports)) return { data: reports.map(mapReport) };
        return { data: [] };
      },
      providesTags: [{ type: 'DailyReport', id: 'LIST' }],
    }),
    getMyDailyReports: builder.query<ApiDailyReport[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/daily-reports/mine');
        const reports = (result.data as { success: boolean; reports: RawDailyReport[] } | undefined)?.reports;
        if (!result.error && Array.isArray(reports)) return { data: reports.map(mapReport) };
        return { data: [] };
      },
      providesTags: [{ type: 'DailyReport', id: 'MINE' }],
    }),
    createDailyReport: builder.mutation<ApiDailyReport, CreateDailyReportInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/daily-reports', method: 'POST', body });
        const report = (result.data as { success: boolean; report: RawDailyReport } | undefined)?.report;
        if (!result.error && report) return { data: mapReport(report) };
        if (result.error) return { error: result.error };
        return { error: { status: 'CUSTOM_ERROR', error: 'Failed to submit report' } as any };
      },
      invalidatesTags: [{ type: 'DailyReport', id: 'LIST' }, { type: 'DailyReport', id: 'MINE' }],
    }),
    updateDailyReport: builder.mutation<ApiDailyReport, UpdateDailyReportInput>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/daily-reports/${id}`, method: 'PUT', body });
        const report = (result.data as { success: boolean; report: RawDailyReport } | undefined)?.report;
        if (!result.error && report) return { data: mapReport(report) };
        if (result.error) return { error: result.error };
        return { error: { status: 'CUSTOM_ERROR', error: 'Failed to update report' } as any };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'DailyReport', id }, { type: 'DailyReport', id: 'LIST' }, { type: 'DailyReport', id: 'MINE' }],
    }),
    deleteDailyReport: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/daily-reports/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Report deleted.' } };
        return { error: result.error };
      },
      invalidatesTags: [{ type: 'DailyReport', id: 'LIST' }, { type: 'DailyReport', id: 'MINE' }],
    }),
    addDailyReportComment: builder.mutation<ApiDailyReport, { id: string; text: string }>({
      queryFn: async ({ id, text }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/daily-reports/${id}/comments`, method: 'POST', body: { text } });
        const report = (result.data as { success: boolean; report: RawDailyReport } | undefined)?.report;
        if (!result.error && report) return { data: mapReport(report) };
        if (result.error) return { error: result.error };
        return { error: { status: 'CUSTOM_ERROR', error: 'Failed to add comment' } as any };
      },
      invalidatesTags: [{ type: 'DailyReport', id: 'LIST' }, { type: 'DailyReport', id: 'MINE' }],
    }),
  }),
});

export const {
  useGetDailyReportsQuery,
  useGetMyDailyReportsQuery,
  useCreateDailyReportMutation,
  useUpdateDailyReportMutation,
  useDeleteDailyReportMutation,
  useAddDailyReportCommentMutation,
} = dailyReportsApi;
