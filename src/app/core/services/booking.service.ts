import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BookingService as BookingApiService } from '../api/services/booking.service';
import { DiscountsService as DiscountsApiService } from '../api/services/discounts.service';

import { AssignBookingDto } from '../api/models/assign-booking-dto';
import { CreateBookingDto } from '../api/models/create-booking-dto';
import { UpdateBookingStatusDto } from '../api/models/update-booking-status-dto';
import { CheckDiscountDto } from '../api/models/check-discount-dto';

import {
  AdminBookingMutationResponse,
  AdminCancelBookingInput,
  AdminConfirmAndSendPaymentResponse,
  AdminDeletePermanentReAuth,
  AdminDeletePermanentResponse,
  AdminQuoteDraftInput,
  AdminRejectQuoteInput,
  Booking,
  BookingPricingSummary,
  BookingRequest,
  BookingResponse,
  DiscountCheckResponse
} from '../models/booking-request.model';

/**
 * @class BookingService
 * @description Servicio de fachada (facade) que conecta el frontend con la API de reservas del backend.
 * Abstrae las llamadas generadas por OpenAPI y proporciona métodos tipados y seguros para la gestión de reservas,
 * descuentos y previsualización de precios.
 */
@Injectable({
  providedIn: 'root'
})
export class BookingService {

  constructor(
    private bookingApi: BookingApiService,
    private discountsApi: DiscountsApiService,
    private http: HttpClient,
  ) {}

  // -----------------------------
  // 🔧 HELPERS (frontend safety only)
  // -----------------------------

  /**
   * Normaliza una cadena eliminando espacios en blanco y manejando valores nulos.
   * @param value Valor a normalizar.
   * @returns Cadena normalizada.
   */
  private normalizeString(value: any): string {
    return String(value ?? '').trim();
  }

  /**
   * Normaliza una dirección de correo electrónico a minúsculas y sin espacios.
   * @param email Email a normalizar.
   * @returns Email normalizado o undefined si está vacío.
   */
  private normalizeEmail(email?: string): string | undefined {
    const e = this.normalizeString(email).toLowerCase();
    return e || undefined;
  }

  /**
   * Limpia un array de cadenas eliminando duplicados y valores vacíos.
   * @param arr Array original.
   * @returns Array limpio y normalizado.
   */
  private cleanArray(arr: any[]): string[] {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(v => this.normalizeString(v)).filter(Boolean))];
  }

  // -----------------------------
  // 🟢 BOOKINGS
  // -----------------------------

  /**
   * Realiza una solicitud de reserva de servicio.
   * @param request Datos de la reserva.
   * @returns Observable con la respuesta de la creación de la reserva.
   */
  bookService(request: BookingRequest): Observable<BookingResponse> {
    const payload = {
      ...request,
    } as unknown as CreateBookingDto;

    return this.bookingApi
      .bookingControllerCreateBooking({ body: payload })
      .pipe(map(res => res as unknown as BookingResponse));
  }

  /**
   * Envía una solicitud pública de cotización reutilizando el contrato actual
   * del formulario, pero apuntando al nuevo endpoint del quote-flow.
   *
   * Nota:
   * - El cliente OpenAPI aún no fue regenerado con este endpoint.
   * - Usamos HttpClient directo para mantener compatibilidad sin tocar el resto
   *   del facade ni el panel admin.
   */
  requestQuote(request: BookingRequest): Observable<BookingResponse> {
    const payload = {
      ...request,
    } as unknown as CreateBookingDto;

    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .post<BookingResponse>(`${rootUrl}/booking/quote-request`, payload)
      .pipe(map(res => res as unknown as BookingResponse));
  }

  /**
   * Obtiene la lista de reservas, opcionalmente filtrada por estado.
   * @param status Estado opcional para filtrar.
   * @returns Observable con la lista de reservas.
   */
  getBookings(status?: string): Observable<Booking[]> {
    const normalizedStatus = this.normalizeString(status) || undefined;

    return this.bookingApi
      .bookingControllerGetBookings({ status: normalizedStatus as any })
      .pipe(map(res => res as unknown as Booking[]));
  }

  /**
   * Obtiene una reserva por su ID único.
   * @param id ID de la reserva.
   * @returns Observable con los datos de la reserva.
   */
  getBookingById(id: string): Observable<Booking> {
    return this.bookingApi
      .bookingControllerGetById({ id: this.normalizeString(id) })
      .pipe(map(res => res as unknown as Booking));
  }

  startQuoteReview(id: string): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/review/start`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  saveQuoteDraft(
    id: string,
    input: AdminQuoteDraftInput
  ): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/draft`,
        input ?? {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  sendQuote(id: string): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/send`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  rejectQuote(
    id: string,
    input?: AdminRejectQuoteInput
  ): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/reject`,
        input ?? {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  expireQuote(id: string): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/expire`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  reopenQuote(id: string): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/reopen`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  reviseQuote(id: string): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(id)}/quote/revise`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  /**
   * Admin-only: Aplica el 15% de first-service discount a una reserva.
   * El backend valida idempotencia, dirección usada, elegibilidad y recalcula precios
   * pricing automáticamente (no trusteando front).
   */
  applyFirstServiceDiscount(bookingId: string): Observable<AdminBookingMutationResponse & { booking?: Booking; pricing?: BookingPricingSummary }> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(bookingId)}/apply-first-service-discount`,
        {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse & { booking?: Booking; pricing?: BookingPricingSummary }));
  }

  /**
   * Admin-only: Confirma la reserva, genera el link de pago Stripe por el
   * precio final aprobado por admin (con descuento/ajustes aplicados),
   * actualiza los estados a confirmed/payment_pending y envía el email
   * al cliente con el link de pago.
   *
   * Idempotente: si ya existe paymentUrl devuelve wasAlreadyIssued=true
   * sin crear nuevos Stripe sessions ni emails duplicados.
   */
  confirmAndSendPayment(bookingId: string): Observable<AdminConfirmAndSendPaymentResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminConfirmAndSendPaymentResponse>(
        `${rootUrl}/booking/${this.normalizeString(bookingId)}/confirm-and-send-payment`,
        {}
      )
      .pipe(map(res => res as unknown as AdminConfirmAndSendPaymentResponse));
  }

  /**
   * Admin-only: Cancelación soft de la reserva (record persistido para auditoría).
   * Actualiza status=cancelled, commercialStatus=quote_rejected, paymentLifecycle=voided
   * y envía email de cancelación al cliente (una sola vez en el primer cancel).
   */
  cancelBookingByAdmin(
    bookingId: string,
    input?: AdminCancelBookingInput
  ): Observable<AdminBookingMutationResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .patch<AdminBookingMutationResponse>(
        `${rootUrl}/booking/${this.normalizeString(bookingId)}/cancel`,
        input ?? {}
      )
      .pipe(map(res => res as unknown as AdminBookingMutationResponse));
  }

  /**
   * Admin-only: Eliminación PERMANENTE y destructiva del booking en MongoDB.
   *
   * 🔒 SECURITY (backend authoritative):
   * - Requiere JWT de administrador (RolesGuard: ADMIN).
   * - Además requiere re-autenticación EXPLÍCITA con credenciales (email + password)
   *   que son validadas backend-side via bcrypt contra la colección users.
   * - Tanto el JWT user COMO el re-authed user deben ser role ADMIN.
   * - El delete NUNCA se ejecuta si las credenciales fallan.
   * - Frontend NUNCA es la autoridad; siempre es backend.
   *
   * Elimina también los Payment docs asociados al bookingId.
   */
  deleteBookingPermanent(
    bookingId: string,
    reAuth: AdminDeletePermanentReAuth
  ): Observable<AdminDeletePermanentResponse> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http
      .request<AdminDeletePermanentResponse>(
        'DELETE',
        `${rootUrl}/booking/${this.normalizeString(bookingId)}`,
        { body: { reAuth: reAuth ?? {} } }
      )
      .pipe(map(res => res as unknown as AdminDeletePermanentResponse));
  }

  /**
   * Actualiza el estado administrativo de una reserva.
   * @param id ID de la reserva.
   * @param status Nuevo estado (confirmada o cancelada).
   * @returns Observable con la reserva actualizada.
   */
  updateStatus(
    id: string,
    status: 'confirmed' | 'cancelled'
  ): Observable<Booking> {

    const body: UpdateBookingStatusDto = { status };

    return this.bookingApi
      .bookingControllerUpdateBookingStatus({
        id: this.normalizeString(id),
        body
      })
      .pipe(map(res => res.data as unknown as Booking));
  }

  /**
   * Asigna empleados y un supervisor a una reserva.
   * @param bookingId ID de la reserva.
   * @param supervisorId ID del supervisor.
   * @param employeeIds Array de IDs de los empleados asignados.
   * @returns Observable con la reserva actualizada.
   */
  assignBooking(
    bookingId: string,
    supervisorId: string,
    employeeIds: string[]
  ): Observable<Booking> {

    const body: AssignBookingDto = {
      supervisorId: this.normalizeString(supervisorId),
      employeeIds: this.cleanArray(employeeIds)
    };

    return this.bookingApi
      .bookingControllerAssignBooking({
        id: this.normalizeString(bookingId),
        body
      })
      .pipe(map(res => res.data as unknown as Booking));
  }

  /**
   * Marca una reserva como iniciada.
   * @param id ID de la reserva.
   * @returns Observable con la reserva actualizada.
   */
  startBooking(id: string): Observable<Booking> {
    return this.bookingApi
      .bookingControllerStartBooking({
        id: this.normalizeString(id)
      })
      .pipe(map(res => res.data as unknown as Booking));
  }

  /**
   * Marca una reserva como completada.
   * @param id ID de la reserva.
   * @returns Observable con la reserva actualizada.
   */
  completeBooking(id: string): Observable<Booking> {
    return this.bookingApi
      .bookingControllerCompleteBooking({
        id: this.normalizeString(id)
      })
      .pipe(map(res => res.data as unknown as Booking));
  }

  /**
   * Obtiene las reservas asignadas al empleado actualmente autenticado.
   * @returns Observable con la lista de reservas asignadas.
   */
  getAssignedBookings(): Observable<Booking[]> {
    return this.bookingApi
      .bookingControllerGetAssignedBookings()
      .pipe(map(res => res as unknown as Booking[]));
  }

  // -----------------------------
  // 💸 DISCOUNTS
  // -----------------------------

  /**
   * Verifica la elegibilidad de un descuento basado en email o dirección.
   * @param params Objeto con email y/o dirección.
   * @returns Observable con la respuesta de elegibilidad.
   */
  checkDiscount(params: {
    email?: string;
    address?: string;
  }): Observable<DiscountCheckResponse> {

    const body: CheckDiscountDto = {
      email: this.normalizeEmail(params?.email),
      address: this.normalizeString(params?.address)
    };

    // limpiar undefined fields
    Object.keys(body).forEach(key => {
      if (!(body as any)[key]) delete (body as any)[key];
    });

    return this.discountsApi
      .discountsControllerCheckDiscount({ body })
      .pipe(map(res => res as unknown as DiscountCheckResponse));
  }

  // -----------------------------
  // 📊 PRICE PREVIEW
  // -----------------------------

  /**
   * Requests a detailed price preview from the backend.
   *
   * Implementation: direct HttpClient POST (same pattern as requestQuote / expireQuote).
   * Bypasses the OpenAPI-generated bookingApi because the regenerated
   * `PricePreviewDto` interface is empty in the generated code.
   */
  pricePreview(payload: any): Observable<any> {
    const cleanPayload: any = {};
    for (const k of Object.keys(payload || {})) {
      const v = (payload as any)[k];
      if (v === undefined) continue;
      cleanPayload[k] = v;
    }
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http.post(`${rootUrl}/booking/price-preview`, cleanPayload);
  }

  // -----------------------------
  // 📝 CUSTOM QUOTE (FASE 4D) — Aislado del booking normal
  // -----------------------------

  /**
   * Envía una solicitud de Custom Quote (aislada, no guarda en MongoDB).
   *
   * @param formData FormData multipart con los campos del formulario + archivos 'photos'.
   * @returns Observable con la respuesta del servidor (success + sentTo + messageId).
   */
  submitCustomQuote(formData: FormData): Observable<any> {
    const rootUrl = this.bookingApi.rootUrl || '';
    return this.http.post<any>(`${rootUrl}/booking/custom-quote-email`, formData);
  }
}
