import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Booking } from '../../../core/models/booking-request.model';
import { BookingService } from '../../../core/services/booking.service';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-bookings',
  templateUrl: './admin-bookings.component.html',
  styleUrls: ['./admin-bookings.component.scss']
})
export class AdminBookingsComponent implements OnInit {
  bookings: Booking[] = [];
  isLoading = false;
  isUnauthorized = false;
  isForbidden = false;
  errorMessage = '';
  readonly skeletonRows = [0, 1, 2, 3, 4];
  private readonly updatingIds = new Set<string>();

  constructor(
    private bookingService: BookingService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/admin/login');
  }

  loadBookings(): void {
    this.isLoading = true;
    this.isUnauthorized = false;
    this.isForbidden = false;
    this.errorMessage = '';

    this.bookingService.getBookings().subscribe({
      next: (bookings) => {
        this.bookings = Array.isArray(bookings) ? bookings : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        const httpErr = err instanceof HttpErrorResponse ? err : null;
        if (httpErr?.status === 401) {
          this.isUnauthorized = true;
          return;
        }
        if (httpErr?.status === 403) {
          this.isForbidden = true;
          return;
        }
        this.errorMessage = 'Unable to load bookings.';
      }
    });
  }

  updateStatus(id: string, status: 'confirmed' | 'cancelled'): void {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return;
    if (this.updatingIds.has(bookingId)) return;

    this.updatingIds.add(bookingId);

    this.bookingService.updateStatus(bookingId, status)
      .pipe(finalize(() => this.updatingIds.delete(bookingId)))
      .subscribe({
      next: () => {
        this.loadBookings();
      },
      error: (err) => {
        const httpErr = err instanceof HttpErrorResponse ? err : null;
        if (httpErr?.status === 401) {
          this.isUnauthorized = true;
          return;
        }
        if (httpErr?.status === 403) {
          this.isForbidden = true;
          return;
        }
        this.errorMessage = 'Unable to update booking status.';
      }
    });
  }

  isUpdating(id: string | null | undefined): boolean {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return false;
    return this.updatingIds.has(bookingId);
  }

  trackByBookingId(_: number, b: Booking): string {
    return b?._id;
  }

  getStatusLabel(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'Pending';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'paid') return 'Paid';
    if (status === 'cancelled') return 'Cancelled';
    return 'Unknown';
  }

  getStatusClass(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'status-badge--pending';
    if (status === 'confirmed') return 'status-badge--confirmed';
    if (status === 'paid') return 'status-badge--confirmed';
    if (status === 'cancelled') return 'status-badge--cancelled';
    return 'status-badge--unknown';
  }
}
