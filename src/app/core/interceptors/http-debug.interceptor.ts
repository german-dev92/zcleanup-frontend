import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable()
export class HttpDebugInterceptor implements HttpInterceptor {
  private isExpectedPricePreviewError(
    req: HttpRequest<unknown>,
    status: number | null | undefined,
  ): boolean {
    const url = String(req?.url ?? '');
    return (
      url.includes('/booking/price-preview') &&
      (status === 400 || status === 429 || status === 503)
    );
  }

  private shouldLog(req: HttpRequest<unknown>): boolean {
    if (environment.production) return false;
    const url = String(req?.url ?? '');
    if (url.includes('/booking/price-preview')) return false;
    return url.includes('/booking') || url.includes('/discounts/');
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.shouldLog(req)) {
      return next.handle(req);
    }

    const startedAt = Date.now();
    console.log('[HTTP] request', {
      method: req.method,
      url: req.urlWithParams,
      body: req.body ?? null
    });

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            console.log('[HTTP] response', {
              method: req.method,
              url: req.urlWithParams,
              status: event.status,
              ms: Date.now() - startedAt,
              body: event.body ?? null
            });
          }
        },
        error: (err: unknown) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          const payload = {
            method: req.method,
            url: req.urlWithParams,
            status: httpErr?.status ?? null,
            ms: Date.now() - startedAt,
            error: httpErr?.error ?? httpErr?.message ?? err
          };

          if (this.isExpectedPricePreviewError(req, httpErr?.status)) {
            console.warn('[HTTP] handled preview error', payload);
            return;
          }

          console.error('[HTTP] error', payload);
        }
      })
    );
  }
}
