import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Booking,
  BookingRequest,
  BookingResponse,
  DiscountCheckResponse
} from '../models/booking-request.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  private normalizeApiBaseUrl(value: string): string {
    let url = String(value ?? '').trim().replace(/\/+$/, '');
    const lower = () => url.toLowerCase();

    const stripSuffix = (suffix: string) => {
      if (lower().endsWith(suffix)) {
        url = url.slice(0, Math.max(0, url.length - suffix.length)).replace(/\/+$/, '');
      }
    };

    stripSuffix('/api/booking');
    stripSuffix('/booking');
    stripSuffix('/api');

    return url;
  }

  // 🟢 Crear booking
  bookService(request: BookingRequest): Observable<BookingResponse> {
    const directUrl = `${this.apiBaseUrl}/booking`;
    const apiPrefixedUrl = `${this.apiBaseUrl}/api/booking`;

    return this.http.post<BookingResponse>(directUrl, request).pipe(
      catchError((err: any) => {
        if (err?.status === 404) {
          return this.http.post<BookingResponse>(apiPrefixedUrl, request);
        }
        return throwError(() => err);
      })
    );
  }

  getBookings(status?: string): Observable<Booking[]> {
    const directUrl = `${this.apiBaseUrl}/booking`;
    const apiPrefixedUrl = `${this.apiBaseUrl}/api/booking`;
    const params = typeof status === 'string' && status.trim()
      ? new HttpParams().set('status', status.trim())
      : undefined;

    return this.http.get<Booking[]>(directUrl, { params }).pipe(
      catchError((err: any) => {
        if (err?.status === 404) {
          return this.http.get<Booking[]>(apiPrefixedUrl, { params });
        }
        return throwError(() => err);
      })
    );
  }

  getBookingById(id: string): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    const directUrl = `${this.apiBaseUrl}/booking/${encodedId}`;
    const apiPrefixedUrl = `${this.apiBaseUrl}/api/booking/${encodedId}`;

    return this.http.get<Booking>(directUrl).pipe(
      catchError((err: any) => {
        if (err?.status === 404) {
          return this.http.get<Booking>(apiPrefixedUrl);
        }
        return throwError(() => err);
      })
    );
  }

  updateStatus(id: string, status: 'confirmed' | 'cancelled'): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    const baseUrl = this.normalizeApiBaseUrl(this.apiBaseUrl);
    const directUrl = `${baseUrl}/booking/${encodedId}/status`;
    const body = { status };

    if (!environment.production) {
      console.log('[ADMIN PATCH FINAL URL]', directUrl);
    }
    return this.http.patch<Booking>(directUrl, body);
  }

  // 🔥 VALIDACIÓN DE DESCUENTO (VERSIÓN SEGURA Y CONSISTENTE)
  checkDiscount(email: string): Observable<DiscountCheckResponse> {
    const encodedEmail = encodeURIComponent(email.trim().toLowerCase());

    const directUrl = `${this.apiBaseUrl}/discounts/check/${encodedEmail}`;
    const apiPrefixedUrl = `${this.apiBaseUrl}/api/discounts/check/${encodedEmail}`;

    return this.http.get<DiscountCheckResponse>(directUrl).pipe(
      catchError((err: any) => {
        if (err?.status === 404) {
          return this.http.get<DiscountCheckResponse>(apiPrefixedUrl);
        }
        return throwError(() => err);
      })
    );
  }
}
