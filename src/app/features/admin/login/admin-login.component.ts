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
          if (!this.auth.isAdmin()) {
            this.auth.clear();
            this.errorMessage = 'Not authorized.';
            return;
          }
          const returnUrl = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '').trim();
          void this.router.navigateByUrl(returnUrl || '/admin/bookings');
        },
        error: () => {
          this.errorMessage = 'Invalid credentials.';
        }
      });
  }
}
