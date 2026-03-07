import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
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
      <p-card [ngStyle]="{ width: '400px' }">
        <ng-template pTemplate="header">
          <h3 style="padding: 1rem 1rem 0">
            {{ step === 1 ? 'Create Account' : 'Confirm Email' }}
          </h3>
        </ng-template>

        <!-- Step 1: Register -->
        <div *ngIf="step === 1" class="flex flex-column gap-3">
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
            label="Register"
            [loading]="loading"
            (click)="onRegister()"
            class="w-full"
          />
          <p *ngIf="error" style="color:red">{{ error }}</p>
          <a
            (click)="goToLogin()"
            style="cursor:pointer; color: var(--primary-color)"
          >
            Already have an account? Login
          </a>
        </div>

        <!-- Step 2: Confirm code -->
        <div *ngIf="step === 2" class="flex flex-column gap-3">
          <p>Check your email for a confirmation code.</p>
          <input
            pInputText
            placeholder="Confirmation Code"
            [(ngModel)]="code"
            class="w-full"
          />
          <p-button
            label="Confirm"
            [loading]="loading"
            (onClick)="onConfirm()"
            class="w-full"
          />
          <p *ngIf="error" style="color:red">{{ error }}</p>
        </div>
      </p-card>
    </div>
  `,
})
export class RegisterComponent {
  email = '';
  password = '';
  code = '';
  step = 1;
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  async onRegister() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.auth.register(this.email, this.password);
      console.log('Register result:', result);
      this.step = 2;
      this.cd.detectChanges();
    } catch (err: any) {
      console.log('Register error:', err);
      this.error = err.message;
    } finally {
      this.loading = false;
      this.cd.detectChanges();
    }
  }

  async onConfirm() {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.confirmRegistration(this.email, this.code);
      this.router.navigate(['/login']);
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
