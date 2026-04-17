import { Component, OnInit } from '@angular/core';
import { Booking } from '../../../core/models/booking-request.model';
import { BookingService } from '../../../core/services/booking.service';

@Component({
  selector: 'app-admin-bookings',
  templateUrl: './admin-bookings.component.html',
  styleUrls: ['./admin-bookings.component.scss']
})
export class AdminBookingsComponent implements OnInit {
  bookings: Booking[] = [];
  isLoading = false;
  errorMessage = '';
  readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.bookingService.getBookings().subscribe({
      next: (bookings) => {
        this.bookings = Array.isArray(bookings) ? bookings : [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Unable to load bookings.';
      }
    });
  }

  updateStatus(id: string, status: 'confirmed' | 'cancelled'): void {
    this.bookingService.updateStatus(id, status).subscribe({
      next: () => {
        this.loadBookings();
      },
      error: () => {
        this.errorMessage = 'Unable to update booking status.';
      }
    });
  }

  getStatusLabel(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'Pending';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'cancelled') return 'Cancelled';
    return 'Unknown';
  }

  getStatusClass(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'status-badge--pending';
    if (status === 'confirmed') return 'status-badge--confirmed';
    if (status === 'cancelled') return 'status-badge--cancelled';
    return 'status-badge--unknown';
  }
}
