import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

  // 🟢 Crear booking
  bookService(request: BookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiBaseUrl}/booking`, request);
  }

  getBookings(status?: string): Observable<Booking[]> {
    const params = typeof status === 'string' && status.trim()
      ? new HttpParams().set('status', status.trim())
      : undefined;
    return this.http.get<Booking[]>(`${this.apiBaseUrl}/booking`, { params });
  }

  getBookingById(id: string): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    return this.http.get<Booking>(`${this.apiBaseUrl}/booking/${encodedId}`);
  }

  updateStatus(id: string, status: 'confirmed' | 'cancelled'): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    const body = { status };
    return this.http
      .patch<any>(`${this.apiBaseUrl}/booking/${encodedId}/status`, body)
      .pipe(
        map(
          (res) =>
            (res && typeof res === 'object' && 'data' in res
              ? (res as any).data
              : res) as Booking,
        ),
      );
  }

  assignBooking(bookingId: string, supervisorId: string, employeeIds: string[]): Observable<Booking> {
    const encodedId = encodeURIComponent(String(bookingId ?? '').trim());
    const supId = String(supervisorId ?? '').trim();
    const ids = Array.isArray(employeeIds) ? employeeIds : [];
    const normalizedEmployeeIds = Array.from(
      new Set(ids.map((x) => String(x ?? '').trim()).filter(Boolean))
    );
    const body = { supervisorId: supId, employeeIds: normalizedEmployeeIds };
    return this.http.patch<any>(`${this.apiBaseUrl}/booking/${encodedId}/assign`, body).pipe(
      map((res) => (res && typeof res === 'object' && 'data' in res ? (res as any).data : res) as Booking)
    );
  }

  startBooking(id: string): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    return this.http.patch<any>(`${this.apiBaseUrl}/booking/${encodedId}/start`, {}).pipe(
      map((res) => (res && typeof res === 'object' && 'data' in res ? (res as any).data : res) as Booking)
    );
  }

  completeBooking(id: string): Observable<Booking> {
    const encodedId = encodeURIComponent(String(id ?? '').trim());
    return this.http.patch<any>(`${this.apiBaseUrl}/booking/${encodedId}/complete`, {}).pipe(
      map((res) => (res && typeof res === 'object' && 'data' in res ? (res as any).data : res) as Booking)
    );
  }

  getAssignedBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiBaseUrl}/booking/assigned`);
  }

  checkDiscount(params: { email?: string; address?: string }): Observable<DiscountCheckResponse> {
    const body: any = {};
    const email = String(params?.email ?? '').trim().toLowerCase();
    const address = String(params?.address ?? '').trim();
    if (email) body.email = email;
    if (address) body.address = address;
    return this.http.post<DiscountCheckResponse>(`${this.apiBaseUrl}/discounts/check`, body);
  }

  pricePreview(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/booking/price-preview`, payload);
  }
}
