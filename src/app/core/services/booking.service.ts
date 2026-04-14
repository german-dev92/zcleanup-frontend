import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BookingRequest, BookingResponse } from '../models/booking-request.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private apiUrl = '/api/book-service'; // Placeholder URL

  constructor(private http: HttpClient) { }

  bookService(request: BookingRequest): Observable<BookingResponse> {
    // Simulate backend call
    const successResponse: BookingResponse = {
      success: true,
      message: 'Your booking request has been submitted successfully!',
      bookingId: 'BK-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    };

    // return this.http.post<BookingResponse>(this.apiUrl, request);
    return of(successResponse).pipe(delay(1500));
  }
}
