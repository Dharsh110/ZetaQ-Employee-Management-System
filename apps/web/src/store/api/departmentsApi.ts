import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export interface ApiDepartment {
  _id: string;
  name: string;
  code: string;
  head?: { _id: string; firstName: string; lastName: string } | string | null;
  location: string;
  description?: string;
  isActive: boolean;
  employeeCount?: number;
  createdAt?: string;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  location?: string;
  description?: string;
  head?: string;
  // New login email for the selected head, only used when they aren't already a
  // manager (i.e. this promotes them) — leave blank to keep their existing email.
  headEmail?: string;
}
export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & { id: string; isActive?: boolean };

// Returned only when setting `head` actually promoted a non-manager employee —
// same shape as employeesApi's NewEmployeeCredentials, duplicated locally to keep
// each API slice's types self-contained.
export interface NewManagerCredentials {
  email: string;
  employeeCode: string;
  tempPassword: string;
}

export interface DepartmentSaveResult {
  department: ApiDepartment;
  credentials?: NewManagerCredentials;
  headError?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const departmentsApi = createApi({
  reducerPath: 'departmentsApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Department'],
  endpoints: (builder) => ({
    getDepartments: builder.query<ApiDepartment[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/departments');
        const data = (result.data as { success: boolean; data: ApiDepartment[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (result) =>
        result
          ? [...result.map((d) => ({ type: 'Department' as const, id: d._id })), { type: 'Department' as const, id: 'LIST' }]
          : [{ type: 'Department' as const, id: 'LIST' }],
    }),
    createDepartment: builder.mutation<DepartmentSaveResult, CreateDepartmentInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/departments', method: 'POST', body });
        const parsed = result.data as { success: boolean; data: ApiDepartment; credentials?: NewManagerCredentials; headError?: string } | undefined;
        if (!result.error && parsed?.data) return { data: { department: parsed.data, credentials: parsed.credentials, headError: parsed.headError } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),
    updateDepartment: builder.mutation<DepartmentSaveResult, UpdateDepartmentInput>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/departments/${id}`, method: 'PUT', body });
        const parsed = result.data as { success: boolean; data: ApiDepartment; credentials?: NewManagerCredentials } | undefined;
        if (!result.error && parsed?.data) return { data: { department: parsed.data, credentials: parsed.credentials } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Department', id }, { type: 'Department', id: 'LIST' }],
    }),
    deleteDepartment: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/departments/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Department deactivated.' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} = departmentsApi;
