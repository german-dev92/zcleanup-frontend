import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SecurityStateService } from '../services/security-state.service';
import { AuthService } from '../services/auth.service';

@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  constructor(
    private readonly router: Router,
    private readonly securityState: SecurityStateService,
    private readonly auth: AuthService
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        const httpErr = err instanceof HttpErrorResponse ? err : null;
        const status = httpErr?.status;
        const isAuthRequest = String(req.url ?? '').includes('/auth/');

        if (status === 401 && !isAuthRequest) {
          const isAdminRoute = String(this.router.url ?? '').startsWith('/admin');
          this.securityState.setSessionExpired();
          if (isAdminRoute) {
            this.auth.clear();
            void this.router.navigateByUrl('/admin/login');
          }
        } else if (status === 403) {
          this.securityState.setForbidden();
        } else if (status === 0) {
          this.securityState.setError('Network error. Please check your connection and try again.');
        } else if (typeof status === 'number' && status >= 500) {
          this.securityState.setError('Service temporarily unavailable. Please try again.');
        }

        return throwError(() => err);
      })
    );
  }
}
