import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarService, Calendar } from '../../core/calendar.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { WebSocketService } from '../../core/websocket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    DialogModule,
    BadgeModule,
    TagModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  calendars: Calendar[] = [];
  showDialog = false;
  newName = '';
  newDescription = '';
  loading = false;

  constructor(
    private calendarService: CalendarService,
    private wsService: WebSocketService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadCalendars();
    this.wsService.connect();
    this.wsService.messages$.subscribe((msg) => {
      if (msg.type === 'CALENDAR_CREATED') {
        this.calendars.push(msg.data);
        this.cd.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.wsService.disconnect();
  }

  loadCalendars() {
    this.calendarService.getCalendars().subscribe((data) => {
      this.calendars = data;
      this.cd.detectChanges();
    });
  }

  onCreate() {
    if (!this.newName) return;
    this.loading = true;
    this.calendarService
      .createCalendar(this.newName, this.newDescription)
      .subscribe({
        next: () => {
          this.showDialog = false;
          this.newName = '';
          this.newDescription = '';
          this.loading = false;
          this.loadCalendars();
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        },
      });
  }

  onPublish(calendarId: string) {
    this.calendarService.publishCalendar(calendarId).subscribe({
      next: (res) => {
        const cal = this.calendars.find((c) => c.calendarId === calendarId);
        if (cal) {
          cal.publicToken = res.token;
          this.cd.detectChanges();
        }
      },
      error: (err) => console.error(err),
    });
  }

  viewEvents(calendarId: string) {
    this.router.navigate(['/calendars', calendarId, 'events']);
  }

  get publicCalendarsCount() {
    return this.calendars.filter((c) => c.publicToken).length;
  }
}
