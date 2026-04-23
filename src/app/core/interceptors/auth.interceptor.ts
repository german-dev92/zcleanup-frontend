import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const apiBaseUrl = String(environment.apiBaseUrl ?? '').replace(/\/$/, '');
    const requestUrl = String(req.url ?? '');
    const isApiCall = apiBaseUrl ? requestUrl.startsWith(apiBaseUrl) : false;
    if (!isApiCall) {
      return next.handle(req);
    }

    const token = this.auth.getToken();
    if (!token) {
      return next.handle(req);
    }

    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }

    const authed = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(authed);
  }
}
