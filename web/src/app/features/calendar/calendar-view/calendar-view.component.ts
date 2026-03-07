import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarService } from '../../../core/calendar.service';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
  ],
  template: `
    <div style="padding: 1rem;">
      <!-- Calendar Selector -->
      <div class="flex align-items-center gap-3 mb-3">
        <p-select
          [options]="calendarList"
          [(ngModel)]="selectedCalendarId"
          optionLabel="name"
          optionValue="calendarId"
          placeholder="Select a Calendar"
          (onChange)="onCalendarChange()"
          [overlayOptions]="{ appendTo: 'body' }"
          [style]="{ minWidth: '200px' }"
        />
        <span
          style="color: gray; font-size: 0.85rem;"
          *ngIf="selectedCalendarId"
        >
          {{ events.length }} event(s)
        </span>
      </div>

      <!-- FullCalendar Container -->
      <div #calendarEl></div>

      <!-- Create Event Dialog -->
      <!-- Create Event Dialog -->
      <p-dialog
        header="New Event"
        [(visible)]="showDialog"
        [style]="{ width: '460px' }"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [contentStyle]="{ overflow: 'visible', 'padding-bottom': '1rem' }"
      >
        <div
          style="padding: 0.5rem 0; display: flex; flex-direction: column; gap: 1.2rem;"
        >
          <!-- Event Name -->
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label
              style="font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;"
              >Event Name</label
            >
            <input
              pInputText
              placeholder="e.g. Doctor Appointment"
              [(ngModel)]="newEvent.name"
              style="width: 100%; padding: 0.65rem 0.9rem; border-radius: 8px; border: 1.5px solid #E5E7EB; font-size: 0.95rem;"
            />
          </div>

          <!-- Description -->
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label
              style="font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;"
              >Description</label
            >
            <input
              pInputText
              placeholder="Optional details"
              [(ngModel)]="newEvent.description"
              style="width: 100%; padding: 0.65rem 0.9rem; border-radius: 8px; border: 1.5px solid #E5E7EB; font-size: 0.95rem;"
            />
          </div>

          <!-- Color -->
          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            <label
              style="font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;"
              >Color</label
            >
            <div
              style="display: flex; flex-direction: row; gap: 10px; align-items: center;"
            >
              <div
                *ngFor="let color of colorOptions"
                (click)="newEvent.color = color.value"
                [title]="color.label"
                [style]="{
                  background: color.value,
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                  transform:
                    newEvent.color === color.value ? 'scale(1.25)' : 'scale(1)',
                  boxShadow:
                    newEvent.color === color.value
                      ? '0 0 0 3px white, 0 0 0 5px ' + color.value
                      : 'none',
                }"
              ></div>
            </div>
          </div>

          <!-- Repeat -->
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label
              style="font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;"
              >Repeat</label
            >
            <p-select
              [options]="recurrenceOptions"
              [(ngModel)]="newEvent.recurrence"
              optionLabel="label"
              optionValue="value"
              [style]="{ width: '100%', borderRadius: '8px' }"
            />
          </div>

          <!-- Divider -->
          <hr
            style="border: none; border-top: 1px solid #F3F4F6; margin: 0.2rem 0;"
          />

          <!-- Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <p-button
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (click)="showDialog = false"
              [style]="{ borderRadius: '8px', padding: '0.5rem 1.2rem' }"
            />
            <p-button
              label="Create Event"
              [loading]="loading"
              (click)="onCreate()"
              [style]="{ borderRadius: '8px', padding: '0.5rem 1.2rem' }"
            />
          </div>
        </div>
      </p-dialog>

      <!-- Event Detail Dialog -->
      <!-- Event Detail Dialog -->
      <p-dialog
        header="Event Details"
        [(visible)]="showDetailDialog"
        [style]="{ width: '420px' }"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
      >
        <div
          style="padding: 0.5rem 0; display: flex; flex-direction: column; gap: 1.2rem;"
          *ngIf="selectedEvent"
        >
          <!-- Color bar + Title -->
          <div style="display: flex; align-items: center; gap: 0.8rem;">
            <div
              [style]="{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                flexShrink: '0',
                background: selectedEvent.backgroundColor || '#3B82F6',
              }"
            ></div>
            <span style="font-size: 1.15rem; font-weight: 700; color: #111827;">
              {{ selectedEvent.title }}
            </span>
          </div>

          <!-- Description -->
          <div
            *ngIf="selectedEvent.extendedProps?.description"
            style="display: flex; gap: 0.7rem; align-items: flex-start;"
          >
            <i
              class="pi pi-align-left"
              style="color: #9CA3AF; margin-top: 2px;"
            ></i>
            <span style="color: #4B5563; font-size: 0.95rem;">
              {{ selectedEvent.extendedProps.description }}
            </span>
          </div>

          <!-- Date -->
          <div style="display: flex; gap: 0.7rem; align-items: center;">
            <i class="pi pi-calendar" style="color: #9CA3AF;"></i>
            <span style="color: #4B5563; font-size: 0.9rem;">
              {{ selectedEvent.startStr | date: 'EEEE, MMMM d, y' }}
            </span>
          </div>

          <!-- Recurrence -->
          <div
            *ngIf="
              selectedEvent.extendedProps?.recurrence &&
              selectedEvent.extendedProps?.recurrence !== 'none'
            "
            style="display: flex; gap: 0.7rem; align-items: center;"
          >
            <i class="pi pi-refresh" style="color: #9CA3AF;"></i>
            <span
              style="color: #4B5563; font-size: 0.9rem; text-transform: capitalize;"
            >
              Repeats {{ selectedEvent.extendedProps.recurrence }}
            </span>
          </div>

          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 0;" />

          <!-- Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <p-button
              label="Close"
              severity="secondary"
              [outlined]="true"
              (click)="showDetailDialog = false"
              [style]="{ borderRadius: '8px' }"
            />
          </div>
        </div>
      </p-dialog>
    </div>
  `,
})
export class CalendarViewComponent implements OnInit, AfterViewInit {
  @ViewChild('calendarEl') calendarEl!: ElementRef;

  calendarList: any[] = [];
  selectedCalendarId = '';
  events: any[] = [];
  showDialog = false;
  showDetailDialog = false;
  loading = false;
  selectedEvent: any = null;
  pendingStart = '';
  pendingEnd = '';
  fcInstance: Calendar | null = null;

  newEvent = {
    name: '',
    description: '',
    color: '#3B82F6',
    recurrence: 'none',
  };

  colorOptions = [
    { value: '#3B82F6', label: 'Blue' },
    { value: '#10B981', label: 'Green' },
    { value: '#F59E0B', label: 'Amber' },
    { value: '#EF4444', label: 'Red' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#EC4899', label: 'Pink' },
  ];

  recurrenceOptions = [
    { label: 'Does not repeat', value: 'none' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  constructor(
    private calendarService: CalendarService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.calendarService.getCalendars().subscribe((data) => {
      this.calendarList = data;
      if (data.length > 0) {
        this.selectedCalendarId = data[0].calendarId;
        this.loadEvents();
      }
      this.cd.detectChanges();
    });
  }

  ngAfterViewInit() {
    this.initCalendar();
  }

  initCalendar() {
    this.fcInstance = new Calendar(this.calendarEl.nativeElement, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      editable: true,
      selectable: true,
      selectMirror: true,
      dayMaxEvents: true,
      events: [],
      select: (arg) => {
        this.pendingStart = arg.startStr;
        this.pendingEnd = arg.endStr;
        this.newEvent = {
          name: '',
          description: '',
          color: '#3B82F6',
          recurrence: 'none',
        };
        this.showDialog = true;
        this.cd.detectChanges();
      },
      eventClick: (arg) => {
        this.selectedEvent = arg.event;
        this.showDetailDialog = true;
        this.cd.detectChanges();
      },
      eventDrop: (arg) => {
        console.log('Event dropped:', arg.event.id, arg.event.startStr);
      },
      eventResize: (arg) => {
        console.log('Event resized:', arg.event.id, arg.event.startStr);
      },
    });
    this.fcInstance.render();
  }

  onCalendarChange() {
    this.loadEvents();
  }

  loadEvents() {
    if (!this.selectedCalendarId) return;
    this.calendarService
      .getEvents(this.selectedCalendarId)
      .subscribe((data) => {
        this.events = data.map((e) => ({
          id: e.eventId,
          title: e.name,
          start: e.startDate,
          end: e.endDate,
          backgroundColor: e.color || '#3B82F6',
          borderColor: e.color || '#3B82F6',
          extendedProps: {
            description: e.description,
            recurrence: e.recurrence,
          },
        }));
        if (this.fcInstance) {
          this.fcInstance.removeAllEvents();
          this.events.forEach((e) => this.fcInstance!.addEvent(e));
        }
        this.cd.detectChanges();
      });
  }

  onCreate() {
    if (!this.newEvent.name) return;
    this.loading = true;
    this.calendarService
      .createEvent(this.selectedCalendarId, {
        name: this.newEvent.name,
        description: this.newEvent.description,
        startDate: this.pendingStart,
        endDate: this.pendingEnd,
        color: this.newEvent.color,
        recurrence: this.newEvent.recurrence,
      })
      .subscribe({
        next: () => {
          this.showDialog = false;
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
}
