import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export interface ApiTask {
  _id: string;
  title: string;
  description?: string;
  assignedTo: { _id: string; firstName: string; lastName: string; employeeCode?: string; department?: { _id: string; name: string } | string } | string;
  assignedBy?: { _id: string; name: string } | string;
  department?: { _id: string; name: string } | string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  hoursWorked?: number;
  hoursEstimated?: number;
  link?: string;
  attachments?: { name: string; size: number; type: string; uploadId?: string }[];
  submittedDescription?: string;
  submittedFiles?: { name: string; size: number; type: string; url?: string; uploadId?: string }[];
  createdAt?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const tasksApi = createApi({
  reducerPath: 'tasksApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Task'],
  endpoints: (builder) => ({
    getTasks: builder.query<ApiTask[], { department?: string; status?: string } | void>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/tasks', params: { limit: 100, ...(arg || {}) } });
        const data = (result.data as { success: boolean; data: ApiTask[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: (result) =>
        result ? [...result.map((t) => ({ type: 'Task' as const, id: t._id })), { type: 'Task' as const, id: 'LIST' }] : [{ type: 'Task' as const, id: 'LIST' }],
    }),
    getMyTasks: builder.query<ApiTask[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/tasks/my');
        const data = (result.data as { success: boolean; data: ApiTask[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Task', id: 'MINE' }],
    }),
    createTask: builder.mutation<ApiTask, { title: string; description?: string; assignedTo: string; dueDate: string; priority: string; hoursEstimated?: number; link?: string; attachments?: { name: string; size: number; type: string; uploadId?: string }[] }>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/tasks', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiTask } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    updateTask: builder.mutation<ApiTask, { id: string; status?: string; hoursWorked?: number; submittedDescription?: string }>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/tasks/${id}`, method: 'PUT', body });
        const saved = (result.data as { success: boolean; data: ApiTask } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Task', id }, { type: 'Task', id: 'LIST' }, { type: 'Task', id: 'MINE' }],
    }),
    // Employees are only authorized to update tasks via /submit — PUT /tasks/:id is admin/manager-only
    // (see apps/api/src/routes/task.ts).
    submitTaskUpdate: builder.mutation<ApiTask, { id: string; status?: string; hoursWorked?: number; submittedDescription?: string; submittedFiles?: { name: string; size: number; type: string; uploadId?: string }[] }>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/tasks/${id}/submit`, method: 'PUT', body });
        const saved = (result.data as { success: boolean; data: ApiTask } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Task', id }, { type: 'Task', id: 'LIST' }, { type: 'Task', id: 'MINE' }],
    }),
    deleteTask: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/tasks/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Task deleted.' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetMyTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useSubmitTaskUpdateMutation,
  useDeleteTaskMutation,
} = tasksApi;
