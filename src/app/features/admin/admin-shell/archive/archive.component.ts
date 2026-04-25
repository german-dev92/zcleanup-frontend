import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Booking } from '../../../../core/models/booking-request.model';
import { BookingService } from '../../../../core/services/booking.service';

@Component({
  selector: 'app-archive',
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.scss']
})
export class ArchiveComponent implements OnInit {
  bookings: Booking[] = [];
  isLoading = false;
  errorMessage = '';
  selectedBooking: Booking | null = null;
  isDetailsOpen = false;
  private readonly flagsStorageKey = 'admin_archive_flags_v1';
  private rowFlagsByBookingId: Record<string, 'none' | 'call_client' | 'pending_invoice' | 'payment_issue' | 'archived'> = {};
  openFlagMenuBookingId: string | null = null;

  constructor(private readonly bookingService: BookingService) {}

  ngOnInit(): void {
    this.restoreFlags();
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.bookingService
      .getBookings()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (bookings) => {
          const raw = Array.isArray(bookings) ? bookings : [];
          this.bookings = raw.filter((b) => b?.status === 'completed' || b?.status === 'paid');
        },
        error: () => {
          this.errorMessage = 'Unable to load archive.';
        }
      });
  }

  trackByBookingId(_: number, b: Booking): string {
    return b?._id;
  }

  getAssignedEmployee(booking: Booking): string {
    const email = String((booking as any)?.assignedEmployeeEmail ?? '').trim();
    const id = String((booking as any)?.assignedEmployeeId ?? '').trim();
    return email || id || '-';
  }

  openDetails(booking: Booking): void {
    this.selectedBooking = booking;
    this.isDetailsOpen = true;
  }

  closeDetails(): void {
    this.isDetailsOpen = false;
    this.selectedBooking = null;
  }

  exportInvoicePdf(booking: Booking): void {
    const anyBooking = booking as any;
    const invoiceId = String(booking?._id ?? '').trim() || 'booking';
    const dateLine = `${String(booking?.desiredDate ?? '').trim()} · ${String(booking?.desiredTime ?? '').trim()}`.trim();
    const customerName = String(booking?.display?.customer?.name ?? booking?.name ?? '').trim() || '-';
    const customerEmail = String(booking?.display?.customer?.email ?? booking?.email ?? '').trim() || '-';
    const customerPhone = String(booking?.display?.customer?.phone ?? booking?.phone ?? '').trim() || '-';
    const address = String(booking?.display?.property?.address ?? booking?.address ?? '').trim() || '-';
    const service = this.getServiceDisplay(booking);
    const supervisor = this.getSupervisorDisplay(booking);
    const employees = this.getEmployeesDisplay(booking);
    const assignedAt = this.formatTimestamp(anyBooking?.assignedAt) || '-';
    const startedAt = this.formatTimestamp(anyBooking?.startedAt) || '-';
    const completedAt = this.formatTimestamp(anyBooking?.completedAt) || '-';
    const extras = this.getExtrasItems(booking);
    const special = this.getSpecialConditions(booking);
    const notes = this.getNotes(booking);
    const pricingItems = this.getPricingItems(booking);
    const pricingTotal = this.getPricingTotal(booking);

    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const lineItemsHtml = pricingItems.length
      ? pricingItems
          .map(
            (x) => `
            <tr>
              <td>${escapeHtml(x.label)}</td>
              <td class="num">$${x.amount.toFixed(2)}</td>
            </tr>
          `
          )
          .join('')
      : `
        <tr>
          <td>Final Price</td>
          <td class="num">${escapeHtml(this.getFinalPrice(booking))}</td>
        </tr>
      `;

    const extrasHtml = extras.length ? extras.map((x) => escapeHtml(x)).join(', ') : '-';
    const specialHtml = special.length ? special.map((x) => escapeHtml(x)).join(', ') : '-';

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice - ${escapeHtml(invoiceId)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; }
      .top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .brand { font-size: 18px; font-weight: 800; }
      .muted { color: #475569; font-size: 12px; }
      .h1 { font-size: 22px; font-weight: 900; margin: 0; }
      .card { border: 1px solid rgba(15,23,42,0.12); border-radius: 12px; padding: 14px; margin-top: 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
      .kv .k { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
      .kv .v { margin-top: 4px; font-size: 13px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid rgba(15,23,42,0.1); vertical-align: top; }
      th { background: #f8fafc; font-weight: 800; }
      .num { text-align: right; white-space: nowrap; }
      .total { font-size: 14px; font-weight: 900; }
      .section-title { font-weight: 900; margin: 0 0 8px 0; }
      @media print { body { margin: 0; } .card { border: 0; padding: 0; } }
    </style>
  </head>
  <body>
    <div class="top">
      <div>
        <div class="brand">ZCleanUp</div>
        <div class="muted">Invoice</div>
      </div>
      <div style="text-align:right">
        <div class="h1">Invoice</div>
        <div class="muted">Booking ID: ${escapeHtml(invoiceId)}</div>
        <div class="muted">Schedule: ${escapeHtml(dateLine || '-')}</div>
      </div>
    </div>

    <div class="card">
      <div class="grid">
        <div class="kv">
          <div class="k">Client</div>
          <div class="v">${escapeHtml(customerName)}</div>
        </div>
        <div class="kv">
          <div class="k">Service</div>
          <div class="v">${escapeHtml(service)}</div>
        </div>
        <div class="kv">
          <div class="k">Email</div>
          <div class="v">${escapeHtml(customerEmail)}</div>
        </div>
        <div class="kv">
          <div class="k">Phone</div>
          <div class="v">${escapeHtml(customerPhone)}</div>
        </div>
        <div class="kv" style="grid-column: 1 / -1">
          <div class="k">Address</div>
          <div class="v">${escapeHtml(address)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Assignment & Timestamps</div>
      <div class="grid">
        <div class="kv">
          <div class="k">Supervisor</div>
          <div class="v">${escapeHtml(supervisor)}</div>
        </div>
        <div class="kv">
          <div class="k">Employees</div>
          <div class="v">${escapeHtml(employees)}</div>
        </div>
        <div class="kv">
          <div class="k">Assigned</div>
          <div class="v">${escapeHtml(assignedAt)}</div>
        </div>
        <div class="kv">
          <div class="k">Started</div>
          <div class="v">${escapeHtml(startedAt)}</div>
        </div>
        <div class="kv">
          <div class="k">Completed</div>
          <div class="v">${escapeHtml(completedAt)}</div>
        </div>
        <div class="kv">
          <div class="k">Status</div>
          <div class="v">${escapeHtml(String(booking?.status ?? '-'))}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Extras & Notes</div>
      <div class="grid">
        <div class="kv" style="grid-column: 1 / -1">
          <div class="k">Extras</div>
          <div class="v">${escapeHtml(extrasHtml)}</div>
        </div>
        <div class="kv" style="grid-column: 1 / -1">
          <div class="k">Special Conditions</div>
          <div class="v">${escapeHtml(specialHtml)}</div>
        </div>
        <div class="kv" style="grid-column: 1 / -1">
          <div class="k">Customer Notes</div>
          <div class="v">${escapeHtml(notes || '-')}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Pricing</div>
      <table>
        <thead>
          <tr><th>Description</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
          <tr>
            <td class="total">Total</td>
            <td class="num total">$${pricingTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups to export the invoice.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 50);
  }

  cycleRowFlag(bookingId: string | null | undefined): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    this.openFlagMenuBookingId = this.openFlagMenuBookingId === id ? null : id;
  }

  closeFlagMenu(): void {
    this.openFlagMenuBookingId = null;
  }

  setRowFlag(
    bookingId: string | null | undefined,
    flag: 'none' | 'call_client' | 'pending_invoice' | 'payment_issue' | 'archived'
  ): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    this.rowFlagsByBookingId = { ...this.rowFlagsByBookingId, [id]: flag };
    this.persistFlags();
    this.openFlagMenuBookingId = null;
  }

  getRowFlag(bookingId: string | null | undefined): 'none' | 'call_client' | 'pending_invoice' | 'payment_issue' | 'archived' {
    const id = String(bookingId ?? '').trim();
    if (!id) return 'none';
    return this.rowFlagsByBookingId[id] ?? 'none';
  }

  getRowFlagLabel(bookingId: string | null | undefined): string {
    const flag = this.getRowFlag(bookingId);
    if (flag === 'call_client') return 'Call client';
    if (flag === 'pending_invoice') return 'Pending invoice';
    if (flag === 'payment_issue') return 'Payment issue';
    if (flag === 'archived') return 'Completed / archived';
    return '';
  }

  private restoreFlags(): void {
    try {
      const raw = localStorage.getItem(this.flagsStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      const next: Record<string, 'none' | 'call_client' | 'pending_invoice' | 'payment_issue' | 'archived'> = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        if (v === 'call_client' || v === 'pending_invoice' || v === 'payment_issue' || v === 'archived' || v === 'none')
          next[String(k)] = v;
      }
      this.rowFlagsByBookingId = next;
    } catch {
      this.rowFlagsByBookingId = {};
    }
  }

  private persistFlags(): void {
    try {
      localStorage.setItem(this.flagsStorageKey, JSON.stringify(this.rowFlagsByBookingId));
    } catch {
      return;
    }
  }

  getFinalPrice(booking: Booking): string {
    const anyBooking = booking as any;
    const price =
      anyBooking?.pricing?.finalPrice ??
      anyBooking?.finalPrice ??
      anyBooking?.finalPricePreview ??
      anyBooking?.data?.finalPricePreview ??
      anyBooking?.pricing?.estimatedPrice ??
      anyBooking?.estimatedPrice ??
      null;
    const num = typeof price === 'number' && Number.isFinite(price) ? price : null;
    return num === null ? '-' : `$${num.toFixed(2)}`;
  }

  getServiceDisplay(booking: Booking | null | undefined): string {
    const label = String(booking?.display?.service?.label ?? '').trim();
    if (label) return label;
    return String(booking?.cleaningType ?? '').trim() || '-';
  }

  getSupervisorDisplay(booking: Booking | null | undefined): string {
    if (!booking) return '-';
    const anyBooking = booking as any;
    const supName =
      typeof anyBooking?.assignedSupervisor?.name === 'string'
        ? String(anyBooking.assignedSupervisor.name).trim()
        : '';
    if (supName) return supName;
    const supId =
      typeof anyBooking?.assignedSupervisor?.employeeId === 'string'
        ? String(anyBooking.assignedSupervisor.employeeId).trim()
        : String(anyBooking?.supervisorId ?? anyBooking?.assignedSupervisorId ?? '').trim();
    return supId || '-';
  }

  getEmployeesDisplay(booking: Booking | null | undefined): string {
    if (!booking) return '-';
    const anyBooking = booking as any;
    const assignedEmployees = Array.isArray(anyBooking?.assignedEmployees) ? anyBooking.assignedEmployees : [];
    const names = assignedEmployees
      .map((x: any) => (typeof x?.name === 'string' ? String(x.name).trim() : ''))
      .filter(Boolean);
    if (names.length) return names.join(', ');

    const ids = assignedEmployees
      .map((x: any) => (typeof x?.employeeId === 'string' ? String(x.employeeId).trim() : ''))
      .filter(Boolean);
    if (ids.length) return ids.join(', ');

    const raw =
      anyBooking?.employeeIds ??
      anyBooking?.assignedEmployeeIds ??
      anyBooking?.employeeEmails ??
      [];
    const list = Array.isArray(raw)
      ? raw.map((x: any) => String(x ?? '').trim()).filter(Boolean)
      : String(raw ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
    return list.length ? list.join(', ') : '-';
  }

  getExtrasItems(booking: Booking | null | undefined): string[] {
    const items = booking?.display?.extras?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((x) => {
        const label = String(x?.label ?? '').trim();
        const qty = typeof x?.quantity === 'number' && Number.isFinite(x.quantity) && x.quantity > 1 ? ` × ${x.quantity}` : '';
        return label ? `${label}${qty}` : '';
      })
      .filter(Boolean);
  }

  getSpecialConditions(booking: Booking | null | undefined): string[] {
    const list = booking?.display?.specialConditions;
    if (!Array.isArray(list)) return [];
    return list.map((x) => String(x ?? '').trim()).filter(Boolean);
  }

  getPricingItems(booking: Booking | null | undefined): Array<{ label: string; amount: number }> {
    const items = booking?.display?.pricing?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((x) => ({
        label: String(x?.label ?? '').trim(),
        amount: typeof x?.amount === 'number' && Number.isFinite(x.amount) ? x.amount : NaN
      }))
      .filter((x) => x.label && Number.isFinite(x.amount));
  }

  getPricingTotal(booking: Booking | null | undefined): number {
    const total = booking?.display?.pricing?.total;
    if (typeof total === 'number' && Number.isFinite(total)) return total;
    const anyBooking = booking as any;
    const price =
      anyBooking?.pricing?.finalPrice ??
      anyBooking?.finalPrice ??
      anyBooking?.finalPricePreview ??
      anyBooking?.data?.finalPricePreview ??
      anyBooking?.pricing?.estimatedPrice ??
      anyBooking?.estimatedPrice ??
      0;
    return typeof price === 'number' && Number.isFinite(price) ? price : 0;
  }

  getNotes(booking: Booking | null | undefined): string {
    const notes = String(booking?.display?.notes ?? (booking as any)?.notes ?? '').trim();
    return notes;
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

  private formatTimestamp(value: unknown): string {
    if (!value) return '';
    const raw = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(raw.getTime())) return '';
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    const hh = String(raw.getHours()).padStart(2, '0');
    const mm = String(raw.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
}
