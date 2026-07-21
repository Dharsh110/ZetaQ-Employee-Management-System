import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

// Mirrors the shape returned by GET /employees (Mongoose Employee doc, populated department)
export interface ApiEmployee {
  _id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: { _id: string; name: string; code?: string } | string;
  designation: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'inactive' | 'on_leave';
  joiningDate: string;
  salary?: number;
  gender?: string;
  avatar?: string;
  // Flattened server-side from the linked User's role (see getAllEmployees) —
  // used to distinguish managers from regular employees client-side (e.g. the
  // "Manager Attendance" tab's employee-select filter).
  role?: 'employee' | 'manager' | 'admin';
}

export interface CreateEmployeeInput {
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  employmentType: string;
  status: string;
  joiningDate: string;
  salary?: number;
  gender?: string;
  role?: 'employee' | 'manager';
}

export interface NewEmployeeCredentials {
  email: string;
  employeeCode: string;
  tempPassword: string;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & { id: string };

export interface ApiMyProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: { name: string } | string;
  employeeCode?: string;
  joiningDate?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string | { street?: string; city?: string; state?: string; pincode?: string };
  bloodGroup?: string;
  bio?: string;
  avatar?: string;
  skills?: string[];
  emergencyContact?: { name?: string; relation?: string; phone?: string };
  workLocation?: string;
  preferences?: Record<string, any>;
  user?: { name?: string; email?: string; role?: string };
}

export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  avatar?: string;
  skills?: string[];
  emergencyContact?: { name?: string; relation?: string; phone?: string };
  preferences?: Record<string, any>;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const employeesApi = createApi({
  reducerPath: 'employeesApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Employee'],
  endpoints: (builder) => ({
    getEmployees: builder.query<ApiEmployee[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/employees', params: { limit: 1000 } });
        const data = (result.data as { success: boolean; data: ApiEmployee[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (result) =>
        result
          ? [...result.map((e) => ({ type: 'Employee' as const, id: e._id })), { type: 'Employee' as const, id: 'LIST' }]
          : [{ type: 'Employee' as const, id: 'LIST' }],
    }),
    createEmployee: builder.mutation<ApiEmployee & { credentials?: NewEmployeeCredentials }, CreateEmployeeInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/employees', method: 'POST', body });
        const parsed = result.data as { success: boolean; data: ApiEmployee; credentials?: NewEmployeeCredentials } | undefined;
        if (!result.error && parsed?.data) return { data: { ...parsed.data, credentials: parsed.credentials } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }],
    }),
    updateEmployee: builder.mutation<ApiEmployee, UpdateEmployeeInput>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/employees/${id}`, method: 'PUT', body });
        const saved = (result.data as { success: boolean; data: ApiEmployee } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
      ],
    }),
    getMyProfile: builder.query<ApiMyProfile | null, void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/employees/me/profile');
        const data = (result.data as { success: boolean; data: ApiMyProfile | null } | undefined)?.data;
        if (!result.error) return { data: data ?? null };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Employee', id: 'ME' }],
    }),
    updateMyProfile: builder.mutation<ApiMyProfile, UpdateMyProfileInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/employees/me/profile', method: 'PUT', body });
        const saved = (result.data as { success: boolean; data: ApiMyProfile } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Employee', id: 'ME' }],
    }),
    deleteEmployee: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/employees/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Employee deactivated.' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} = employeesApi;
