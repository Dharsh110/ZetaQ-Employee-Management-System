import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiUpload {
  _id: string;
  employee: string;
  user: string;
  employeeCode: string;
  employeeName: string;
  originalName: string;
  mimeType: string;
  size: number;
  data?: string; // base64 — omitted from list responses, fetched on demand via getUploadById
  notes?: string;
  category: 'document' | 'image' | 'report' | 'other';
  uploadedAt: string;
  createdAt?: string;
}

export interface UploadFileInput {
  originalName: string;
  mimeType: string;
  size: number;
  data: string; // base64
  notes?: string;
  category?: string;
}

export interface UpdateUploadInput {
  id: string;
  originalName?: string;
  notes?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const uploadsApi = createApi({
  reducerPath: 'uploadsApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Upload'],
  endpoints: (builder) => ({
    getMyUploads: builder.query<ApiUpload[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/uploads/my');
        const data = (result.data as { success: boolean; data: ApiUpload[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { data: [] };
      },
      providesTags: (result) =>
        result ? [...result.map((u) => ({ type: 'Upload' as const, id: u._id })), { type: 'Upload' as const, id: 'MINE' }] : [{ type: 'Upload' as const, id: 'MINE' }],
    }),
    // The list endpoint excludes `data` (base64) for performance — fetch the full record
    // on demand only when actually viewing/downloading a file (see apps/api/src/controllers/uploadController.ts).
    getUploadById: builder.query<ApiUpload | null, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery(`/uploads/${id}`);
        const data = (result.data as { success: boolean; data: ApiUpload } | undefined)?.data;
        if (!result.error && data) return { data };
        if (result.error) return { error: result.error };
        return { data: null };
      },
      providesTags: (_r, _e, id) => [{ type: 'Upload', id }],
    }),
    uploadFile: builder.mutation<ApiUpload, UploadFileInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/uploads', method: 'POST', body });
        const data = (result.data as { success: boolean; data: ApiUpload } | undefined)?.data;
        if (!result.error && data) return { data };
        if (result.error) return { error: result.error };
        return { error: { status: 'CUSTOM_ERROR', error: 'Upload failed' } as any };
      },
      invalidatesTags: [{ type: 'Upload', id: 'MINE' }],
    }),
    updateUpload: builder.mutation<ApiUpload, UpdateUploadInput>({
      queryFn: async ({ id, ...body }, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/uploads/${id}`, method: 'PUT', body });
        const data = (result.data as { success: boolean; data: ApiUpload } | undefined)?.data;
        if (!result.error && data) return { data };
        if (result.error) return { error: result.error };
        return { error: { status: 'CUSTOM_ERROR', error: 'Update failed' } as any };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Upload', id }, { type: 'Upload', id: 'MINE' }],
    }),
    deleteUpload: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/uploads/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'File deleted.' } };
        return { error: result.error };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'Upload', id }, { type: 'Upload', id: 'MINE' }],
    }),
  }),
});

export const {
  useGetMyUploadsQuery,
  useLazyGetUploadByIdQuery,
  useUploadFileMutation,
  useUpdateUploadMutation,
  useDeleteUploadMutation,
} = uploadsApi;
