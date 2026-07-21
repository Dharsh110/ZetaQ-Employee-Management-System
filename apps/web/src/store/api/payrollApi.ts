import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export interface ApiPayroll {
  _id: string;
  // `employee` can be null on legacy/denormalized records — always fall back to the flat
  // employeeCode/employeeName/department fields stored directly on the payroll record.
  employee: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string | null;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: { hra: number; transport: number; medical: number; other: number };
  deductions: { pf: number; tax: number; other: number };
  totalAllowances: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  status: 'pending' | 'processed' | 'paid' | 'failed';
  paidAt?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const payrollApi = createApi({
  reducerPath: 'payrollApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Payroll'],
  endpoints: (builder) => ({
    getPayroll: builder.query<ApiPayroll[], { month?: number; year?: number; department?: string; status?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/payroll', params: { limit: 100, ...(arg || {}) } });
        const data = (result.data as { success: boolean; data: ApiPayroll[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (result) =>
        result ? [...result.map((p) => ({ type: 'Payroll' as const, id: p._id })), { type: 'Payroll' as const, id: 'LIST' }] : [{ type: 'Payroll' as const, id: 'LIST' }],
    }),
    getMyPayslips: builder.query<ApiPayroll[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/payroll/my');
        const data = (result.data as { success: boolean; data: ApiPayroll[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Payroll', id: 'MINE' }],
    }),
    generatePayroll: builder.mutation<ApiPayroll, { employeeId: string; month: number; year: number; basicSalary: number }>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/payroll/generate', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiPayroll } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Payroll', id: 'LIST' }],
    }),
    processPayment: builder.mutation<ApiPayroll, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/payroll/${id}/pay`, method: 'PUT' });
        const saved = (result.data as { success: boolean; data: ApiPayroll } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'Payroll', id }, { type: 'Payroll', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPayrollQuery,
  useGetMyPayslipsQuery,
  useGeneratePayrollMutation,
  useProcessPaymentMutation,
} = payrollApi;
