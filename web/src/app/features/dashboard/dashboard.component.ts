import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarService, Calendar } from '../../core/calendar.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
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
  ],
  template: `
    <div style="padding: 2rem">
      <div class="flex justify-content-between align-items-center mb-4">
        <h2>My Calendars</h2>
        <p-button
          label="New Calendar"
          icon="pi pi-plus"
          (click)="showDialog = true"
        />
      </div>

      <div class="grid">
        <div *ngFor="let cal of calendars" class="col-12 md:col-4">
          <p-card [header]="cal.name">
            <p>{{ cal.description || 'No description' }}</p>
            <small style="color: gray">{{ cal.createdAt | date }}</small>
            <br /><br />
            <p-button
              label="Make Public"
              icon="pi pi-share-alt"
              size="small"
              (click)="onPublish(cal.calendarId)"
            />
            <p-button
              label="View Events"
              icon="pi pi-calendar"
              size="small"
              (click)="viewEvents(cal.calendarId)"
            />
            <p
              *ngIf="cal.publicToken"
              style="font-size: 0.8rem; color: green; margin-top: 0.5rem;"
            >
              Public link: /public/{{ cal.publicToken }}
            </p>
          </p-card>
        </div>
      </div>

      <p *ngIf="calendars.length === 0">No calendars yet. Create one!</p>

      <!-- New Calendar Dialog -->
      <p-dialog
        header="New Calendar"
        [(visible)]="showDialog"
        [style]="{ width: '400px' }"
      >
        <div class="flex flex-column gap-3">
          <input
            pInputText
            placeholder="Calendar Name"
            [(ngModel)]="newName"
            class="w-full"
          />
          <input
            pInputText
            placeholder="Description (optional)"
            [(ngModel)]="newDescription"
            class="w-full"
          />
          <p-button label="Create" [loading]="loading" (click)="onCreate()" />
        </div>
      </p-dialog>
    </div>
  `,
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
}
