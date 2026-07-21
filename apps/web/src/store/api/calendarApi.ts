import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiCalendarEvent {
  _id: string;
  title: string;
  type: 'holiday' | 'meeting' | 'reminder' | 'deadline' | 'company_event' | 'birthday';
  startDate: string;
  endDate?: string;
  visibleTo?: 'all' | 'admin' | 'manager' | 'employee';
  description?: string;
}

export interface CreateEventInput {
  title: string;
  type: string;
  startDate: string;
  endDate?: string;
  visibleTo?: string;
  description?: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('ems_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const calendarApi = createApi({
  reducerPath: 'calendarApi',
  baseQuery: rawBaseQuery,
  tagTypes: ['CalendarEvent'],
  endpoints: (builder) => ({
    getEvents: builder.query<ApiCalendarEvent[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery('/calendar');
        const data = (result.data as { success: boolean; data: ApiCalendarEvent[] } | undefined)?.data;
        if (!result.error && Array.isArray(data)) return { data };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      providesTags: [{ type: 'CalendarEvent', id: 'LIST' }],
    }),
    createEvent: builder.mutation<ApiCalendarEvent, CreateEventInput>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: '/calendar', method: 'POST', body });
        const saved = (result.data as { success: boolean; data: ApiCalendarEvent } | undefined)?.data;
        if (!result.error && saved) return { data: saved };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'CalendarEvent', id: 'LIST' }],
    }),
    deleteEvent: builder.mutation<{ message: string }, string>({
      queryFn: async (id, _api, _extra, baseQuery) => {
        const result = await baseQuery({ url: `/calendar/${id}`, method: 'DELETE' });
        if (!result.error) return { data: { message: 'Deleted' } };
        return { error: result.error ?? { status: 'CUSTOM_ERROR', error: 'Unexpected response from server' } };
      },
      invalidatesTags: [{ type: 'CalendarEvent', id: 'LIST' }],
    }),
  }),
});

export const { useGetEventsQuery, useCreateEventMutation, useDeleteEventMutation } = calendarApi;
