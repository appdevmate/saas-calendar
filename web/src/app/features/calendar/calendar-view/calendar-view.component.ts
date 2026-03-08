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
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';

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
    TagModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
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
      height: 'calc(100vh - 180px)',
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
