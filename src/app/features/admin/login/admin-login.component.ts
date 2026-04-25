import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-admin-login',
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit {
  form!: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  private isAllowedReturnUrlForRole(returnUrl: string): boolean {
    const url = String(returnUrl ?? '').trim();
    if (!url.startsWith('/')) return false;

    if (this.auth.isAdminOrSupervisor()) {
      return url.startsWith('/admin/');
    }

    if (this.auth.isEmployee()) {
      return url.startsWith('/employee-dashboard');
    }

    return false;
  }

  submit(): void {
    if (this.isSubmitting) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const email = String(this.form.get('email')?.value ?? '').trim();
    const password = String(this.form.get('password')?.value ?? '');

    this.auth
      .login(email, password)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: () => {
          const returnUrl = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '').trim();
          if (returnUrl && this.isAllowedReturnUrlForRole(returnUrl)) {
            void this.router.navigateByUrl(returnUrl);
            return;
          }

          if (this.auth.isAdminOrSupervisor()) {
            void this.router.navigateByUrl('/admin/bookings');
            return;
          }

          if (this.auth.isEmployee()) {
            void this.router.navigateByUrl('/employee-dashboard');
            return;
          }

          this.auth.clear();
          this.errorMessage = 'Not authorized.';
        },
        error: () => {
          this.errorMessage = 'Invalid credentials.';
        }
      });
  }
}
