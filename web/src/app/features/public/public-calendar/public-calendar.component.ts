import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-public-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      style="font-family: Arial, sans-serif; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 8px;"
    >
      <h3 style="margin: 0 0 1rem 0; color: #1E3A5F;">📅 Calendar</h3>

      <div *ngIf="loading" style="color: gray;">Loading...</div>

      <div *ngIf="!loading && events.length === 0" style="color: gray;">
        No events yet.
      </div>

      <div
        *ngFor="let event of events"
        style="padding: 0.5rem; margin-bottom: 0.5rem; background: #EBF5FF; border-radius: 4px;"
      >
        <strong>{{ event.name }}</strong>
        <div style="font-size: 0.85rem; color: #6B7280;">
          {{ event.startDate }}
        </div>
      </div>
    </div>
  `,
})
export class PublicCalendarComponent implements OnInit {
  events: any[] = [];
  loading = true;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) return;

    this.http.get<any>(`${environment.apiUrl}/public/view/${token}`).subscribe({
      next: (data) => {
        this.events = data.events || [];
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cd.detectChanges();
      },
    });
  }
}
