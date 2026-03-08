import { Component, signal } from '@angular/core';
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    AvatarModule,
    RippleModule,
    TooltipModule,
    DividerModule,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  collapsed = signal(false);

  navItems = [
    { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard' },
    { label: 'Calendar', icon: 'pi pi-calendar', route: '/calendar' },
    { label: 'Calendars', icon: 'pi pi-list', route: '/calendars' },
    { label: 'Events', icon: 'pi pi-clock', route: '/events' },
    { label: 'Webhooks', icon: 'pi pi-link', route: '/webhooks' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  toggle() {
    this.collapsed.update((v) => !v);
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
