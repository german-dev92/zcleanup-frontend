import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
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
