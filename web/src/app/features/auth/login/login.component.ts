import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    CardModule,
  ],
  template: `
    <div class="flex justify-content-center align-items-center min-h-screen">
      <p-card header="Sign In" [ngStyle]="{ width: '400px' }">
        <div class="flex flex-column gap-3">
          <input
            pInputText
            placeholder="Email"
            [(ngModel)]="email"
            type="email"
            class="w-full"
          />
          <input
            pInputText
            placeholder="Password"
            [(ngModel)]="password"
            type="password"
            class="w-full"
          />

          <p-button
            label="Login"
            [loading]="loading"
            (click)="onLogin()"
            class="w-full"
          />

          <p *ngIf="error" style="color:red">{{ error }}</p>

          <span
            (click)="goToRegister()"
            style="cursor:pointer; color: var(--primary-color)"
          >
            Don't have an account? Register
          </span>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  async onLogin() {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
      this.cd.detectChanges();
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
