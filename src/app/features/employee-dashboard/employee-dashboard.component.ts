import { Component, OnDestroy, OnInit } from '@angular/core';
import { Booking } from '../../core/models/booking-request.model';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.scss']
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  bookings: Booking[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  private readonly rowLoading = new Set<string>();
  private successTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly bookingService: BookingService,
    readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAssignedBookings();
  }

  ngOnDestroy(): void {
    if (this.successTimeoutId) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }
  }

  private setTransientSuccessMessage(message: string): void {
    this.successMessage = message;
    if (this.successTimeoutId) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }
    this.successTimeoutId = setTimeout(() => {
      if (this.successMessage === message) {
        this.successMessage = '';
      }
      this.successTimeoutId = null;
    }, 2500);
  }

  onLogout(): void {
    const ok = confirm('Are you sure you want to logout?');
    if (!ok) return;
    this.auth.logout();
  }

  loadAssignedBookings(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.bookingService.getAssignedBookings().subscribe({
      next: (bookings) => {
        this.bookings = Array.isArray(bookings) ? bookings : [];
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load assigned bookings.';
        this.isLoading = false;
      }
    });
  }

  getStatusLabel(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'Pending';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'assigned') return 'Assigned';
    if (status === 'in_progress') return 'In Progress';
    if (status === 'completed') return 'Completed';
    if (status === 'paid') return 'Paid';
    if (status === 'cancelled') return 'Cancelled';
    return 'Unknown';
  }

  getStatusClass(status: Booking['status'] | null | undefined): string {
    if (status === 'pending') return 'status-badge--pending';
    if (status === 'confirmed') return 'status-badge--confirmed';
    if (status === 'assigned') return 'status-badge--assigned';
    if (status === 'in_progress') return 'status-badge--in-progress';
    if (status === 'completed') return 'status-badge--completed';
    if (status === 'paid') return 'status-badge--paid';
    if (status === 'cancelled') return 'status-badge--cancelled';
    return 'status-badge--unknown';
  }

  getSupervisorDisplay(booking: Booking | null | undefined): string {
    const name = String(booking?.assignedSupervisor?.name ?? '').trim();
    if (name) return name;
    const supId = String(booking?.assignedSupervisor?.employeeId ?? '').trim();
    return supId || '-';
  }

  isRowLoading(id: string | null | undefined): boolean {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return false;
    return this.rowLoading.has(bookingId);
  }

  startBooking(id: string): void {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return;
    if (this.rowLoading.has(bookingId)) return;

    this.rowLoading.add(bookingId);
    this.errorMessage = '';
    this.successMessage = '';
    this.bookingService.startBooking(bookingId).subscribe({
      next: () => {
        this.setTransientSuccessMessage('Job started');
        this.rowLoading.delete(bookingId);
        this.loadAssignedBookings();
      },
      error: () => {
        this.errorMessage = 'Unable to start job.';
        this.rowLoading.delete(bookingId);
      }
    });
  }

  completeBooking(id: string): void {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return;
    if (this.rowLoading.has(bookingId)) return;

    this.rowLoading.add(bookingId);
    this.errorMessage = '';
    this.successMessage = '';
    this.bookingService.completeBooking(bookingId).subscribe({
      next: () => {
        this.setTransientSuccessMessage('Job completed');
        this.rowLoading.delete(bookingId);
        this.loadAssignedBookings();
      },
      error: () => {
        this.errorMessage = 'Unable to complete job.';
        this.rowLoading.delete(bookingId);
      }
    });
  }

  trackByBookingId(_: number, b: Booking): string {
    return b?._id;
  }
}
