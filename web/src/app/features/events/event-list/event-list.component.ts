import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarService, CalendarEvent } from '../../../core/calendar.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-event-list',
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
      <div class="flex align-items-center gap-3 mb-4">
        <p-button icon="pi pi-arrow-left" (click)="goBack()" />
        <h2 style="margin: 0">Events</h2>
        <p-button
          label="New Event"
          icon="pi pi-plus"
          (click)="showDialog = true"
        />
      </div>

      <div class="grid">
        <div *ngFor="let event of events" class="col-12 md:col-4">
          <p-card [header]="event.name">
            <p>{{ event.description || 'No description' }}</p>
            <small style="color: gray">
              {{ event.startDate | date: 'medium' }} —
              {{ event.endDate | date: 'medium' }}
            </small>
          </p-card>
        </div>
      </div>

      <p *ngIf="events.length === 0">No events yet. Create one!</p>

      <p-dialog
        header="New Event"
        [(visible)]="showDialog"
        [style]="{ width: '400px' }"
      >
        <div class="flex flex-column gap-3">
          <input
            pInputText
            placeholder="Event Name"
            [(ngModel)]="newName"
            class="w-full"
          />
          <input
            pInputText
            placeholder="Description (optional)"
            [(ngModel)]="newDescription"
            class="w-full"
          />
          <input
            pInputText
            placeholder="Start Date (e.g. 2026-03-10T09:00:00Z)"
            [(ngModel)]="newStartDate"
            class="w-full"
          />
          <input
            pInputText
            placeholder="End Date (e.g. 2026-03-10T10:00:00Z)"
            [(ngModel)]="newEndDate"
            class="w-full"
          />
          <p-button label="Create" [loading]="loading" (click)="onCreate()" />
        </div>
      </p-dialog>
    </div>
  `,
})
export class EventListComponent implements OnInit {
  events: CalendarEvent[] = [];
  showDialog = false;
  newName = '';
  newDescription = '';
  newStartDate = '';
  newEndDate = '';
  loading = false;
  calendarId = '';

  constructor(
    private calendarService: CalendarService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.calendarId = this.route.snapshot.paramMap.get('calendarId') || '';
    this.loadEvents();
  }

  loadEvents() {
    this.calendarService.getEvents(this.calendarId).subscribe((data) => {
      this.events = data;
      this.cd.detectChanges();
    });
  }

  onCreate() {
    if (!this.newName || !this.newStartDate) return;
    this.loading = true;
    this.calendarService
      .createEvent(this.calendarId, {
        name: this.newName,
        description: this.newDescription,
        startDate: this.newStartDate,
        endDate: this.newEndDate,
      })
      .subscribe({
        next: () => {
          this.showDialog = false;
          this.newName = '';
          this.newDescription = '';
          this.newStartDate = '';
          this.newEndDate = '';
          this.loading = false;
          this.loadEvents();
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        },
      });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
