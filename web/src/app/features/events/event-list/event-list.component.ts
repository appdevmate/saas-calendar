import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarService, CalendarEvent } from '../../../core/calendar.service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule,
    DialogModule, DividerModule, TagModule
  ],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss'
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
    this.calendarService.createEvent(this.calendarId, {
      name: this.newName,
      description: this.newDescription,
      startDate: this.newStartDate,
      endDate: this.newEndDate,
    }).subscribe({
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