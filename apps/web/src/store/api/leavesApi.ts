import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiLeave {
  _id: string;
  employee: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string;
  leaveType: 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'half_day' | 'unpaid';
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason?: string;
  appliedAt?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const leavesApi = createApi({
  reducerPath: 'leavesApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Leave'],
  endpoints: (builder) => ({
    getLeaves: builder.query<ApiLeave[], { department?: string; status?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/leaves', params: { limit: 100, ...(arg || {}) } });
        const data = (result.data as { success: boolean; data: ApiLeave[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (result) =>
        result ? [...result.map((l) => ({ type: 'Leave' as const, id: l._id })), { type: 'Leave' as const, id: 'LIST' }] : [{ type: 'Leave' as const, id: 'LIST' }],
    }),
    getMyLeaves: builder.query<ApiLeave[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/leaves/my');
        const data = (result.data as { success: boolean; data: ApiLeave[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Leave', id: 'MINE' }],
    }),
    applyLeave: builder.mutation<ApiLeave, { leaveType: string; fromDate: string; toDate: string; totalDays: number; reason: string }>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/leaves', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiLeave } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Leave', id: 'LIST' }, { type: 'Leave', id: 'MINE' }],
    }),
    updateLeaveStatus: builder.mutation<ApiLeave, { id: string; status: 'approved' | 'rejected'; reason?: string }>({
      queryFn: async ({ id, status, reason }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/leaves/${id}/status`, method: 'PUT', body: { status, rejectionReason: reason } });
        const saved = (result.data as { success: boolean; data: ApiLeave } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Leave', id }, { type: 'Leave', id: 'LIST' }, { type: 'Leave', id: 'MINE' }],
    }),
    cancelLeave: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/leaves/${id}/cancel`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Leave cancelled.' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Leave', id: 'LIST' }, { type: 'Leave', id: 'MINE' }],
    }),
  }),
});

export const {
  useGetLeavesQuery,
  useGetMyLeavesQuery,
  useApplyLeaveMutation,
  useUpdateLeaveStatusMutation,
  useCancelLeaveMutation,
} = leavesApi;
