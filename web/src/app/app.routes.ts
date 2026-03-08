import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-view/calendar-view.component').then(
            (m) => m.CalendarViewComponent,
          ),
      },
      {
        path: 'calendars/:calendarId/events',
        loadComponent: () =>
          import('./features/events/event-list/event-list.component').then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: 'public/:token',
        loadComponent: () =>
          import('./features/public/public-calendar/public-calendar.component').then(
            (m) => m.PublicCalendarComponent,
          ),
      },
    ],
  },
];
