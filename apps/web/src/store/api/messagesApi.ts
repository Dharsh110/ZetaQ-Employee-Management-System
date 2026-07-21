import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../lib/apiConfig';

export interface ApiMessage {
  _id: string;
  title: string;
  description: string;
  priority: 'normal' | 'urgent' | 'info';
  recipients: string[];
  department?: string;
  link?: string;
  fileName?: string;
  status?: 'sent' | 'delivered' | 'read';
  senderName?: string;
  senderRole?: string;
  createdAt: string;
}

export interface SendMessageInput {
  title: string;
  description: string;
  priority: string;
  recipients: string[];
  department?: string;
  link?: string;
  fileName?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const messagesApi = createApi({
  reducerPath: 'messagesApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['Message'],
  endpoints: (builder) => ({
    getSent: builder.query<ApiMessage[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/messages', params: { type: 'sent' } });
        const data = (result.data as { success: boolean; messages: ApiMessage[] } | undefined)?.messages;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Message', id: 'SENT' }],
    }),
    getInbox: builder.query<ApiMessage[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/messages', params: { type: 'inbox' } });
        const data = (result.data as { success: boolean; messages: ApiMessage[] } | undefined)?.messages;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'Message', id: 'INBOX' }],
    }),
    sendMessage: builder.mutation<ApiMessage, SendMessageInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/messages', method: 'POST', body });
        const saved = (result.data as { success: boolean; message: ApiMessage } | undefined)?.message;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Message', id: 'SENT' }],
    }),
    markMessageRead: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/messages/${id}/read`, method: 'PUT' });
        if (!result.error) return { data: { message: 'Marked read' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Message', id: 'INBOX' }],
    }),
    deleteMessage: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/messages/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Deleted' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'Message', id: 'SENT' }],
    }),
  }),
});

export const {
  useGetSentQuery,
  useGetInboxQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useDeleteMessageMutation,
} = messagesApi;
