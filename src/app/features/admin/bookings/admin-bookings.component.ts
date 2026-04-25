import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Booking } from '../../../core/models/booking-request.model';
import { BookingService } from '../../../core/services/booking.service';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { EmployeesService, type Employee } from '../../../core/services/employees.service';

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

  filters = {
    client: '',
    supervisor: '',
    employee: '',
    date: '',
    service: '',
    place: '',
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
  private readonly editingSupervisorBookingIds = new Set<string>();
  private readonly editingEmployeesBookingIds = new Set<string>();
  private readonly expandedBookingIds = new Set<string>();

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
    if (!supervisorId || employeeIds.length === 0) return;

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
        error: () => {
          this.errorMessage = 'Unable to assign booking.';
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

    const hasAny =
      !!clientNeedle ||
      !!supervisorNeedle ||
      !!employeeNeedle ||
      !!dateNeedle ||
      !!serviceNeedle ||
      !!placeNeedle;

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

      if (clientNeedle && !clientText.includes(clientNeedle)) return false;
      if (supervisorNeedle && !supervisorText.includes(supervisorNeedle)) return false;
      if (employeeNeedle && !employeeText.includes(employeeNeedle)) return false;
      if (dateNeedle && !dateText.includes(dateNeedle)) return false;
      if (serviceNeedle && !serviceText.includes(serviceNeedle)) return false;
      if (placeNeedle && !placeText.includes(placeNeedle)) return false;
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
    return !!sup && employees.length > 0;
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
    return booking?.status === 'pending';
  }

  canCancel(booking: Booking | null | undefined): boolean {
    if (!booking) return false;
    return !this.isFinalized(booking) && booking.status !== 'cancelled';
  }
}
