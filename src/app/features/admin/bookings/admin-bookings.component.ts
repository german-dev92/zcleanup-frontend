import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminCancelBookingInput,
  AdminConfirmAndSendPaymentResponse,
  AdminDeletePermanentReAuth,
  AdminDeletePermanentResponse,
  ADMIN_QUOTE_DISCOUNT_OPTIONS,
  AdminQuoteDraftInput,
  Booking,
  BookingQuoteViewModel,
} from '../../../core/models/booking-request.model';
import type { AdminQuoteDiscountType } from '../../../core/models/booking-request.model';
import { BookingService } from '../../../core/services/booking.service';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { EmployeesService, type Employee } from '../../../core/services/employees.service';

type QuoteDraftFormState = {
  baseCalculatedPrice: number | null;
  discountType: AdminQuoteDiscountType;
  expiresAt: string;
  customerMessage: string;
  internalNotes: string;
  rejectionReason: string;
  discountReason: string;
};

type QuoteDraftField = keyof QuoteDraftFormState;

type CancelFormState = {
  cancellationReason: string;
  internalNotes: string;
};

type DeleteReAuthFormState = {
  email: string;
  password: string;
};

@Component({
  selector: 'app-admin-bookings',
  templateUrl: './admin-bookings.component.html',
  styleUrls: ['./admin-bookings.component.scss']
})
export class AdminBookingsComponent implements OnInit {
  bookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  employees: Employee[] = [];
  supervisorsForAssignment: Employee[] = [];
  employeesForAssignment: Employee[] = [];
  isEmployeesLoading = false;

  readonly discountOptions = ADMIN_QUOTE_DISCOUNT_OPTIONS;

  filters = {
    client: '',
    supervisor: '',
    employee: '',
    date: '',
    service: '',
    place: '',
    commercial: '',
  };

  selectedSupervisorByBookingId: Record<string, string> = {};
  selectedEmployeesByBookingId: Record<string, string[]> = {};
  assignmentSuccessMessageByBookingId: Record<string, string> = {};
  isLoading = false;
  isUnauthorized = false;
  isForbidden = false;
  errorMessage = '';
  readonly skeletonRows = [0, 1, 2, 3, 4];
  private readonly updatingIds = new Set<string>();
  private readonly jobActionIds = new Set<string>();
  private readonly assigningIds = new Set<string>();
  private readonly quoteActionIds = new Set<string>();
  private readonly editingSupervisorBookingIds = new Set<string>();
  private readonly editingEmployeesBookingIds = new Set<string>();
  private readonly expandedBookingIds = new Set<string>();
  quoteDraftByBookingId: Record<string, QuoteDraftFormState> = {};
  quoteActionMessageByBookingId: Record<string, string> = {};
  private readonly applyingFirstServiceDiscountIds = new Set<string>();
  discountActionSuccessByBookingId: Record<string, string> = {};
  discountActionErrorByBookingId: Record<string, string> = {};
  copyPaymentLinkSuccessByBookingId: Record<string, boolean> = {};
  copyPaymentLinkErrorByBookingId: Record<string, boolean> = {};

  private readonly confirmingSendPaymentIds = new Set<string>();
  confirmActionSuccessByBookingId: Record<string, string> = {};
  confirmActionErrorByBookingId: Record<string, string> = {};
  confirmWasAlreadyIssuedByBookingId: Record<string, boolean> = {};

  cancelModalOpen = false;
  cancelTargetBookingId: string | null = null;
  cancelForm: CancelFormState = { cancellationReason: '', internalNotes: '' };
  cancelSubmitting = false;
  cancelError = '';

  deleteModalOpen = false;
  deleteTargetBookingId: string | null = null;
  deleteForm: DeleteReAuthFormState = { email: '', password: '' };
  deleteSubmitting = false;
  deleteError = '';

  constructor(
    private bookingService: BookingService,
    readonly auth: AuthService,
    private employeesService: EmployeesService
  ) {}

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.loadEmployees();
    }
    this.loadBookings();
  }

  isAdmin(): boolean {
    return this.auth.isAdminOrSupervisor();
  }

  isAdminOnly(): boolean {
    return this.auth.isAdmin();
  }

  isSupervisor(): boolean {
    return this.auth.isSupervisor();
  }

  onLogout(): void {
    const ok = confirm('Are you sure you want to logout?');
    if (!ok) return;
    this.auth.logout();
  }

  loadBookings(): void {
    this.isLoading = true;
    this.isUnauthorized = false;
    this.isForbidden = false;
    this.errorMessage = '';

    this.bookingService.getBookings().subscribe({
      next: (bookings) => {
        this.bookings = Array.isArray(bookings) ? bookings : [];
        for (const b of this.bookings) {
          const id = String(b?._id ?? '').trim();
          if (!id) continue;

          if (!this.editingSupervisorBookingIds.has(id)) {
            const supervisorId = this.getAssignedSupervisorId(b);
            this.selectedSupervisorByBookingId[id] = supervisorId;
          }

          if (!this.editingEmployeesBookingIds.has(id)) {
            this.selectedEmployeesByBookingId[id] = this.getAssignedEmployeeIds(b);
          }

          this.quoteDraftByBookingId[id] = this.buildQuoteDraftState(b);
        }
        this.applyFilters();
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

  loadEmployees(): void {
    if (!this.isAdmin()) return;
    this.isEmployeesLoading = true;
    this.employeesService.listEmployees().subscribe({
      next: (employees) => {
        this.employees = Array.isArray(employees) ? employees : [];
        const list = Array.isArray(this.employees) ? this.employees : [];

        const supervisors = list.filter((e) => String(e?.role ?? '').trim() === 'supervisor');
        const employeesOnly = list.filter((e) => String(e?.role ?? '').trim() === 'employee');

        const supActive = supervisors.filter((e) => e?.isActive);
        const supInactive = supervisors.filter((e) => !e?.isActive);
        this.supervisorsForAssignment = [...supActive, ...supInactive];

        const empActive = employeesOnly.filter((e) => e?.isActive);
        const empInactive = employeesOnly.filter((e) => !e?.isActive);
        this.employeesForAssignment = [...empActive, ...empInactive];
        this.applyFilters();
        this.isEmployeesLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load employees.';
        this.isEmployeesLoading = false;
      }
    });
  }

  trackByEmployeeId(_: number, e: Employee): string {
    return String(e?.id ?? '');
  }

  isEmployeeRole(): boolean {
    return this.auth.isEmployee();
  }

  getEmployeeSelectLabel(employee: Employee | null | undefined): string {
    const name = typeof employee?.name === 'string' ? employee.name.trim() : '';
    const email = typeof employee?.email === 'string' ? employee.email.trim() : '';
    return name || email || 'Employee';
  }

  private getEmployeeDisplayLabel(employee: Employee | null | undefined): string {
    const name = typeof employee?.name === 'string' ? employee.name.trim() : '';
    const email = typeof employee?.email === 'string' ? employee.email.trim() : '';
    return name || email || '';
  }

  isAssigning(bookingId: string | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    if (!id) return false;
    return this.assigningIds.has(id);
  }

  isQuoteActionLoading(bookingId: string | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    if (!id) return false;
    return this.quoteActionIds.has(id);
  }

  onSupervisorSelectionChanged(bookingId: string | null | undefined): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    this.editingSupervisorBookingIds.add(id);
  }

  onSupervisorSelectionDone(bookingId: string | null | undefined): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    this.editingSupervisorBookingIds.delete(id);
  }

  onEmployeesSelectionChanged(bookingId: string | null | undefined): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    this.editingEmployeesBookingIds.add(id);
  }

  toggleEmployeeForBooking(bookingId: string, employeeId: string, checked: boolean): void {
    const id = String(bookingId ?? '').trim();
    const empId = String(employeeId ?? '').trim();
    if (!id || !empId) return;
    this.editingEmployeesBookingIds.add(id);

    const current = Array.isArray(this.selectedEmployeesByBookingId[id]) ? this.selectedEmployeesByBookingId[id] : [];
    const set = new Set(current.map((x) => String(x ?? '').trim()).filter(Boolean));
    if (checked) set.add(empId);
    else set.delete(empId);
    this.selectedEmployeesByBookingId[id] = Array.from(set);
  }

  assignBooking(bookingId: string): void {
    if (!this.isAdmin()) return;
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    if (this.assigningIds.has(id)) return;

    const supervisorId = String(this.selectedSupervisorByBookingId[id] ?? '').trim();
    const employeeIds = Array.isArray(this.selectedEmployeesByBookingId[id])
      ? this.selectedEmployeesByBookingId[id].map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    if (!supervisorId && employeeIds.length === 0) return;

    this.editingSupervisorBookingIds.delete(id);
    this.editingEmployeesBookingIds.delete(id);
    this.assignmentSuccessMessageByBookingId[id] = '';
    this.assigningIds.add(id);
    this.bookingService
      .assignBooking(id, supervisorId, employeeIds)
      .pipe(finalize(() => this.assigningIds.delete(id)))
      .subscribe({
        next: () => {
          this.assignmentSuccessMessageByBookingId[id] = 'Assignment updated.';
          this.loadBookings();
        },
        error: (err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          if (httpErr?.status === 401) { this.isUnauthorized = true; return; }
          if (httpErr?.status === 403) { this.isForbidden = true; return; }
          const beMsg = typeof httpErr?.error?.message === 'string' ? httpErr.error.message : '';
          this.errorMessage = beMsg || 'Unable to assign booking.';
        }
      });
  }

  updateStatus(id: string, status: 'confirmed' | 'cancelled'): void {
    if (!this.auth.isAdmin()) return;
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

  startJob(id: string): void {
    if (!this.auth.isSupervisor()) return;
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return;
    if (this.jobActionIds.has(bookingId)) return;

    this.jobActionIds.add(bookingId);
    this.bookingService
      .startBooking(bookingId)
      .pipe(finalize(() => this.jobActionIds.delete(bookingId)))
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
            this.errorMessage = 'Not authorized to start job.';
            return;
          }
          this.errorMessage = 'Unable to start job.';
        }
      });
  }

  completeJob(id: string): void {
    if (!this.auth.isSupervisor()) return;
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return;
    if (this.jobActionIds.has(bookingId)) return;

    this.jobActionIds.add(bookingId);
    this.bookingService
      .completeBooking(bookingId)
      .pipe(finalize(() => this.jobActionIds.delete(bookingId)))
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
            this.errorMessage = 'Not authorized to complete job.';
            return;
          }
          this.errorMessage = 'Unable to complete job.';
        }
      });
  }

  isJobActionLoading(id: string | null | undefined): boolean {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return false;
    return this.jobActionIds.has(bookingId);
  }

  isUpdating(id: string | null | undefined): boolean {
    const bookingId = String(id ?? '').trim();
    if (!bookingId) return false;
    return this.updatingIds.has(bookingId);
  }

  trackByBookingId(_: number, b: Booking): string {
    return b?._id;
  }

  onFiltersChanged(): void {
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    const values = Object.values(this.filters || {});
    return values.some((v) => String(v ?? '').trim().length > 0);
  }

  clearFilters(): void {
    this.filters = {
      client: '',
      supervisor: '',
      employee: '',
      date: '',
      service: '',
      place: '',
      commercial: '',
    };
    this.applyFilters();
  }

  private applyFilters(): void {
    const list = Array.isArray(this.bookings) ? this.bookings : [];
    const f = this.filters || ({} as any);

    const clientNeedle = this.normalizeForSearch(f.client);
    const supervisorNeedle = this.normalizeForSearch(f.supervisor);
    const employeeNeedle = this.normalizeForSearch(f.employee);
    const dateNeedle = this.normalizeForSearch(f.date);
    const serviceNeedle = this.normalizeForSearch(f.service);
    const placeNeedle = this.normalizeForSearch(f.place);
    const commercialNeedle = this.normalizeForSearch(f.commercial);

    const hasAny =
      !!clientNeedle ||
      !!supervisorNeedle ||
      !!employeeNeedle ||
      !!dateNeedle ||
      !!serviceNeedle ||
      !!placeNeedle ||
      !!commercialNeedle;

    if (!hasAny) {
      this.filteredBookings = list;
      return;
    }

    this.filteredBookings = list.filter((b) => {
      const clientText = this.normalizeForSearch(b?.display?.customer?.name ?? (b as any)?.name ?? '');
      const supervisorText = this.normalizeForSearch(this.getSupervisorDisplay(b));
      const employeeText = this.normalizeForSearch(this.getEmployeesDisplay(b));
      const dateText = this.normalizeForSearch((b as any)?.desiredDate ?? '');
      const serviceText = this.normalizeForSearch(this.getServiceDisplay(b));
      const placeText = this.normalizeForSearch(b?.display?.property?.address ?? (b as any)?.address ?? '');
      const commercialText = this.normalizeForSearch(this.getCommercialStatusLabel(b));

      if (clientNeedle && !clientText.includes(clientNeedle)) return false;
      if (supervisorNeedle && !supervisorText.includes(supervisorNeedle)) return false;
      if (employeeNeedle && !employeeText.includes(employeeNeedle)) return false;
      if (dateNeedle && !dateText.includes(dateNeedle)) return false;
      if (serviceNeedle && !serviceText.includes(serviceNeedle)) return false;
      if (placeNeedle && !placeText.includes(placeNeedle)) return false;
      if (commercialNeedle && !commercialText.includes(commercialNeedle)) return false;
      return true;
    });
  }

  private normalizeForSearch(value: unknown): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  toggleDetails(bookingId: string | null | undefined): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    if (this.expandedBookingIds.has(id)) this.expandedBookingIds.delete(id);
    else this.expandedBookingIds.add(id);
  }

  isExpanded(bookingId: string | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    if (!id) return false;
    return this.expandedBookingIds.has(id);
  }

  getServiceDisplay(booking: Booking | null | undefined): string {
    const label = String(booking?.display?.service?.label ?? '').trim();
    if (label) return label;
    return String(booking?.cleaningType ?? '').trim() || '-';
  }

  getFrequencyDisplay(booking: Booking | null | undefined): string {
    const label = String(
      booking?.display?.schedule?.frequency?.label ?? '',
    ).trim();
    if (label) return label;
    const raw = String(booking?.frequency ?? '').trim();
    if (!raw) return 'One-time';
    return raw;
  }

  getPropertyDetails(
    booking: Booking | null | undefined,
  ): Array<{ label: string; value: string }> {
    const list = booking?.display?.property?.details;
    if (Array.isArray(list)) {
      return list
        .map((x) => ({
          label: String(x?.label ?? '').trim(),
          value: String(x?.value ?? '').trim(),
        }))
        .filter((x) => x.label && x.value);
    }
    return [];
  }

  getExtrasItems(
    booking: Booking | null | undefined,
  ): Array<{ label: string; quantity?: number }> {
    const items = booking?.display?.extras?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((x) => ({
        label: String(x?.label ?? '').trim(),
        quantity:
          typeof x?.quantity === 'number' && Number.isFinite(x.quantity)
            ? x.quantity
            : undefined,
      }))
      .filter((x) => x.label);
  }

  getCustomerNotes(booking: Booking | null | undefined): string {
    const fromDisplay = String(booking?.display?.notes ?? '').trim();
    if (fromDisplay) return fromDisplay;

    const dyn =
      booking?.dynamicFields && typeof booking.dynamicFields === 'object'
        ? (booking.dynamicFields as unknown as Record<string, unknown>)
        : {};

    const candidates = [
      dyn['notes'],
      dyn['customerNotes'],
      dyn['specialInstructions'],
      dyn['instructions'],
      dyn['comments'],
      dyn['comment'],
    ];
    for (const value of candidates) {
      if (typeof value !== 'string') continue;
      const cleaned = value.trim();
      if (!cleaned) continue;
      return cleaned;
    }

    return '';
  }

  getSpecialConditions(booking: Booking | null | undefined): string[] {
    const list = booking?.display?.specialConditions;
    if (!Array.isArray(list)) return [];
    return list.map((x) => String(x ?? '').trim()).filter(Boolean);
  }

  getPricingItems(
    booking: Booking | null | undefined,
  ): Array<{ label: string; amount: number }> {
    const items = booking?.display?.pricing?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((x) => ({
        label: String(x?.label ?? '').trim(),
        amount:
          typeof x?.amount === 'number' && Number.isFinite(x.amount)
            ? x.amount
            : NaN,
      }))
      .filter((x) => x.label && Number.isFinite(x.amount));
  }

  getPricingTotal(booking: Booking | null | undefined): number | null {
    const total = booking?.display?.pricing?.total;
    if (typeof total === 'number' && Number.isFinite(total)) return total;
    const raw = booking?.finalPricePreview;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    return null;
  }

  getEstimatedPrice(booking: Booking | null | undefined): number | null {
    const fromBooking = booking?.estimatedPrice;
    if (typeof fromBooking === 'number' && Number.isFinite(fromBooking)) return fromBooking;
    const fromDisplay = booking?.display?.pricing?.total;
    if (typeof fromDisplay === 'number' && Number.isFinite(fromDisplay)) return fromDisplay;
    return null;
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

  getCommercialStatusLabel(booking: Booking | null | undefined): string {
    const status = String(booking?.commercialStatus ?? '').trim();
    if (!status || status === 'legacy_direct_booking') return 'Legacy Booking';
    if (status === 'quote_requested') return 'Quote Requested';
    if (status === 'under_review') return 'Under Review';
    if (status === 'quoted_draft') return 'Draft Ready';
    if (status === 'quote_sent') return 'Quote Sent';
    if (status === 'quote_accepted') return 'Quote Accepted';
    if (status === 'quote_rejected') return 'Quote Rejected';
    if (status === 'quote_expired') return 'Quote Expired';
    if (status === 'closed_without_sale') return 'Closed Without Sale';
    return 'Commercial N/A';
  }

  getCommercialStatusClass(booking: Booking | null | undefined): string {
    const status = String(booking?.commercialStatus ?? '').trim();
    if (!status || status === 'legacy_direct_booking') return 'status-badge--legacy';
    if (status === 'quote_requested') return 'status-badge--quote-requested';
    if (status === 'under_review') return 'status-badge--under-review';
    if (status === 'quoted_draft') return 'status-badge--quote-draft';
    if (status === 'quote_sent') return 'status-badge--quote-sent';
    if (status === 'quote_accepted') return 'status-badge--quote-accepted';
    if (status === 'quote_rejected') return 'status-badge--quote-rejected';
    if (status === 'quote_expired') return 'status-badge--quote-expired';
    if (status === 'closed_without_sale') return 'status-badge--cancelled';
    return 'status-badge--unknown';
  }

  getPaymentLifecycleLabel(booking: Booking | null | undefined): string {
    const status = String(booking?.paymentLifecycleStatus ?? '').trim();
    if (!status) return 'Legacy / N/A';
    if (status === 'not_ready') return 'Not Ready';
    if (status === 'invoice_ready') return 'Invoice Ready';
    if (status === 'checkout_created') return 'Checkout Created';
    if (status === 'payment_pending') return 'Payment Pending';
    if (status === 'paid') return 'Paid';
    if (status === 'payment_failed') return 'Payment Failed';
    if (status === 'refunded') return 'Refunded';
    if (status === 'voided') return 'Voided';
    return status;
  }

  getQuoteStatusLabel(booking: Booking | null | undefined): string {
    const status = String(booking?.quote?.status ?? '').trim();
    if (!status) return 'No Quote Yet';
    if (status === 'draft') return 'Draft';
    if (status === 'sent') return 'Sent';
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Rejected';
    if (status === 'expired') return 'Expired';
    return status;
  }

  getQuoteAmount(booking: Booking | null | undefined): number | null {
    const quoted = booking?.quote?.finalQuotedPrice;
    if (typeof quoted === 'number' && Number.isFinite(quoted)) return quoted;
    return null;
  }

  getQuoteBasePrice(booking: Booking | null | undefined): number | null {
    const value = booking?.quote?.baseCalculatedPrice;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  }

  getQuoteVersion(booking: Booking | null | undefined): number | null {
    const value = booking?.quote?.version;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  }

  getQuoteManualAdjustments(
    booking: Booking | null | undefined
  ): Array<{ type: string; label: string; amount: number; reason?: string }> {
    const items = booking?.quote?.manualAdjustments;
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        type: String(item?.type ?? '').trim(),
        label: String(item?.label ?? '').trim(),
        amount:
          typeof item?.amount === 'number' && Number.isFinite(item.amount)
            ? item.amount
            : NaN,
        reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
      }))
      .filter((item) => item.label && Number.isFinite(item.amount));
  }

  getSupervisorDisplay(booking: Booking | null | undefined): string {
    if (!booking) return '-';
    const anyBooking = booking as any;
    const supName =
      typeof anyBooking?.assignedSupervisor?.name === 'string'
        ? String(anyBooking.assignedSupervisor.name).trim()
        : '';
    if (supName) return supName;

    const supId = this.getAssignedSupervisorId(booking);
    if (!supId) return '-';
    const sup = (this.employees || []).find((e) => String(e?.id ?? '').trim() === supId);
    const label = this.getEmployeeDisplayLabel(sup);
    return label || '-';
  }

  getEmployeesDisplay(booking: Booking | null | undefined): string {
    if (!booking) return '-';
    const anyBooking = booking as any;
    const assignedEmployees = Array.isArray(anyBooking?.assignedEmployees) ? anyBooking.assignedEmployees : [];
    const directNames = assignedEmployees
      .map((x: any) => (typeof x?.name === 'string' ? String(x.name).trim() : ''))
      .filter(Boolean);
    if (directNames.length) return directNames.join(', ');

    const employeeIds = this.getAssignedEmployeeIds(booking);
    if (employeeIds.length === 0) return '-';
    const labels = employeeIds
      .map((empId: string) => (this.employees || []).find((e) => String(e?.id ?? '').trim() === empId))
      .map((e) => this.getEmployeeDisplayLabel(e))
      .filter(Boolean);
    return labels.length ? labels.join(', ') : '-';
  }

  getSelectedEmployeesDisplay(bookingId: string | null | undefined): string {
    const id = String(bookingId ?? '').trim();
    if (!id) return '';
    const employeeIds = Array.isArray(this.selectedEmployeesByBookingId[id]) ? this.selectedEmployeesByBookingId[id] : [];
    if (!employeeIds.length) return '';
    const labels = employeeIds
      .map((empId) => {
        const normalized = String(empId ?? '').trim();
        const match = (this.employees || []).find((e) => String(e?.id ?? '').trim() === normalized);
        const label = this.getEmployeeDisplayLabel(match);
        return label || normalized;
      })
      .filter(Boolean);
    return labels.join(', ');
  }

  private getAssignedSupervisorId(booking: Booking | null | undefined): string {
    const anyBooking = booking as any;
    const direct =
      typeof anyBooking?.assignedSupervisor?.employeeId === 'string'
        ? String(anyBooking.assignedSupervisor.employeeId).trim()
        : '';
    if (direct) return direct;
    const legacy = String(anyBooking?.supervisorId ?? anyBooking?.assignedSupervisorId ?? '').trim();
    return legacy || '';
  }

  private getAssignedEmployeeIds(booking: Booking | null | undefined): string[] {
    const anyBooking = booking as any;
    const assignedEmployees = Array.isArray(anyBooking?.assignedEmployees) ? anyBooking.assignedEmployees : null;
    if (assignedEmployees && assignedEmployees.length) {
      const ids = assignedEmployees
        .map((x: any) => (typeof x?.employeeId === 'string' ? String(x.employeeId).trim() : ''))
        .filter(Boolean);
      return Array.from(new Set(ids));
    }

    const raw =
      anyBooking?.employeeIds ??
      anyBooking?.assignedEmployeeIds ??
      anyBooking?.assignedEmployees ??
      anyBooking?.employeeEmails ??
      [];
    const ids = Array.isArray(raw)
      ? raw
          .map((x: any) => {
            if (typeof x === 'string') return x.trim();
            if (x && typeof x === 'object') {
              const idValue = (x as any).employeeId ?? (x as any)._id ?? (x as any).id;
              return typeof idValue === 'string' ? idValue.trim() : '';
            }
            return '';
          })
          .filter(Boolean)
      : String(raw ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
    return Array.from(new Set(ids));
  }

  canSubmitAssignment(bookingId: string | null | undefined, booking: Booking | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    if (!id) return false;
    if (!this.isAdmin()) return false;
    if (!this.canAssign(booking)) return false;
    if (this.isAssigning(id)) return false;
    const sup = String(this.selectedSupervisorByBookingId[id] ?? '').trim();
    const employees = Array.isArray(this.selectedEmployeesByBookingId[id]) ? this.selectedEmployeesByBookingId[id] : [];
    // Fix 2: allow supervisor-only assignment (no employees selected).  Backend now supports it.
    return !!(sup || employees.length > 0);
  }

  formatTimestamp(value: unknown): string {
    if (!value) return '';
    const raw = value instanceof Date ? value : new Date(String(value));
    const time = raw.getTime();
    if (!Number.isFinite(time)) return '';

    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = raw.getFullYear();
    const mm = pad(raw.getMonth() + 1);
    const dd = pad(raw.getDate());
    const hh = pad(raw.getHours());
    const min = pad(raw.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  getAssignedAt(booking: Booking | null | undefined): string {
    return this.formatTimestamp((booking as any)?.assignedAt);
  }

  getStartedAt(booking: Booking | null | undefined): string {
    return this.formatTimestamp((booking as any)?.startedAt);
  }

  getCompletedAt(booking: Booking | null | undefined): string {
    return this.formatTimestamp((booking as any)?.completedAt);
  }

  getAssignmentHelperText(booking: Booking | null | undefined): string {
    if (!booking) return '';
    const status = booking.status;
    if (status === 'completed' || status === 'cancelled' || status === 'paid') {
      return 'Cannot assign completed/cancelled bookings';
    }
    return '';
  }

  canAssign(booking: Booking | null | undefined): boolean {
    const status = booking?.status;
    return status === 'confirmed' || status === 'assigned';
  }

  isFinalized(booking: Booking | null | undefined): boolean {
    const status = booking?.status;
    return status === 'cancelled' || status === 'completed' || status === 'paid';
  }

  canConfirm(booking: Booking | null | undefined): boolean {
    if (this.isQuoteFlowBooking(booking)) return false;
    return booking?.status === 'pending';
  }

  canCancel(booking: Booking | null | undefined): boolean {
    if (!booking) return false;
    return !this.isFinalized(booking) && booking.status !== 'cancelled';
  }

  isQuoteFlowBooking(booking: Booking | null | undefined): boolean {
    const commercialStatus = String(booking?.commercialStatus ?? '').trim();
    return !!commercialStatus && commercialStatus !== 'legacy_direct_booking';
  }

  canStartQuoteReview(booking: Booking | null | undefined): boolean {
    return booking?.commercialStatus === 'quote_requested';
  }

  canShowReviewQuoteButton(booking: Booking | null | undefined): boolean {
    if (!this.isAdminOnly()) return false;
    const status = String(booking?.commercialStatus ?? '').trim();
    return status === 'quote_requested' || status === 'under_review';
  }

  canEditQuoteDiscount(booking: Booking | null | undefined): boolean {
    if (!this.isAdminOnly()) return false;
    const status = String(booking?.commercialStatus ?? '').trim();
    return status === 'quote_requested' || status === 'under_review' || status === 'quoted_draft' || status === 'quote_sent';
  }

  canApplyDiscount(booking: Booking | null | undefined): boolean {
    if (!this.isAdminOnly()) return false;
    const status = String(booking?.commercialStatus ?? '').trim();
    return status === 'quote_requested' || status === 'under_review' || status === 'quoted_draft' || status === 'quote_sent';
  }

  /**
   * DISPLAY ONLY preview of discount percent for the UI (server-authoritative).
   * ⚠️ FRONTEND percent is ONLY for preview rendering. Backend always resolves
   * actual percent via SSoT resolveAdminQuoteDiscountPercent(discountType).
   * Frontend CANNOT override the server percentage — server authoritative mapping.
   */
  getPreviewDiscountPercent(discountType: AdminQuoteDiscountType | null | undefined): number {
    const id = discountType ?? 'none';
    const match = ADMIN_QUOTE_DISCOUNT_OPTIONS.find(o => o.id === id);
    return match?.percent ?? 0;
  }

  /**
   * Helper: return the preview DISCOUNT AMOUNT (display only) for the currently
   * calculated base and the Admin-selected discount type.
   *
   * ⚠️ The actual monetary amount is ONLY used for immediate UI preview. Backend
   * server-side recomputes it from scratch using the authoritative V2 pricing
   * engine + discountType mapping. FinalQuotedPrice ALWAYS comes from the
   * backend (booking.quote.finalQuotedPrice) when a draft has been saved.
   * If no discount selected on form, use the quote server-side values.
   */
  getPreviewQuoteDiscountAmount(
    bookingId: string | null | undefined,
    booking?: Booking | null | undefined
  ): number | null {
    const state = this.getQuoteDraftState(bookingId, booking);
    const base = this.getAuthoritativeCalculatedBaseForQuote(bookingId, booking);
    if (!(typeof base === 'number' && Number.isFinite(base))) return null;
    const pct = this.getPreviewDiscountPercent(state.discountType);
    return Number(((base * pct / 100).toFixed(2)));
  }

  /**
   * Helper: display-only preview Final Quote = base − discountAmount preview.
   * Backend ALWAYS recomputes; this is ONLY a preview so Admin sees a
   * human-readable value immediately. The real figure is never trusted by saveQuoteDraft().
   */
  getPreviewFinalQuotedPrice(
    bookingId: string | null | undefined,
    booking?: Booking | null | undefined
  ): number | null {
    const base = this.getAuthoritativeCalculatedBaseForQuote(bookingId, booking);
    const discountAmount = this.getPreviewQuoteDiscountAmount(bookingId, booking);
    if (base == null || discountAmount == null) return null;
    return Number((Math.max(0, base - discountAmount)).toFixed(2));
  }

  /**
   * § SURGICAL FIX (Legacy $20 contamination):
   * Return the FRESH authoritative base calculated price for the current
   * quote. NEVER use the persisted `quote.baseCalculatedPrice` or
   * `state.baseCalculatedPrice` because those fields might contain
   * arbitrary numbers from the previous free-form pricing workflow
   * (e.g. an old legacy test booking with quote.finalQuotedPrice=$20).
   *
   * Authoritative sources ONLY (never quote.* price fields):
   *   1. booking.estimatedPrice  (persisted by V2 pricing engine at
   *      booking-create time; undiscounted true baseline)
   *   2. line-items total (getPricingTotal) as fallback
   *
   * The backend saveQuoteDraft ALSO recomputes this baseline fresh every
   * save via `recomputeUndiscountedAuthoritativeBase`, so the UI and
   * backend agree on the fresh source of truth regardless of historical
   * quote.finalQuotedPrice = $20 records.
   */
  private getAuthoritativeCalculatedBaseForQuote(
    bookingId: string | null | undefined,
    booking?: Booking | null | undefined
  ): number | null {
    const b = booking;
    if (typeof b?.estimatedPrice === 'number' && Number.isFinite(b.estimatedPrice) && b.estimatedPrice > 0) {
      return Number(b.estimatedPrice);
    }
    const total = this.getPricingTotal(b);
    return typeof total === 'number' && Number.isFinite(total) ? total : null;
  }

  /**
   * Return the display label for the persisted (server-authoritative) quote.discountType.
   * Falls back to ADMIN_QUOTE_DISCOUNT_OPTIONS label.
   */
  getDiscountTypeDisplayLabel(booking: Booking | null | undefined): string {
    const type: AdminQuoteDiscountType = booking?.quote?.discountType ?? 'none';
    const match = ADMIN_QUOTE_DISCOUNT_OPTIONS.find(o => o.id === type);
    return match?.label ?? 'None — 0%';
  }

  canSaveQuoteDraft(booking: Booking | null | undefined): boolean {
    const status = String(booking?.commercialStatus ?? '').trim();
    return status === 'quote_requested' || status === 'under_review' || status === 'quoted_draft';
  }

  canSendQuote(booking: Booking | null | undefined): boolean {
    const status = String(booking?.commercialStatus ?? '').trim();
    if (!(status === 'under_review' || status === 'quoted_draft')) return false;
    // Must have a final quoted price (either from persisted booking.quote.finalQuotedPrice
    // or from the Admin-selected discount that produces a positive preview). Backend is the
    // ultimate source; but we gate here so the button only enables when a valid.
    const persistedFinal = booking?.quote?.finalQuotedPrice;
    if (typeof persistedFinal === 'number' && Number.isFinite(persistedFinal) && persistedFinal > 0) {
      return true;
    }
    const preview = this.getPreviewFinalQuotedPrice(booking?._id, booking);
    return typeof preview === 'number' && Number.isFinite(preview) && preview > 0;
  }

  canRejectQuote(booking: Booking | null | undefined): boolean {
    const status = String(booking?.commercialStatus ?? '').trim();
    return (
      status === 'quote_requested' ||
      status === 'under_review' ||
      status === 'quoted_draft' ||
      status === 'quote_sent'
    );
  }

  canExpireQuote(booking: Booking | null | undefined): boolean {
    return booking?.commercialStatus === 'quote_sent';
  }

  canReopenQuote(booking: Booking | null | undefined): boolean {
    if (!this.isAdminOnly()) return false;
    if (booking?.commercialStatus !== 'quote_rejected') return false;
    const legacy = String(booking?.status ?? '').trim();
    if (legacy === 'paid' || legacy === 'completed' || legacy === 'cancelled') return false;
    if (booking?.payment?.status === 'paid') return false;
    const lifecycle = String(booking?.paymentLifecycleStatus ?? '').trim();
    if (lifecycle === 'checkout_created' || lifecycle === 'paid' || lifecycle === 'payment_pending' || lifecycle === 'refunded') return false;
    return true;
  }

  canReviseQuote(booking: Booking | null | undefined): boolean {
    if (!this.isAdminOnly()) return false;
    if (booking?.commercialStatus !== 'quote_sent') return false;
    const legacy = String(booking?.status ?? '').trim();
    if (legacy === 'paid' || legacy === 'completed' || legacy === 'cancelled') return false;
    if (booking?.payment?.status === 'paid' || booking?.payment?.status === 'refunded') return false;
    const lifecycle = String(booking?.paymentLifecycleStatus ?? '').trim();
    if (lifecycle === 'checkout_created' || lifecycle === 'payment_pending' || lifecycle === 'paid' || lifecycle === 'refunded') return false;
    return true;
  }

  getQuoteActionHelperText(booking: Booking | null | undefined): string {
    if (!booking || !this.isQuoteFlowBooking(booking)) return '';
    const status = String(booking.commercialStatus ?? '').trim();
    if (status === 'quote_requested') return 'Start review to begin the commercial workflow.';
    if (status === 'under_review') return 'Save a draft quote before sending it to the customer.';
    if (status === 'quoted_draft') return 'Draft is ready. You can keep editing or send it.';
    if (status === 'quote_sent') return 'Waiting for customer response. You can revise, reject, or expire the quote.';
    if (status === 'quote_accepted') return 'Quote accepted. Continue with the operational workflow.';
    if (status === 'quote_rejected') return 'Quote closed as rejected.';
    if (status === 'quote_expired') return 'Quote validity ended without response.';
    return '';
  }

  getQuoteDraftState(
    bookingId: string | null | undefined,
    booking?: Booking | null | undefined
  ): QuoteDraftFormState {
    const id = String(bookingId ?? '').trim();
    if (!id) {
      return this.createEmptyQuoteDraftState();
    }
    if (!this.quoteDraftByBookingId[id]) {
      this.quoteDraftByBookingId[id] = this.buildQuoteDraftState(booking);
    }
    return this.quoteDraftByBookingId[id];
  }

  updateQuoteDraftField(
    bookingId: string | null | undefined,
    field: QuoteDraftField,
    value: unknown,
    booking?: Booking | null | undefined
  ): void {
    const state = this.getQuoteDraftState(bookingId, booking);
    if (field === 'baseCalculatedPrice') {
      if (value === '' || value === null || value === undefined) {
        state[field] = null;
        return;
      }
      const numeric = Number(value);
      state[field] = Number.isFinite(numeric) ? numeric : null;
      return;
    }
    if (field === 'discountType') {
      const valid = ADMIN_QUOTE_DISCOUNT_OPTIONS.some(o => o.id === value);
      state.discountType = valid ? (value as AdminQuoteDiscountType) : 'none';
      return;
    }
    state[field] = String(value ?? '');
  }

  startQuoteReview(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canStartQuoteReview(booking)) return;

    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    this.bookingService
      .startQuoteReview(id)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] = response?.message || 'Quote review started.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to start quote review.');
        }
      });
  }

  saveQuoteDraft(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canSaveQuoteDraft(booking)) return;

    const payload = this.buildQuoteDraftPayload(this.getQuoteDraftState(id, booking));
    if (!payload) {
      this.errorMessage = 'Add at least one quote field before saving the draft.';
      return;
    }

    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    this.bookingService
      .saveQuoteDraft(id, payload)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] = response?.message || 'Quote draft saved.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to save quote draft.');
        }
      });
  }

  sendQuote(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canSendQuote(booking)) return;

    const draftPayload = this.buildQuoteDraftPayload(this.getQuoteDraftState(id, booking));
    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    if (draftPayload) {
      this.bookingService
        .saveQuoteDraft(id, draftPayload)
        .subscribe({
          next: () => {
            this.bookingService.sendQuote(id)
              .pipe(finalize(() => this.quoteActionIds.delete(id)))
              .subscribe({
                next: (response) => {
                  this.quoteActionMessageByBookingId[id] = response?.message || 'Quote sent.';
                  this.loadBookings();
                },
                error: (err) => {
                  this.handleQuoteActionError(err, 'Unable to send quote.');
                }
              });
          },
          error: (err) => {
            this.quoteActionIds.delete(id);
            this.handleQuoteActionError(err, 'Unable to prepare quote before sending.');
          }
        });
      return;
    }

    this.bookingService
      .sendQuote(id)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] = response?.message || 'Quote sent.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to send quote.');
        }
      });
  }

  rejectQuote(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canRejectQuote(booking)) return;

    const confirmed = confirm(
      'Reject Quote?\n\nThis will close the current quote and notify the customer that the quote has been rejected. You can reopen the quote later if needed.'
    );
    if (!confirmed) return;

    const form = this.getQuoteDraftState(id, booking);
    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    this.bookingService
      .rejectQuote(id, {
        internalNotes: form.internalNotes?.trim() || undefined,
        rejectionReason: form.rejectionReason?.trim() || undefined,
      })
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] = response?.message || 'Quote rejected.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to reject quote.');
        }
      });
  }

  reopenQuote(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canReopenQuote(booking)) return;

    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    // Clear any cached draft state so reopened quote rebuilds from the
    // authoritative current baseline (never old legacy quote stored values).
    if (id && this.quoteDraftByBookingId[id]) {
      delete this.quoteDraftByBookingId[id];
    }
    this.bookingService
      .reopenQuote(id)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] =
            response?.message ||
            'Quote reopened. You can review and update the quote again.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to reopen quote.');
        }
      });
  }

  reviseQuote(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canReviseQuote(booking)) return;

    const confirmed = confirm(
      'Revise Sent Quote?\n\nThe current quote has already been sent to the customer. Reopening it will allow you to make changes and send an updated quote.'
    );
    if (!confirmed) return;

    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    // Clear stale cached draft state so revised quote starts from current
    // authoritative baseline + current stored NEW WORKFLOW quote values.
    if (id && this.quoteDraftByBookingId[id]) {
      delete this.quoteDraftByBookingId[id];
    }
    this.bookingService
      .reviseQuote(id)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] =
            response?.message ||
            'Quote revision started. You can edit and send an updated quote now.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to revise quote.');
        }
      });
  }

  expireQuote(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canExpireQuote(booking)) return;

    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    this.bookingService
      .expireQuote(id)
      .pipe(finalize(() => this.quoteActionIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.quoteActionMessageByBookingId[id] = response?.message || 'Quote expired.';
          this.loadBookings();
        },
        error: (err) => {
          this.handleQuoteActionError(err, 'Unable to expire quote.');
        }
      });
  }

  cancelDiscountPanel(booking: Booking): void {
    const id = String(booking?._id ?? '').trim();
    if (!id) return;
    if (id && this.quoteDraftByBookingId[id]) {
      delete this.quoteDraftByBookingId[id];
    }
    const el = document.getElementById('discount-panel-' + id) as
      | (HTMLDetailsElement & { open?: boolean })
      | null;
    if (el && typeof el.open === 'boolean') {
      el.open = false;
    }
  }

  applyDiscount(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.quoteActionIds.has(id) || !this.canApplyDiscount(booking)) return;

    const payload = this.buildQuoteDraftPayload(this.getQuoteDraftState(id, booking));
    if (!payload) {
      this.errorMessage = 'Select a discount or note before applying.';
      return;
    }

    const commercial = String(booking?.commercialStatus ?? '').trim();
    const needsReviseFirst = commercial === 'quote_sent';
    this.quoteActionMessageByBookingId[id] = '';
    this.quoteActionIds.add(id);
    const closePanel = (): void => {
      const el = document.getElementById('discount-panel-' + id) as
        | (HTMLDetailsElement & { open?: boolean })
        | null;
      if (el && typeof el.open === 'boolean') {
        el.open = false;
      }
    };

    const afterRevisedOrDirect = (): void => {
      this.bookingService
        .saveQuoteDraft(id, payload)
        .pipe(finalize(() => this.quoteActionIds.delete(id)))
        .subscribe({
          next: (response) => {
            this.quoteActionMessageByBookingId[id] =
              response?.message || 'Discount applied and quote saved.';
            if (this.quoteDraftByBookingId[id]) {
              delete this.quoteDraftByBookingId[id];
            }
            this.loadBookings();
            setTimeout(() => closePanel(), 0);
          },
          error: (err) => {
            this.handleQuoteActionError(err, 'Unable to apply the discount.');
          }
        });
    };

    if (needsReviseFirst) {
      this.bookingService.reviseQuote(id).subscribe({
        next: () => {
          afterRevisedOrDirect();
        },
        error: (err) => {
          this.quoteActionIds.delete(id);
          this.handleQuoteActionError(err, 'Unable to reopen the current quote for editing.');
        }
      });
      return;
    }

    afterRevisedOrDirect();
  }

  private handleQuoteActionError(err: unknown, fallbackMessage: string): void {
    const httpErr = err instanceof HttpErrorResponse ? err : null;
    if (httpErr?.status === 401) {
      this.isUnauthorized = true;
      return;
    }
    if (httpErr?.status === 403) {
      this.isForbidden = true;
      return;
    }
    const backendMessage =
      typeof httpErr?.error?.message === 'string'
        ? httpErr.error.message
        : typeof httpErr?.message === 'string'
          ? httpErr.message
          : '';
    this.errorMessage = backendMessage || fallbackMessage;
  }

  private createEmptyQuoteDraftState(): QuoteDraftFormState {
    return {
      baseCalculatedPrice: null,
      discountType: 'none',
      expiresAt: '',
      customerMessage: '',
      internalNotes: '',
      rejectionReason: '',
      discountReason: '',
    };
  }

  private buildQuoteDraftState(booking: Booking | null | undefined): QuoteDraftFormState {
    const quote: BookingQuoteViewModel | undefined = booking?.quote;
    const manualAdj = this.getQuoteManualAdjustments(booking);
    const existingDiscountReason: string =
      typeof quote?.discountReason === 'string' && quote.discountReason.trim()
        ? quote.discountReason.trim()
        : manualAdj.length > 0
          ? (manualAdj[manualAdj.length - 1].reason || manualAdj[manualAdj.length - 1].label || '')
          : '';
    // § FIX (Legacy $20 contamination): authoritative base for the form
    // display comes ONLY from FRESH sources (booking.estimatedPrice or
    // line-items total).  We explicitly do NOT read from
    // quote.baseCalculatedPrice because a legacy booking could have an
    // arbitrary $20.00 value stored there from the previous free-form
    // workflow.  Backend saveQuoteDraft recomputes this baseline fresh
    // from V2 pricing engine on every save anyway.
    const b = booking;
    const freshBase: number | null =
      typeof b?.estimatedPrice === 'number' && Number.isFinite(b.estimatedPrice) && b.estimatedPrice > 0
        ? Number(b.estimatedPrice)
        : this.getPricingTotal(b);
    let initialDiscountType: AdminQuoteDiscountType = (() => {
      const type = quote?.discountType;
      if (type && ADMIN_QUOTE_DISCOUNT_OPTIONS.some(o => o.id === type)) return type;
      if (
        booking?.discountApplied === true) {
        const pct = typeof booking.discountPercent;
        if (typeof pct === 'number' && Math.abs(pct - 15) < 0.01) return 'first_time_customer';
        if (typeof pct === 'number' && Math.abs(pct - 10) < 0.01) return 'regular_client';
        if (typeof pct === 'number' && Math.abs(pct - 20) < 0.01) return 'loyalty_customer';
      }
      return 'none';
    })();
    return {
      baseCalculatedPrice: freshBase ?? null,
      discountType: initialDiscountType,
      expiresAt: this.toDateInputValue(quote?.expiresAt),
      customerMessage: typeof quote?.customerMessage === 'string' ? quote.customerMessage : '',
      internalNotes: typeof quote?.internalNotes === 'string' ? quote.internalNotes : '',
      rejectionReason:
        typeof quote?.status === 'string' && quote.status === 'rejected' && typeof quote.customerMessage === 'string'
          ? quote.customerMessage
          : '',
      discountReason: existingDiscountReason,
    };
  }

  /**
   * § FIXED-DISCOUNT WORKFLOW payload.
   * Frontend ONLY sends:
   *   - discountType  (identifier only — none / regular_client / first_time_customer / loyalty_customer)
   *   - discountReason (optional, informational, never affects price)
   *   - expiresAt, customerMessage, internalNotes, rejectionReason (metadata)
   *
   * § EXPLICITLY NEVER SENT (backed by backend ignoring them anyway but we
   *   omit for strong intent + prevent accidental tampering vectors):
   *   - baseCalculatedPrice
   *   - finalQuotedPrice
   *   - manualAdjustments
   *   - any percentage field
   */
  private buildQuoteDraftPayload(form: QuoteDraftFormState): AdminQuoteDraftInput | null {
    const payload: AdminQuoteDraftInput = {};

    payload.discountType = form.discountType;

    if (form.discountReason?.trim()) {
      payload.discountReason = form.discountReason.trim();
    }
    if (typeof form.expiresAt === 'string' && form.expiresAt.trim()) {
      payload.expiresAt = form.expiresAt.trim();
    }
    if (typeof form.customerMessage === 'string' && form.customerMessage.trim()) {
      payload.customerMessage = form.customerMessage.trim();
    }
    if (typeof form.internalNotes === 'string' && form.internalNotes.trim()) {
      payload.internalNotes = form.internalNotes.trim();
    }

    if (Object.keys(payload).length === 0) return null;
    return payload;
  }

  private toDateInputValue(value: unknown): string {
    if (!value) return '';
    const raw = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(raw.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  }

  // =====================================================================
  // First-Service Discount Admin UI + Customer Special Instructions display
  // =====================================================================

  private readBoolAny(booking: Booking | null | undefined, ...keys: (keyof Booking)[]): boolean | null {
    if (!booking || typeof booking !== 'object') return null;
    for (const k of keys) {
      const v = (booking as unknown as Record<string, unknown>)[String(k)];
      if (v === true) return true;
      if (v === false) return false;
    }
    return null;
  }

  hasAnyCustomerOrDiscountInfo(booking: Booking | null | undefined): boolean {
    if (!booking) return false;
    return Boolean(
      this.getFirstServiceDiscountRequestedLabel(booking) !== 'Not Requested' ||
      this.getFirstServiceDiscountAppliedLabel(booking) !== 'Not Applied' ||
      this.getDiscountAmount(booking) !== null ||
      this.getPetsAtHomeLabel(booking) !== 'No' ||
      this.getPetSafetyNotes(booking) ||
      this.getUsesOwnProductsLabel(booking) !== 'No' ||
      this.getCleaningProductNotes(booking)
    );
  }

  getFirstServiceDiscountRequestedLabel(booking: Booking | null | undefined): string {
    const b = booking ?? ({} as Booking);
    const v = this.readBoolAny(b, 'firstServiceDiscountRequested', 'applyFirstDiscount');
    if (v === true) return 'Yes (customer requested review)';
    if (v === false) return 'Not Requested';
    return 'Not Requested';
  }

  getFirstServiceDiscountAppliedLabel(booking: Booking | null | undefined): string {
    const b = booking ?? ({} as Booking);
    const any = b as unknown as Record<string, unknown>;
    if (any['discountApplied'] === true) return 'Yes (approved by admin)';
    if (any['discountApplied'] === false) return 'Not Applied';
    return 'Not Applied';
  }

  hasDiscountMetadata(booking: Booking | null | undefined): boolean {
    const b = booking ?? ({} as Booking);
    const any = b as unknown as Record<string, unknown>;
    return any['discountApplied'] === true;
  }

  getDiscountAmount(booking: Booking | null | undefined): number | null {
    const b = booking ?? ({} as Booking);
    const any = b as unknown as Record<string, unknown>;
    const raw = any['discountAmount'];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    return null;
  }

  getPetsAtHomeLabel(booking: Booking | null | undefined): string {
    const v = this.readBoolAny(booking ?? ({} as Booking), 'petsAtHome');
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    return 'No';
  }

  getPetSafetyNotes(booking: Booking | null | undefined): string {
    const raw = (booking as unknown as Record<string, unknown>)?.['petSafetyNotes'];
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }

  getUsesOwnProductsLabel(booking: Booking | null | undefined): string {
    const v = this.readBoolAny(booking ?? ({} as Booking), 'usesOwnCleaningProducts', 'useOwnProducts');
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    return 'No';
  }

  getCleaningProductNotes(booking: Booking | null | undefined): string {
    const raw = (booking as unknown as Record<string, unknown>)?.['cleaningProductNotes'];
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }

  isApplyingFirstServiceDiscount(bookingId: string | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    return !!id && this.applyingFirstServiceDiscountIds.has(id);
  }

  canApplyFirstServiceDiscount(booking: Booking | null | undefined): boolean {
    if (!booking || !this.isAdminOnly()) return false;
    const any = booking as unknown as Record<string, unknown>;
    if (any['discountApplied'] === true) return false;
    const requested = this.readBoolAny(booking, 'firstServiceDiscountRequested', 'applyFirstDiscount');
    if (requested !== true) return false;
    const addr = typeof booking.address === 'string' ? booking.address.trim() : '';
    return !!addr;
  }

  getApplyFirstServiceDiscountHelperText(booking: Booking | null | undefined): string {
    if (!booking) return '';
    const any = booking as unknown as Record<string, unknown>;
    if (any['discountApplied'] === true) return 'Discount already applied for this booking.';
    const requested = this.readBoolAny(booking, 'firstServiceDiscountRequested', 'applyFirstDiscount');
    if (requested !== true) return 'Customer did not request first-service review.';
    const addr = typeof booking.address === 'string' ? booking.address.trim() : '';
    if (!addr) return 'Booking address is missing; cannot validate first-time eligibility.';
    return '';
  }

  applyFirstServiceDiscount(bookingId: string | null | undefined): void {
    if (!this.isAdminOnly()) return;
    const id = String(bookingId ?? '').trim();
    const booking = this.bookings.find(b => String(b?._id ?? '').trim() === id) || null;
    if (!id || this.applyingFirstServiceDiscountIds.has(id) || !this.canApplyFirstServiceDiscount(booking)) return;

    this.discountActionSuccessByBookingId[id] = '';
    this.discountActionErrorByBookingId[id] = '';
    this.applyingFirstServiceDiscountIds.add(id);
    this.bookingService
      .applyFirstServiceDiscount(id)
      .pipe(finalize(() => this.applyingFirstServiceDiscountIds.delete(id)))
      .subscribe({
        next: (response) => {
          this.discountActionSuccessByBookingId[id] =
            response?.message || '15% first-service discount applied successfully.';
          this.loadBookings();
        },
        error: (err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          if (httpErr?.status === 401) { this.isUnauthorized = true; return; }
          if (httpErr?.status === 403) { this.isForbidden = true; return; }
          const backendMessage =
            typeof httpErr?.error?.message === 'string'
              ? httpErr.error.message
              : typeof httpErr?.message === 'string'
                ? httpErr.message
                : '';
          this.discountActionErrorByBookingId[id] = backendMessage || 'Unable to apply the discount at this time.';
        }
      });
  }

  // =====================================================================
  // Admin: Confirm & Send Payment
  // =====================================================================

  isConfirmingSendPayment(bookingId: string | null | undefined): boolean {
    const id = String(bookingId ?? '').trim();
    return !!id && this.confirmingSendPaymentIds.has(id);
  }

  canConfirmAndSendPayment(booking: Booking | null | undefined): boolean {
    if (!booking || !this.isAdminOnly()) return false;
    if (this.isFinalized(booking)) return false;
    const status = booking.status;
    if (status === 'cancelled' || status === 'paid' || status === 'completed') return false;
    if (booking.paymentUrl) return false;
    return status === 'pending' ||
           status === 'confirmed' ||
           booking.commercialStatus === 'quote_accepted' ||
           booking.commercialStatus === 'quoted_draft' ||
           booking.commercialStatus === 'under_review' ||
           booking.commercialStatus === 'quote_sent' ||
           booking.commercialStatus === 'legacy_direct_booking';
  }

  getConfirmSendHelperText(booking: Booking | null | undefined): string {
    if (!booking) return '';
    if (this.isFinalized(booking)) return 'Booking already finalized (paid/completed/cancelled).';
    if (booking.paymentUrl) return 'Payment link already issued. Use the existing link.';
    return '';
  }

  confirmAndSendPayment(booking: Booking): void {
    if (!this.isAdminOnly()) return;
    const id = String(booking?._id ?? '').trim();
    if (!id || this.confirmingSendPaymentIds.has(id) || !this.canConfirmAndSendPayment(booking)) return;

    this.confirmActionSuccessByBookingId[id] = '';
    this.confirmActionErrorByBookingId[id] = '';
    this.confirmWasAlreadyIssuedByBookingId[id] = false;
    this.confirmingSendPaymentIds.add(id);

    this.bookingService
      .confirmAndSendPayment(id)
      .pipe(finalize(() => this.confirmingSendPaymentIds.delete(id)))
      .subscribe({
        next: (response: AdminConfirmAndSendPaymentResponse) => {
          this.confirmWasAlreadyIssuedByBookingId[id] = !!response?.wasAlreadyIssued;
          this.confirmActionSuccessByBookingId[id] =
            response?.message ||
            (response?.wasAlreadyIssued
              ? 'Payment link was already issued previously.'
              : 'Payment confirmed, Stripe link created and email sent to customer.');
          this.loadBookings();
        },
        error: (err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          if (httpErr?.status === 401) { this.isUnauthorized = true; return; }
          if (httpErr?.status === 403) { this.isForbidden = true; return; }
          const backendMessage =
            typeof httpErr?.error?.message === 'string'
              ? httpErr.error.message
              : typeof httpErr?.message === 'string'
                ? httpErr.message
                : '';
          this.confirmActionErrorByBookingId[id] = backendMessage || 'Unable to confirm booking or send payment link.';
        }
      });
  }

  // =====================================================================
  // Admin: Soft Cancel (with modal)
  // =====================================================================

  canSoftCancel(booking: Booking | null | undefined): boolean {
    if (!booking || !this.isAdminOnly()) return false;
    return !this.isFinalized(booking) && booking.status !== 'cancelled';
  }

  openCancelModal(booking: Booking): void {
    if (!this.canSoftCancel(booking)) return;
    const id = String(booking?._id ?? '').trim();
    if (!id) return;
    this.cancelTargetBookingId = id;
    this.cancelForm = { cancellationReason: '', internalNotes: '' };
    this.cancelError = '';
    this.cancelSubmitting = false;
    this.cancelModalOpen = true;
  }

  closeCancelModal(): void {
    this.cancelModalOpen = false;
    this.cancelTargetBookingId = null;
    this.cancelForm = { cancellationReason: '', internalNotes: '' };
    this.cancelError = '';
    this.cancelSubmitting = false;
  }

  submitCancel(): void {
    const id = String(this.cancelTargetBookingId ?? '').trim();
    if (!id || this.cancelSubmitting) return;

    const booking = this.bookings.find(b => String(b?._id ?? '').trim() === id) || null;
    if (!this.canSoftCancel(booking)) {
      this.cancelError = 'Booking cannot be cancelled in its current state.';
      return;
    }

    const payload: AdminCancelBookingInput = {};
    const reason = this.cancelForm.cancellationReason.trim();
    const notes = this.cancelForm.internalNotes.trim();
    if (reason) payload.cancellationReason = reason;
    if (notes) payload.internalNotes = notes;

    this.cancelError = '';
    this.cancelSubmitting = true;
    this.bookingService
      .cancelBookingByAdmin(id, payload)
      .pipe(finalize(() => { this.cancelSubmitting = false; }))
      .subscribe({
        next: () => {
          this.closeCancelModal();
          this.loadBookings();
        },
        error: (err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          if (httpErr?.status === 401) { this.isUnauthorized = true; this.closeCancelModal(); return; }
          if (httpErr?.status === 403) { this.isForbidden = true; this.closeCancelModal(); return; }
          const backendMessage =
            typeof httpErr?.error?.message === 'string'
              ? httpErr.error.message
              : typeof httpErr?.message === 'string'
                ? httpErr.message
                : '';
          this.cancelError = backendMessage || 'Unable to cancel booking.';
        }
      });
  }

  // =====================================================================
  // Admin: Permanent Delete (re-auth modal)
  // =====================================================================

  canDeletePermanent(booking: Booking | null | undefined): boolean {
    return !!booking && this.isAdminOnly();
  }

  openDeleteModal(booking: Booking): void {
    if (!this.canDeletePermanent(booking)) return;
    const id = String(booking?._id ?? '').trim();
    if (!id) return;
    this.deleteTargetBookingId = id;
    this.deleteForm = { email: '', password: '' };
    this.deleteError = '';
    this.deleteSubmitting = false;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.deleteTargetBookingId = null;
    this.deleteForm = { email: '', password: '' };
    this.deleteError = '';
    this.deleteSubmitting = false;
  }

  submitDelete(): void {
    const id = String(this.deleteTargetBookingId ?? '').trim();
    if (!id || this.deleteSubmitting) return;

    const email = this.deleteForm.email.trim();
    const password = this.deleteForm.password;
    if (!email || !password) {
      this.deleteError = 'Both email and password are required for re-authentication.';
      return;
    }

    const payload: AdminDeletePermanentReAuth = { email, password };

    this.deleteError = '';
    this.deleteSubmitting = true;
    this.bookingService
      .deleteBookingPermanent(id, payload)
      .pipe(finalize(() => { this.deleteSubmitting = false; }))
      .subscribe({
        next: (_response: AdminDeletePermanentResponse) => {
          this.closeDeleteModal();
          this.loadBookings();
        },
        error: (err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          if (httpErr?.status === 401) {
            this.deleteError = 'Re-authentication failed: invalid email or password.';
            return;
          }
          if (httpErr?.status === 403) {
            this.deleteError = 'Forbidden: re-authenticated user must be an Admin.';
            return;
          }
          if (httpErr?.status === 400) {
            const backendMessage = typeof httpErr?.error?.message === 'string' ? httpErr.error.message : '';
            this.deleteError = backendMessage || 'Invalid request payload.';
            return;
          }
          const backendMessage =
            typeof httpErr?.error?.message === 'string'
              ? httpErr.error.message
              : typeof httpErr?.message === 'string'
                ? httpErr.message
                : '';
          this.deleteError = backendMessage || 'Unable to delete booking.';
        }
      });
  }

  // =====================================================================
  // FR-12: Exhaustive customer fields + Triple price audit helpers
  // =====================================================================

  getBedroomsCount(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const any = booking as unknown as Record<string, unknown>;
    const candidates = [
      booking.bedrooms,
      any['bedrooms'],
      booking.dynamicFields?.bedrooms,
    ];
    for (const v of candidates) {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return null;
  }

  getBathroomsCount(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const any = booking as unknown as Record<string, unknown>;
    const candidates = [
      booking.bathrooms,
      any['bathrooms'],
      booking.dynamicFields?.bathrooms,
    ];
    for (const v of candidates) {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return null;
  }

  getAdditionalBedroomsCount(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const any = booking as unknown as Record<string, unknown>;
    const candidates = [
      booking.additionalBedrooms,
      any['additionalBedrooms'],
      booking.dynamicFields?.additionalBedrooms,
      booking.dynamicFields?.extraBedrooms,
      booking.dynamicFields?.aptExtraBedrooms,
      booking.dynamicFields?.deepExtraBedrooms,
    ];
    for (const v of candidates) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    }
    return null;
  }

  getSpecialServiceId(booking: Booking | null | undefined): string | null {
    if (!booking || !booking.specialServiceId) return null;
    return booking.specialServiceId;
  }

  getRegularPackageId(booking: Booking | null | undefined): string | null {
    if (!booking || !booking.regularCleaningPackageId) return null;
    return booking.regularCleaningPackageId;
  }

  getBorderlineFee(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const any = booking as unknown as Record<string, unknown>;
    const v = booking.borderlineFee ?? any['borderlineFee'];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    return null;
  }

  getBookingNotes(booking: Booking | null | undefined): string {
    if (!booking) return '';
    const any = booking as unknown as Record<string, unknown>;
    const v = booking.notes ?? any['notes'];
    return typeof v === 'string' ? v.trim() : '';
  }

  hasExhaustiveFields(booking: Booking | null | undefined): boolean {
    if (!booking) return false;
    return Boolean(
      this.getBedroomsCount(booking) !== null ||
      this.getBathroomsCount(booking) !== null ||
      this.getAdditionalBedroomsCount(booking) !== null ||
      this.getSpecialServiceId(booking) !== null ||
      this.getRegularPackageId(booking) !== null ||
      this.getBorderlineFee(booking) !== null ||
      this.getBookingNotes(booking)
    );
  }

  /**
   * § FIX (Legacy $20 contamination): Audit "Calculated Price" row.
   * Uses FRESH authoritative sources ONLY — NEVER reads from quote.*
   * price fields which may contain arbitrary legacy numbers.
   */
  getTripleCalculatedPrice(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const estimated = booking.estimatedPrice;
    if (typeof estimated === 'number' && Number.isFinite(estimated) && estimated > 0) {
      return estimated;
    }
    return this.getPricingTotal(booking);
  }

  getTripleDiscountAmount(booking: Booking | null | undefined): number | null {
    // NEW FIXED-DISCOUNT MODEL: only consider quote.discountAmount when the
    // quote is a NEW-workflow quote that contains a valid discountType
    // identifier. This prevents legacy arbitrary quotes (which contain
    // discountAmount but no discountType) from contaminating the active UI.
    const q = booking?.quote;
    if (q && typeof (q as any).discountType === 'string' && (q as any).discountType.trim()) {
      const v = (q as any).discountAmount;
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
      return null;
    }
    // Legacy booking-level discountApplied (customer eligibility path):
    const legacy = this.getDiscountAmount(booking);
    if (legacy !== null && legacy > 0) return legacy;
    return null;
  }

  /**
   * § Audit UI: return the Discount Type display label for the current booking.
   * Uses quote.discountType if present (NEW WORKFLOW fixed discount).
   * Falls back to legacy booking.discountApplied=true → mapping to percent.
   */
  getTripleDiscountTypeDisplay(booking: Booking | null | undefined): string {
    if (!booking) return '';
    if (booking.quote?.discountType) {
      return this.getDiscountTypeDisplayLabel(booking);
    }
    // Legacy fallback: discountApplied + booking.discountPercent
    const any = booking as unknown as Record<string, unknown>;
    if (any['discountApplied'] === true) {
      const pct = any['discountPercent'];
      if (typeof pct === 'number' && Number.isFinite(pct)) {
        if (Math.abs(pct - 20) < 0.01) return 'Loyalty Customer Discount — 20%';
        if (Math.abs(pct - 15) < 0.01) return 'First-Time Customer Discount — 15%';
        if (Math.abs(pct - 10) < 0.01) return 'Regular Client Discount — 10%';
        if (Math.abs(pct) < 0.01) return 'None — 0%';
        return `Legacy Discount — ${pct}%`;
      }
      return 'Legacy Discount Applied';
    }
    return '';
  }

  /**
   * § Final Quoted Price (draft / sent quote) = Server-authoritative quoted total.
   * IMPORTANT: only return the stored finalQuotedPrice when the quote belongs
   * to the NEW fixed-discount workflow (quote.discountType is set as a valid
   * identifier). Otherwise the stored value is an arbitrary legacy number
   * from the old free-form editing path — we MUST NOT display it as the
   * current Final Quote (e.g. legacy $20 bookings). In that case we return
   * null so the Audit UI shows '-' until the Admin saves a new draft via the
   * new fixed-discount workflow, which recomputes everything server-side.
   */
  getTripleFinalQuoteAmount(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const q = booking.quote;
    if (!q) return null;
    const hasNewWorkflowDiscountType =
      typeof (q as any).discountType === 'string' &&
      (q as any).discountType.trim().length > 0;
    if (!hasNewWorkflowDiscountType) {
      return null;
    }
    const v = (q as any).finalQuotedPrice;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    return null;
  }

  getTripleAdminAdjustment(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const adj = booking.adminAdjustedAmountUsd;
    // NEW FIXED-DISCOUNT MODEL: Admin never manually adjusts an arbitrary dollar amount.
    // The discount is always one of the 4 authorized types (none/10/15/20%) handled by
    // quote.discountAmount — NOT represented by adminAdjustedAmountUsd. So we ONLY
    // display the explicit persisted adminAdjustedAmountUsd if set (legacy compatibility).
    if (typeof adj === 'number' && Number.isFinite(adj) && Math.abs(adj) > 0.005) return adj;
    return null;
  }

  getTripleFinalPrice(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    // IMPORTANT §15 Fix 3: NO FALLBACK to line items / estimated / quoted / preview.
    // Only the explicit Confirm & Send Payment operation persists booking.finalAdminApprovedPrice.
    // Before that, this UI cell MUST remain as '-'.
    const approved = booking.finalAdminApprovedPrice;
    if (typeof approved === 'number' && Number.isFinite(approved)) return approved;
    return null;
  }

  getTripleAdjustmentReason(booking: Booking | null | undefined): string {
    if (!booking) return '';
    const reason = booking.priceAdjustmentReason;
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
    const adjustments = this.getQuoteManualAdjustments(booking);
    if (adjustments.length === 1) {
      return adjustments[0].reason || adjustments[0].label;
    }
    if (adjustments.length > 1) {
      return adjustments.map(a => a.reason || a.label).filter(Boolean).join('; ');
    }
    return '';
  }

  hasPriceAudit(booking: Booking | null | undefined): boolean {
    if (!booking) return false;
    return Boolean(
      this.getTripleCalculatedPrice(booking) !== null ||
      this.getTripleDiscountAmount(booking) !== null ||
      this.getTripleAdminAdjustment(booking) !== null ||
      this.getTripleFinalPrice(booking) !== null ||
      this.getTripleAdjustmentReason(booking)
    );
  }

  getCanonicalFinalPrice(booking: Booking | null | undefined): number | null {
    if (!booking) return null;
    const approved = this.getTripleFinalPrice(booking);
    if (approved !== null && Number.isFinite(approved)) return approved;
    const finalQuote = this.getTripleFinalQuoteAmount(booking);
    if (finalQuote !== null && Number.isFinite(finalQuote)) return finalQuote;
    const quoteAmount = this.getQuoteAmount(booking);
    if (quoteAmount !== null && Number.isFinite(quoteAmount)) return quoteAmount;
    return this.getPricingTotal(booking);
  }

  copyPaymentLinkToClipboard(booking: Booking): void {
    const id = String(booking?._id ?? '').trim();
    if (!id) return;
    const url = typeof (booking as any).paymentUrl === 'string'
      ? String((booking as any).paymentUrl).trim()
      : '';
    if (!url) return;

    this.copyPaymentLinkSuccessByBookingId[id] = false;
    this.copyPaymentLinkErrorByBookingId[id] = false;

    const clipboard = (navigator as any)?.clipboard;
    const hasWrite = !!(clipboard && typeof clipboard.writeText === 'function');

    const doCopy = (): Promise<void> => {
      if (hasWrite) {
        try {
          return Promise.resolve(clipboard.writeText(url) as Promise<void>);
        } catch (err) {
          return Promise.reject(err);
        }
      }
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    };

    doCopy()
      .then(() => {
        this.copyPaymentLinkSuccessByBookingId[id] = true;
        this.copyPaymentLinkErrorByBookingId[id] = false;
        setTimeout(() => {
          if (this.copyPaymentLinkSuccessByBookingId[id]) {
            this.copyPaymentLinkSuccessByBookingId[id] = false;
          }
        }, 2000);
      })
      .catch(() => {
        this.copyPaymentLinkSuccessByBookingId[id] = false;
        this.copyPaymentLinkErrorByBookingId[id] = true;
        setTimeout(() => {
          if (this.copyPaymentLinkErrorByBookingId[id]) {
            this.copyPaymentLinkErrorByBookingId[id] = false;
          }
        }, 3500);
      });
  }
}
