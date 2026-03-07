import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Calendar {
  calendarId: string;
  name: string;
  description: string;
  createdAt: string;
  publicToken?: string;
}

export interface CalendarEvent {
  eventId: string;
  calendarId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  color?: string;
  recurrence?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  private headers() {
    return from(this.auth.getToken()).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return [headers];
      }),
    );
  }

  getCalendars() {
    return this.headers().pipe(
      switchMap((headers) =>
        this.http.get<Calendar[]>(`${this.apiUrl}/calendars`, { headers }),
      ),
    );
  }

  createCalendar(name: string, description: string) {
    return this.headers().pipe(
      switchMap((headers) =>
        this.http.post<Calendar>(
          `${this.apiUrl}/calendars`,
          { name, description },
          { headers },
        ),
      ),
    );
  }

  publishCalendar(calendarId: string) {
    return this.headers().pipe(
      switchMap((headers) =>
        this.http.post<{ token: string }>(
          `${this.apiUrl}/public/calendars/${calendarId}/publish`,
          {},
          { headers },
        ),
      ),
    );
  }

  getEvents(calendarId: string) {
    return this.headers().pipe(
      switchMap((headers) =>
        this.http.get<CalendarEvent[]>(
          `${this.apiUrl}/calendars/${calendarId}/events`,
          { headers },
        ),
      ),
    );
  }

  createEvent(
    calendarId: string,
    event: {
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      color?: string;
      recurrence?: string;
    },
  ) {
    return this.headers().pipe(
      switchMap((headers) =>
        this.http.post<CalendarEvent>(
          `${this.apiUrl}/calendars/${calendarId}/events`,
          event,
          { headers },
        ),
      ),
    );
  }
}
