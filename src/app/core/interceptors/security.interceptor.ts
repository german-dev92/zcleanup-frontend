import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SecurityStateService } from '../services/security-state.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  private forcingLogout = false;

  constructor(
    private readonly securityState: SecurityStateService,
    private readonly auth: AuthService
  ) {}

  private isLoginOrRegisterRequest(req: HttpRequest<unknown>): boolean {
    const url = String(req?.url ?? '').toLowerCase();
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    );
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        const httpErr = err instanceof HttpErrorResponse ? err : null;
        const status = httpErr?.status;
        const isLoginOrRegister = this.isLoginOrRegisterRequest(req);
        const hasToken = !!this.auth.getToken();

        if (status === 401 && hasToken && !isLoginOrRegister && !this.forcingLogout) {
          this.forcingLogout = true;
          if (!environment.production) {
            console.warn('[AUTH] 401 detected → forcing logout');
          }
          this.securityState.setSessionExpired();
          this.auth.logout();
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
