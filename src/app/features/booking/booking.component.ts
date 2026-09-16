import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, TimeoutError, merge, of, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, timeout } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingService } from '../../core/services/booking.service';
import { ServiceDataService } from '../../core/services/service-data.service';
import { CleaningService } from '../../core/models/service.model';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { AuthService } from '../../core/services/auth.service';
import { sanitizeAddress, sanitizeEmail, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';
import { generateTimeSlots, getRollingBookingWindow, startOfLocalDay, addDays, toIsoDateLocal } from '../../shared/utils/booking-datetime';

import { GeolocationService } from '../../core/services/geolocation.service';

import {
  REGULAR_CLEANING_PACKAGES_V2,
  RegularCleaningPackageV2,
  SPECIAL_SERVICES_V2,
  SPECIAL_SERVICES_ARRAY_V2,
  SpecialServiceV2,
  SpecialServiceIdV2,
  OPTIONAL_EXTRAS_ARRAY_V2,
  OPTIONAL_EXTRAS_V2,
  OptionalExtraV2,
  OptionalExtraIdV2,
  isExtraDisabledV2,
  EXTRA_BEDROOM_PRICE_V2,
  BORDERLINE_FEE_AMOUNT_V2,
  getDisplayExtraLabelV2,
  getDisplaySpecialServiceLabelV2,
  getDisplayRegularPackageLabelV2,
  PricingModelVersion,
  SERVICE_NOTES_LABELS_V2,
  CUSTOM_QUOTE_ROUTE_PATH,
  CUSTOM_QUOTE_MENU_LABEL,
} from '../../core/catalogs/pricing-catalogs-v2';

type PaymentUiState = 'NONE' | 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED';

type PackageOptionUi = { id: string; bedrooms: number; bathrooms: number };

type ExtraCatalogItemUi = {
  id:
    | 'fridge'
    | 'oven'
    | 'cabinets'
    | 'windows_exterior'
    | 'heavy_buildup'
    | 'same_day'
    | 'garage'
    | 'laundry'
    | 'organize_clothes';
  label: string;
  quantityControl?: 'windowsQuantity' | 'laundryLoads';
  maxQuantity?: number;
};

const STANDARD_PACKAGES: PackageOptionUi[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1 },
  { id: '2-1', bedrooms: 2, bathrooms: 1 },
  { id: '2-2', bedrooms: 2, bathrooms: 2 },
  { id: '3-2', bedrooms: 3, bathrooms: 2 },
  { id: '4-2', bedrooms: 4, bathrooms: 2 },
  { id: '4-3', bedrooms: 4, bathrooms: 3 }
];

const APARTMENT_PACKAGES: PackageOptionUi[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1 },
  { id: '2-1', bedrooms: 2, bathrooms: 1 },
  { id: '2-2', bedrooms: 2, bathrooms: 2 },
  { id: '3-2', bedrooms: 3, bathrooms: 2 },
  { id: '4-2', bedrooms: 4, bathrooms: 2 }
];

const DEEP_PACKAGES: PackageOptionUi[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1 },
  { id: '2-2', bedrooms: 2, bathrooms: 2 },
  { id: '3-2', bedrooms: 3, bathrooms: 2 },
  { id: '4-3', bedrooms: 4, bathrooms: 3 }
];

const MOVE_OUT_PACKAGES: PackageOptionUi[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1 },
  { id: '2-2', bedrooms: 2, bathrooms: 2 },
  { id: '3-2', bedrooms: 3, bathrooms: 2 },
  { id: '4-3', bedrooms: 4, bathrooms: 3 }
];

const MOVE_IN_PACKAGES: PackageOptionUi[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1 },
  { id: '2-1', bedrooms: 2, bathrooms: 1 },
  { id: '2-2', bedrooms: 2, bathrooms: 2 },
  { id: '3-2', bedrooms: 3, bathrooms: 2 },
  { id: '4-2', bedrooms: 4, bathrooms: 2 },
  { id: '4-3', bedrooms: 4, bathrooms: 3 }
];

const EXTRAS_CATALOG: ExtraCatalogItemUi[] = [
  { id: 'fridge', label: 'Inside Fridge' },
  { id: 'oven', label: 'Inside Oven' },
  { id: 'cabinets', label: 'Inside Cabinets/Drawers' },
  { id: 'windows_exterior', label: 'Outside Windows', quantityControl: 'windowsQuantity' },
  { id: 'heavy_buildup', label: 'Heavy Buildup' },
  { id: 'same_day', label: 'Same Day' },
  { id: 'garage', label: 'Garage' },
  { id: 'laundry', label: 'Laundry', quantityControl: 'laundryLoads', maxQuantity: 2 },
  { id: 'organize_clothes', label: 'Organize Clothes' }
];

/**
 * @component BookingComponent
 * @description Componente principal para el flujo de reserva de servicios de limpieza.
 * Maneja la selección de servicios, configuración de paquetes, cálculo de precios en tiempo real,
 * verificación de cobertura geográfica y procesamiento de pagos.
 */
@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit, OnDestroy {
  private readonly publicQuoteSuccessMessage =
    'Quote request submitted successfully. Our team will review it and contact you soon.';
  /** Formulario principal de la reserva */
  bookingForm!: FormGroup;
  
  /** Estado de envío del formulario */
  isSubmitting = false;
  
  /** Indica si la reserva se guardó correctamente */
  submitSuccess = false;
  
  /** Mensaje informativo tras el envío */
  submitMessage = '';
  
  /** Estado actual de la reserva recién creada */
  submittedBookingStatus: 'pending' | 'confirmed' | 'paid' | 'cancelled' | null = null;
  
  /** ID de la reserva recién creada */
  submittedBookingId: string | null = null;
  
  /** Indica si el sistema está esperando confirmación de pago */
  isWaitingForConfirmation = false;
  
  /** Indica si se está refrescando el estado de la reserva mediante polling */
  isRefreshingBookingStatus = false;
  
  /** Modo de reserva manual para administradores */
  isAdminManualBooking = false;
  
  /** Contexto de retorno tras pago exitoso en Stripe */
  isPaymentReturnContext = false;
  
  /** Contexto de retorno tras cancelación de pago en Stripe */
  isPaymentCancelContext = false;
  
  /** Pista visual sobre el estado del pago */
  paymentStatusHint = '';
  
  /** Estado de la interfaz de usuario relativo al pago */
  paymentUiState: PaymentUiState = 'NONE';
  
  /** Datos sincronizados de la reserva desde el backend */
  syncedBooking: any = null;
  
  /** Control de visibilidad del modal de confirmación */
  isConfirmModalOpen = false;

  /** Modal ⓘ Special Service Info (sección 3 spec) */
  isServiceInfoModalOpen = false;
  serviceInfoModalId: SpecialServiceIdV2 | null = null;

  /** Modal ⓘ Extra Info (Step 6) */
  isExtraInfoModalOpen = false;
  extraInfoModalId: OptionalExtraIdV2 | null = null;

  /** Exponer labels Service Notes V2 (seteados por el catálogo central) */
  readonly v2ServiceNotesLabels = SERVICE_NOTES_LABELS_V2;
  readonly v2CustomQuoteRoutePath = CUSTOM_QUOTE_ROUTE_PATH;
  readonly v2CustomQuoteMenuLabel = CUSTOM_QUOTE_MENU_LABEL;
  
  /** Snapshot de datos para mostrar en el modal de confirmación */
  confirmSnapshot: any = null;
  
  /** Servicio de limpieza actualmente seleccionado */
  selectedService: CleaningService | null = null;
  
  /** Precio estimado (sin descuentos ni cargos extra por distancia) */
  estimatedPrice = 0;
  
  /** Precio final calculado por el backend */
  finalPrice = 0;
  
  /** Desglose detallado de los ítems que componen el precio */
  pricingItems: Array<{ label: string; amount: number }> = [];
  
  /** Porcentaje de descuento aplicado */
  discountPercent = 0;
  
  /** Monto total descontado */
  discountAmount = 0;
  
  /** Cargo adicional por distancia fuera del área base */
  distanceFee = 0;

  /** Cargo V2 ($25 exacto) por Borderline 1 km alrededor del límite exterior de cualquier zona */
  borderlineFeeV2 = 0;

  /** Lista de servicios disponibles cargados desde la configuración */
  availableServices: CleaningService[] = [];
  
  // Geolocation properties
  /** Indica si se está verificando la cobertura geográfica en curso */
  isCheckingCoverage = false;
  
  /** Estado de cobertura detectado por el backend */
  coverageStatus: 'inside' | 'borderline' | 'outside' = 'outside';
  
  /** Indica si la dirección del usuario requiere un cargo extra por distancia */
  isExtraCharge = false;
  
  /** Distancia calculada en KM hasta la zona de cobertura */
  assignedDistance = 0;
  
  /** Mensaje descriptivo sobre la cobertura */
  coverageMessage = '';
  
  /** Ciudad detectada por geocodificación inversa */
  coverageCity = '';
  
  /** Lista de ciudades permitidas */
  coverageCitiesList: string[] = [];
  
  /** Indica si se está verificando la elegibilidad para descuento por primera vez */
  isCheckingDiscount = false;
  
  /** Indica si el descuento ha sido bloqueado (ya usado o dirección inválida) */
  isDiscountBlocked = false;
  
  /** Mensaje informativo sobre el chequeo de descuento */
  discountCheckMessage = '';

  private destroy$ = new Subject<void>();
  private serviceChange$ = new Subject<void>();
  private discountCheckRequestId = 0;
  private lastCheckedDiscountEmail = '';
  private currentLocationRequestId = 0;
  private currentPricePreviewRequestId = 0;
  private selectedCoords: { lat: number; lng: number } | null = null;
  private pricePreviewResult: any | null = null;
  private lastStatusRefreshBookingId: string | null = null;
  private readonly bookingIdStorageKey = 'zcleanup_last_booking_id';
  private readonly paymentPollStop$ = new Subject<void>();
  private readonly bookingSubmitTimeoutMs = 7000;
  private readonly minAddressLengthForPreview = 10;
  private readonly pricePreviewRetryCooldownMs = 60 * 1000;
  private pricePreviewCooldownUntil = 0;
  private isPricePreviewUnavailable = false;
  hasVerifiedCoverage = false;
  isPricePreviewDirty = true;

  private readonly HAVERSINE_EARTH_RADIUS_KM = 6371;

  static readonly V2_BORDERLINE_OUTSIDE_THRESHOLD_KM = 1;

  emailControl!: FormControl;
  discountControl!: FormControl;
  desiredTimeControl!: FormControl;
  petsAtHomeControl!: FormControl;
  useOwnProductsControl!: FormControl;
  petSafetyNotesControl!: FormControl;
  cleaningProductNotesControl!: FormControl;

  standardPackages = STANDARD_PACKAGES;
  apartmentPackages = APARTMENT_PACKAGES;
  deepPackages = DEEP_PACKAGES;
  moveOutPackages = MOVE_OUT_PACKAGES;
  moveInPackages = MOVE_IN_PACKAGES;
  extrasCatalog: ExtraCatalogItemUi[] = EXTRAS_CATALOG;
  readonly allowedTimes = generateTimeSlots('08:00', '17:00', 30);
  private readonly bookingWindow = getRollingBookingWindow(30);
  minBookingDate = this.bookingWindow.min;
  maxBookingDate = this.bookingWindow.max;

  readonly useV2Model = true;
  readonly EXTRA_BEDROOM_PRICE_V2 = EXTRA_BEDROOM_PRICE_V2;
  readonly BORDERLINE_FEE_AMOUNT_V2 = BORDERLINE_FEE_AMOUNT_V2;
  readonly regularPackagesV2: RegularCleaningPackageV2[] = REGULAR_CLEANING_PACKAGES_V2;
  readonly specialServicesV2: SpecialServiceV2[] = SPECIAL_SERVICES_ARRAY_V2;
  readonly optionalExtrasV2: OptionalExtraV2[] = OPTIONAL_EXTRAS_ARRAY_V2;
  readonly v2ExtraBedroomPrice = EXTRA_BEDROOM_PRICE_V2;

  /** Imágenes portada por special service card (background-image URLs).
   *  Assets reales presentes en src/assets/images/special/.
   *  Ruta absoluta /assets/ para robustez en GitHub Pages custom domain.
   */
  readonly v2SpecialCardImages: Record<SpecialServiceIdV2, string> = {
    deep_home_cleaning: "/assets/images/special/deepcleaning.jpg",
    move_in_out: "/assets/images/special/moveinmoveout.jpg",
    post_construction: "/assets/images/special/postcontruction.jpg",
    extreme_home_cleaning: "/assets/images/special/extremehomecleaning.jpg",
  };

  /** Imágenes placeholder Regular Cleaning */
  readonly v2RegularHeroImg =
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fresh%20clean%20tidy%20modern%20living%20room%20bedroom%20regular%20professional%20housekeeping%20service&image_size=landscape_16_9";

  private v2SelectedExtrasSet: Set<OptionalExtraIdV2> = new Set();
  private v2ExtrasQty: Partial<Record<OptionalExtraIdV2, number>> = {};

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private serviceData: ServiceDataService,
    private geolocationService: GeolocationService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: SafeLoggerService
  ) {}

  get isPublicQuoteRequestMode(): boolean {
    return !this.isAdminManualBooking;
  }

  get hasPricePreviewData(): boolean {
    return this.pricePreviewResult !== null;
  }

  get canRequestCoverageEstimate(): boolean {
    const addressValue = String(this.bookingForm?.get('address')?.value ?? '').trim();
    return (
      !!this.selectedService &&
      addressValue.length >= this.minAddressLengthForPreview &&
      !this.isCheckingCoverage &&
      !this.isSubmitting &&
      !this.isPricePreviewUnavailable
    );
  }

  ngOnInit(): void {
    const bookingWindow = getRollingBookingWindow(30);
    this.minBookingDate = bookingWindow.min;
    this.maxBookingDate = bookingWindow.max;
    this.isAdminManualBooking = this.getAncestorRouteDataFlag('isAdminManualBooking');
    const std = this.serviceData.getServiceBySlug('standard-cleaning') || null;
    this.availableServices = this.serviceData.getEnabledServices();
    this.coverageCitiesList = this.geolocationService.getCoverageCities();
    this.initForm();
    this.selectedService = std;
    if (std) {
      this.bookingForm.patchValue({ cleaningType: std.slug }, { emitEvent: false });
      this.setupV2RegularCleaningFields();
      this.subscribeDynamicFieldsPricing();
      this.markPricePreviewDirty();
    }
    
    this.bookingForm.get('address')?.valueChanges
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((address) => {
          const value = String(address ?? '').trim();

          if (!value || value.length < 10) {
            this.resetCoverageState();
          } else {
            this.selectedCoords = null;
            this.hasVerifiedCoverage = false;
            this.coverageStatus = 'outside';
            this.coverageCity = '';
            this.assignedDistance = 0;
            this.isExtraCharge = false;
            this.markPricePreviewFlagsDirtyOnly();

            if (this.isPricePreviewUnavailable) {
              this.isCheckingCoverage = false;
              this.coverageMessage =
                'Address verification is temporarily unavailable. Reload the page after geolocation service is restored.';
              this.syncFormControlDisabledStates();
            } else {
              this.coverageMessage = 'Looking up your address...';
              this.syncFormControlDisabledStates();
            }
          }

          if (value.length < 5) {
            return of(null);
          }

          return this.geolocationService.geocodeAddress(value).pipe(
            catchError(() => of(null))
          );
        })
      )
      .subscribe((locationResult) => {
        if (locationResult) {
          this.selectedCoords = {
            lat: locationResult.lat,
            lng: locationResult.lng
          };
          const evaluation = this.evaluateCoverageFromCoords(
            locationResult.lat,
            locationResult.lng
          );
          this.coverageStatus = evaluation.status;
          this.coverageCity = evaluation.assignedCity ?? '';
          this.assignedDistance = evaluation.distanceKm ?? 0;
          this.isExtraCharge = evaluation.isBorderline;
          this.hasVerifiedCoverage = true;
          this.coverageMessage = this.buildCoverageMessage(evaluation);
        } else {
          const currentAddressValue = String(
            this.bookingForm.get('address')?.value ?? ''
          ).trim();
          this.selectedCoords = null;
          this.hasVerifiedCoverage = false;
          this.coverageStatus = 'outside';
          this.coverageCity = '';
          this.assignedDistance = 0;
          this.isExtraCharge = false;

          if (currentAddressValue.length < 5) {
            this.coverageMessage = '';
          } else {
            this.coverageMessage =
              'Address not found. Please check spelling, ZIP code, and try again.';
          }
        }
        this.syncFormControlDisabledStates();
      });

    // Listen for service changes to update dynamic fields
    this.bookingForm.get('cleaningType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(slug => {
        this.onServiceChange(slug);
      });

    this.bookingForm.get('desiredDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((raw) => {
        const value = String(raw ?? '').trim();
        if (!value) return;
        const today = startOfLocalDay(new Date());
        const selected = this.parseIsoDate(value);
        if (!selected) return;
        if (selected.getTime() < today.getTime()) {
          this.bookingForm.get('desiredDate')?.setValue(this.minBookingDate, { emitEvent: false });
        } else {
          const max = this.parseIsoDate(this.maxBookingDate);
          if (max && selected.getTime() > max.getTime()) {
            this.bookingForm.get('desiredDate')?.setValue(this.maxBookingDate, { emitEvent: false });
          }
        }

        const desiredTimeValue = String(this.bookingForm.get('desiredTime')?.value ?? '').trim();
        if (desiredTimeValue && !this.allowedTimes.includes(desiredTimeValue)) {
          this.bookingForm.get('desiredTime')?.setValue('', { emitEvent: false });
        }
      });

    this.subscribeSharedPricingControls();

    this.checkQueryParams();
    this.syncFormControlDisabledStates();
  }

  private resetCoverageState(): void {
    this.isCheckingCoverage = false;
    this.coverageStatus = 'outside';
    this.hasVerifiedCoverage = false;
    this.isPricePreviewDirty = true;
    this.isExtraCharge = false;
    this.assignedDistance = 0;
    this.coverageCity = '';
    this.coverageMessage = '';
    this.selectedCoords = null;
    this.pricePreviewResult = null;
    this.resetPricePreviewState();
    this.syncFormControlDisabledStates();
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.HAVERSINE_EARTH_RADIUS_KM * c;
  }

  private evaluateCoverageFromCoords(
    lat: number,
    lng: number
  ): {
    status: 'inside' | 'borderline' | 'outside';
    assignedCity: string | null;
    distanceKm: number | null;
    isBorderline: boolean;
    nearestCity: string | null;
    nearestDistanceKm: number | null;
  } {
    const cities = this.geolocationService.getCoverageCitiesDetails();
    if (!cities || cities.length === 0) {
      return {
        status: 'outside',
        assignedCity: null,
        distanceKm: null,
        isBorderline: false,
        nearestCity: null,
        nearestDistanceKm: null
      };
    }

    const thresholdKm = BookingComponent.V2_BORDERLINE_OUTSIDE_THRESHOLD_KM;

    const distances = cities.map((city) => {
      return {
        city,
        distanceKm: this.haversineKm(lat, lng, city.lat, city.lng),
        radiusKm: city.radiusKm
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    const nearest = distances[0];

    const insideMatches = distances.filter((d) => d.distanceKm <= d.radiusKm);
    if (insideMatches.length > 0) {
      const chosen = insideMatches.reduce((acc, curr) =>
        curr.distanceKm < acc.distanceKm ? curr : acc
      );
      return {
        status: 'inside',
        assignedCity: chosen.city.name,
        distanceKm: Number(chosen.distanceKm.toFixed(2)),
        isBorderline: false,
        nearestCity: nearest.city.name,
        nearestDistanceKm: Number(nearest.distanceKm.toFixed(2))
      };
    }

    const borderlineMatches = distances.filter(
      (d) =>
        d.distanceKm > d.radiusKm &&
        d.distanceKm <= d.radiusKm + thresholdKm
    );
    if (borderlineMatches.length > 0) {
      const chosen = borderlineMatches.reduce((acc, curr) =>
        curr.distanceKm < acc.distanceKm ? curr : acc
      );
      return {
        status: 'borderline',
        assignedCity: chosen.city.name,
        distanceKm: Number(chosen.distanceKm.toFixed(2)),
        isBorderline: true,
        nearestCity: nearest.city.name,
        nearestDistanceKm: Number(nearest.distanceKm.toFixed(2))
      };
    }

    return {
      status: 'outside',
      assignedCity: null,
      distanceKm: null,
      isBorderline: false,
      nearestCity: nearest.city.name,
      nearestDistanceKm: Number(nearest.distanceKm.toFixed(2))
    };
  }

  private buildCoverageMessage(
    evaluation: {
      status: 'inside' | 'borderline' | 'outside';
      assignedCity: string | null;
      distanceKm: number | null;
      isBorderline: boolean;
      nearestCity: string | null;
      nearestDistanceKm: number | null;
    }
  ): string {
    switch (evaluation.status) {
      case 'inside':
        return evaluation.assignedCity
          ? `Great news! We serve your area in ${evaluation.assignedCity}.`
          : 'Great news! We serve your area.';
      case 'borderline':
        return evaluation.assignedCity
          ? `Your address is near the edge of our service area in ${evaluation.assignedCity}. Please contact us to confirm availability.`
          : 'Your address is near the edge of our service area. Please contact us to confirm availability.';
      case 'outside':
        if (evaluation.nearestCity && evaluation.nearestDistanceKm != null) {
          return `Sorry, we currently do not serve this area. (Closest: ${evaluation.nearestCity} at ${evaluation.nearestDistanceKm} km)`;
        }
        return 'Sorry, we currently do not serve this area.';
      default:
        return '';
    }
  }

  private markPricePreviewFlagsDirtyOnly(): void {
    this.isPricePreviewDirty = true;
    this.pricePreviewResult = null;
    this.resetPricePreviewState();
  }

  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      const requestId = ++this.currentLocationRequestId;
      const addressBefore = String(this.bookingForm.get('address')?.value ?? '');
      this.isCheckingCoverage = true;
      this.coverageMessage = 'Locating you...';
      this.syncFormControlDisabledStates();
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.selectedCoords = { lat, lng };
          this.isCheckingCoverage = false;
          this.coverageMessage = 'Location captured. Click "Check Coverage & Estimate" to verify service area.';
          this.markPricePreviewDirty(false);

          this.geolocationService.reverseGeocode(lat, lng).subscribe(address => {
            if (requestId !== this.currentLocationRequestId) return;
            const currentAddress = String(this.bookingForm.get('address')?.value ?? '');
            if (currentAddress !== addressBefore) return;
            if (address) {
              this.bookingForm.patchValue({ address: address }, { emitEvent: false });
            }
          });
        },
        (error) => {
          this.isCheckingCoverage = false;
          this.coverageMessage = "Unable to get your location. Please enter your address manually.";
          this.syncFormControlDisabledStates();
        },
        { timeout: 10000 }
      );
    }
  }

  ngOnDestroy(): void {
    this.paymentPollStop$.next();
    this.paymentPollStop$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    this.serviceChange$.next();
    this.serviceChange$.complete();
  }

  initForm(): void {
    this.bookingForm = this.fb.group({
      // Basic Info
      name: ['', [
        Validators.required,
        trimmedMinLength(3),
        Validators.maxLength(60),
        Validators.pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/),
        noHtmlLikeInput(),
        noControlChars()
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(254),
        noHtmlLikeInput(),
        noControlChars()
      ]],
      phone: ['', [
        Validators.maxLength(10),
        Validators.pattern(/^[2-9]\d{2}[2-9]\d{6}$/),
        noControlChars()
      ]],
      address: ['', [
        Validators.required,
        trimmedMinLength(10),
        Validators.maxLength(160),
        noHtmlLikeInput(),
        noControlChars()
      ]],
      cleaningType: ['', [Validators.required]],
      desiredDate: ['', [Validators.required, noPastDatesValidator(() => this.minBookingDate, () => this.maxBookingDate)]],
      desiredTime: ['', [
        Validators.required,
        businessHoursTimeValidator('08:00', '17:00'),
        allowedTimeSlotsValidator(this.allowedTimes)
      ]],
      petsAtHome: [false],
      useOwnProducts: [false],
      petSafetyNotes: ['', [Validators.maxLength(800), noHtmlLikeInput(), noControlChars()]],
      cleaningProductNotes: ['', [Validators.maxLength(800), noHtmlLikeInput(), noControlChars()]],
      applyFirstDiscount: [false],
      
      // Dynamic fields container
      dynamicFields: this.fb.group({}),
      
      // Shared dynamic fields (Frequency and Extras)
      frequency: ['one-time'],
      extras: this.fb.array([])
    });

    this.emailControl = this.bookingForm.get('email') as FormControl;
    this.discountControl = this.bookingForm.get('applyFirstDiscount') as FormControl;
    this.desiredTimeControl = this.bookingForm.get('desiredTime') as FormControl;
    this.petsAtHomeControl = this.bookingForm.get('petsAtHome') as FormControl;
    this.useOwnProductsControl = this.bookingForm.get('useOwnProducts') as FormControl;
    this.petSafetyNotesControl = this.bookingForm.get('petSafetyNotes') as FormControl;
    this.cleaningProductNotesControl = this.bookingForm.get('cleaningProductNotes') as FormControl;
  }

  private formatDate(date: Date): string {
    return toIsoDateLocal(date);
  }

  private startOfDay(date: Date): Date {
    return startOfLocalDay(date);
  }

  private addYears(date: Date, years: number): Date {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return null;
    return startOfLocalDay(d);
  }

  onServiceChange(slug: string): void {
    this.selectedService = this.serviceData.getServiceBySlug(slug) || null;
    this.serviceChange$.next();
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    
    if (this.selectedService?.slug !== 'standard-cleaning') {
      this.bookingForm.patchValue({ cleaningType: 'standard-cleaning' }, { emitEvent: false });
      this.selectedService = this.serviceData.getServiceBySlug('standard-cleaning') || null;
    }
    this.v2SelectedExtrasSet = new Set();
    this.v2ExtrasQty = {};
    this.setupV2RegularCleaningFields();
    this.subscribeDynamicFieldsPricing();
    this.markPricePreviewDirty();
  }

  private setupV2RegularCleaningFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('regularPackageId', new FormControl(null, [Validators.required]));
    dynamicGroup.addControl('additionalBedroomsV2', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('specialServiceId', new FormControl('', []));
    dynamicGroup.addControl('bedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('bathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    for (const extra of this.optionalExtrasV2) {
      if (extra.kind === 'qty') {
        dynamicGroup.addControl(
          'v2_qty_' + extra.id,
          new FormControl(extra.minQuantity ?? 1, [
            Validators.min(extra.minQuantity ?? 1),
            Validators.max(extra.maxQuantity ?? 9999),
          ])
        );
      }
      dynamicGroup.addControl('v2_bool_' + extra.id, new FormControl(false, []));
    }
    this.syncV2RegularSelection();

    dynamicGroup.get('regularPackageId')?.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => this.syncV2RegularSelection());
    dynamicGroup.get('additionalBedroomsV2')?.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => this.syncV2RegularSelection());
  }

  private syncV2RegularSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgIdRaw = dynamicGroup.get('regularPackageId')?.value;
    const pkgId = typeof pkgIdRaw === 'string' && pkgIdRaw.trim().length > 0 ? pkgIdRaw : null;
    const pkg = pkgId ? (this.regularPackagesV2.find(p => p.id === pkgId) || null) : null;
    const extra = Number(dynamicGroup.get('additionalBedroomsV2')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));
    this.v2SelectedExtrasSet = new Set();
    for (const extraDef of this.optionalExtrasV2) {
      const boolCtrl = dynamicGroup.get('v2_bool_' + extraDef.id);
      if (boolCtrl && !!boolCtrl.value) {
        this.v2SelectedExtrasSet.add(extraDef.id);
      }
      const qtyCtrl = dynamicGroup.get('v2_qty_' + extraDef.id);
      if (qtyCtrl && extraDef.kind === 'qty') {
        const qtyN = Number(qtyCtrl.value) || 0;
        if (this.v2SelectedExtrasSet.has(extraDef.id) && qtyN > 0) {
          this.v2ExtrasQty[extraDef.id] = qtyN;
        }
      }
    }
    dynamicGroup.patchValue({
      bedrooms: pkg ? pkg.bedrooms + extraBedrooms : 1,
      bathrooms: pkg ? pkg.bathrooms : 1
    }, { emitEvent: false });
  }

  getV2SelectedSpecialServiceId(): SpecialServiceIdV2 | null {
    if (!this.useV2Model) return null;
    const df = (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};
    const idRaw = df?.specialServiceId;
    const id = typeof idRaw === 'string' ? idRaw.trim() : '';
    if (!id) return null;
    const found = this.specialServicesV2.find(s => s.id === id);
    return found ? (found.id as SpecialServiceIdV2) : null;
  }

  getV2SelectedSpecialDescription(): string {
    const id = this.getV2SelectedSpecialServiceId();
    if (!id) return '';
    const found = this.specialServicesV2.find(s => s.id === id);
    return found?.shortDescription ?? '';
  }

  getV2RegularPackage(): RegularCleaningPackageV2 | null {
    const pkg = this.getSelectedV2RegularPackage();
    if (pkg) return pkg;
    const df = (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};
    const pkgId = typeof df?.regularPackageId === 'string' ? df.regularPackageId.trim() : '';
    return pkgId ? (this.regularPackagesV2.find(p => p.id === pkgId) || null) : null;
  }

  getV2AdditionalBedrooms(): number {
    const df = (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};
    return this.toInt(df?.additionalBedroomsV2, 0, 10, 0);
  }

  isV2ExtraSelected(extraId: OptionalExtraIdV2): boolean {
    return this.v2SelectedExtrasSet.has(extraId);
  }

  getV2ExtraQty(extraId: OptionalExtraIdV2): number {
    const df = (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};
    const qty = Number(df['v2_qty_' + extraId]) || 0;
    return qty;
  }

  onV2ExtraBoolToggle(extraId: OptionalExtraIdV2, checked: boolean): void {
    // Protección: no permitir seleccionar un extra que esté disabled (Special includes / incompatible)
    if (checked) {
      const state = this.getV2ExtraDisabledState(extraId);
      if (state.disabled) return;
    }
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const ctrl = dynamicGroup.get('v2_bool_' + extraId);
    if (ctrl) ctrl.setValue(checked, { emitEvent: true });
    if (checked) {
      this.v2SelectedExtrasSet.add(extraId);
      const extraDef = this.optionalExtrasV2.find(e => e.id === extraId);
      if (extraDef && extraDef.kind === 'qty') {
        const defaultQty = Number((dynamicGroup.get('v2_qty_' + extraId) as FormControl | undefined)?.value)
          || extraDef.minQuantity || 1;
        const qtyCtrl = dynamicGroup.get('v2_qty_' + extraId);
        if (qtyCtrl) qtyCtrl.setValue(defaultQty, { emitEvent: true });
        this.v2ExtrasQty[extraId] = defaultQty;
      }
    } else {
      this.v2SelectedExtrasSet.delete(extraId);
      delete this.v2ExtrasQty[extraId];
    }
    this.markPricePreviewDirty();
  }

  onV2ExtraQtyChange(extraId: OptionalExtraIdV2, value: number): void {
    // Protección: no permitir quantity changes sobre extras disabled/incompatibles/incluidos
    const state = this.getV2ExtraDisabledState(extraId);
    if (state.disabled) return;
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const ctrl = dynamicGroup.get('v2_qty_' + extraId);
    const extraDef = this.optionalExtrasV2.find(e => e.id === extraId);
    const min = extraDef?.minQuantity ?? 1;
    const max = extraDef?.maxQuantity ?? 9999;
    const n = Math.max(min, Math.min(max, Math.trunc(Number(value) || min)));
    if (ctrl) ctrl.setValue(n, { emitEvent: true });
    if (n > 0) {
      // Si se cambió qty directo por UI y el bool no estaba activado, activar implícitamente
      const boolCtrl = dynamicGroup.get('v2_bool_' + extraId);
      if (boolCtrl && !boolCtrl.value) boolCtrl.setValue(true, { emitEvent: true });
      this.v2SelectedExtrasSet.add(extraId);
      this.v2ExtrasQty[extraId] = n;
    } else {
      this.v2SelectedExtrasSet.delete(extraId);
      delete this.v2ExtrasQty[extraId];
    }
    this.markPricePreviewDirty();
  }

  onV2SpecialServiceChange(specialId: string): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const clean = String(specialId ?? '').trim();
    dynamicGroup.get('specialServiceId')?.setValue(clean, { emitEvent: true });
    this.syncV2RegularSelection();
    this.markPricePreviewDirty();
  }


  get windowsQuantitySelected(): number {
    const raw = Number(this.bookingForm.get('dynamicFields.windowsQuantity')?.value);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.trunc(raw));
  }

  get laundryLoadsSelected(): number {
    const raw = Number(this.bookingForm.get('dynamicFields.laundryLoads')?.value);
    if (!Number.isFinite(raw)) return 1;
    return Math.min(2, Math.max(1, Math.trunc(raw)));
  }

  onExtraChange(event: any): void {
    const extrasArray = this.bookingForm.get('extras') as FormArray;
    const value = String(event?.target?.value ?? '');
    if (!value) return;

    if (event?.target?.checked) {
      const alreadySelected = extrasArray.controls.some(c => c.value === value);
      if (!alreadySelected) {
        extrasArray.push(new FormControl(value));
      }
      this.normalizeExtras(extrasArray);
    } else {
      let index = extrasArray.controls.findIndex(x => x.value === value);
      while (index >= 0) {
        extrasArray.removeAt(index);
        index = extrasArray.controls.findIndex(x => x.value === value);
      }
    }
    this.markPricePreviewDirty();
  }

  private normalizeExtras(extrasArray: FormArray): void {
    const seen = new Set<string>();
    for (let i = extrasArray.length - 1; i >= 0; i--) {
      const value = String(extrasArray.at(i)?.value ?? '');
      if (!value) {
        extrasArray.removeAt(i);
        continue;
      }
      if (seen.has(value)) {
        extrasArray.removeAt(i);
        continue;
      }
      seen.add(value);
    }
  }

  isExtraSelected(name: string): boolean {
    const extrasArray = this.bookingForm.get('extras') as FormArray;
    const values: string[] = Array.isArray(extrasArray.value) ? extrasArray.value : [];
    return values.includes(name);
  }

  private subscribeSharedPricingControls(): void {
    this.bookingForm.get('frequency')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.markPricePreviewDirty();
      });

    this.discountControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.markPricePreviewDirty();
      });

    this.petsAtHomeControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((on) => {
        if (!on) {
          this.petSafetyNotesControl?.setValue('', { emitEvent: true });
        }
        this.markPricePreviewDirty();
      });

    this.useOwnProductsControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((on) => {
        if (!on) {
          this.cleaningProductNotesControl?.setValue('', { emitEvent: true });
        }
        this.markPricePreviewDirty();
      });
  }

  private subscribeDynamicFieldsPricing(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup | null;
    if (!dynamicGroup) return;

    dynamicGroup.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => {
        this.markPricePreviewDirty();
      });
  }

  requestCoverageEstimate(): void {
    if (!this.canRequestCoverageEstimate) return;
    this.isCheckingCoverage = true;
    this.coverageMessage = 'Verifying your address...';
    this.syncFormControlDisabledStates();
    this.updatePrice();
  }

  private markPricePreviewDirty(clearSelectedCoords: boolean = false): void {
    this.isCheckingCoverage = false;
    this.isPricePreviewDirty = true;
    this.pricePreviewResult = null;
    this.resetPricePreviewState();

    if (clearSelectedCoords) {
      this.selectedCoords = null;
    }

    const addressValue = String(this.bookingForm?.get('address')?.value ?? '').trim();
    if (!this.selectedService || addressValue.length < this.minAddressLengthForPreview) {
      this.coverageMessage = '';
      this.syncFormControlDisabledStates();
      return;
    }

    if (this.isPricePreviewUnavailable) {
      this.coverageMessage =
        'Address verification is temporarily unavailable. Reload the page after geolocation service is restored.';
      this.syncFormControlDisabledStates();
      return;
    }

    this.coverageMessage = 'Estimate not calculated yet. Click "Check Coverage & Estimate".';
    this.syncFormControlDisabledStates();
  }

  updatePrice(): void {
    if (!this.selectedService) {
      this.resetPricePreviewState();
      return;
    }

    const applyDiscount = !!this.bookingForm.get('applyFirstDiscount')?.value;

    const cleaningType = this.selectedService.slug;
    const dynamicFieldsRaw =
      (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};

    let payload: any;
    let sanitizedDynamicFields: any;

    if (this.useV2Model) {
      this.syncV2RegularSelection();
      const regularPkg = this.getV2RegularPackage();
      const specialId = this.getV2SelectedSpecialServiceId();
      const addBeds = this.getV2AdditionalBedrooms();
      if (!regularPkg) {
        this.pricePreviewResult = null;
        this.isCheckingCoverage = false;
        this.coverageMessage = this.coverageMessage || '';
        this.resetPricePreviewState();
        this.syncFormControlDisabledStates();
        return;
      }
      const extrasV2Payload: any[] = [];
      for (const extraDef of this.optionalExtrasV2) {
        if (!this.v2SelectedExtrasSet.has(extraDef.id)) continue;
        if (extraDef.kind === 'qty') {
          const q = this.toInt(
            this.v2ExtrasQty[extraDef.id] ?? dynamicFieldsRaw['v2_qty_' + extraDef.id],
            extraDef.minQuantity ?? 1,
            extraDef.maxQuantity ?? 9999,
            extraDef.minQuantity ?? 1
          );
          extrasV2Payload.push({ type: extraDef.id, quantity: q });
        } else {
          extrasV2Payload.push({ type: extraDef.id });
        }
      }
      sanitizedDynamicFields = {
        pricingModelVersion: 'V2' as PricingModelVersion,
        regularPackageId: regularPkg.id,
        specialServiceId: specialId ?? undefined,
        additionalBedroomsV2: addBeds,
        bedrooms: regularPkg.bedrooms + addBeds,
        bathrooms: regularPkg.bathrooms,
        additionalBedrooms: addBeds,
      };
      payload = {
        pricingModelVersion: 'V2' as PricingModelVersion,
        cleaningType,
        regularCleaningPackageId: regularPkg.id,
        specialServiceId: specialId ?? undefined,
        address: this.bookingForm.get('address')?.value,
        frequency: this.bookingForm.get('frequency')?.value,
        extras: extrasV2Payload,
        petsAtHome: !!this.bookingForm.get('petsAtHome')?.value,
        useOwnProducts: !!this.bookingForm.get('useOwnProducts')?.value,
        applyFirstDiscount: applyDiscount,
        bedrooms: regularPkg.bedrooms + addBeds,
        bathrooms: regularPkg.bathrooms,
        additionalBedrooms: addBeds,
        dynamicFields: sanitizedDynamicFields,
      };
    }

    const addressValue = String(payload?.address ?? '').trim();
    const hasAddressForPreview = addressValue.length >= this.minAddressLengthForPreview;
    if (!hasAddressForPreview) {
      this.pricePreviewResult = null;
      this.isCheckingCoverage = false;
      this.coverageMessage = '';
      this.resetPricePreviewState();
      this.syncFormControlDisabledStates();
      return;
    }

    if (this.isPricePreviewUnavailable) {
      this.pricePreviewResult = null;
      this.isCheckingCoverage = false;
      this.coverageMessage =
        'Address verification is temporarily unavailable. Reload the page after geolocation service is restored.';
      this.resetPricePreviewState();
      this.syncFormControlDisabledStates();
      return;
    }

    if (Date.now() < this.pricePreviewCooldownUntil) {
      this.isCheckingCoverage = false;
      this.coverageStatus = 'outside';
      this.coverageMessage = 'Address verification is temporarily unavailable. Please wait a moment before trying again.';
      this.resetPricePreviewState();
      this.syncFormControlDisabledStates();
      return;
    }

    if (this.selectedCoords && addressValue.length >= 10) {
      payload.lat = this.selectedCoords.lat;
      payload.lng = this.selectedCoords.lng;
    }

    if (typeof sanitizedDynamicFields?.bedrooms === 'number') payload.bedrooms = sanitizedDynamicFields.bedrooms;
    if (typeof sanitizedDynamicFields?.bathrooms === 'number') payload.bathrooms = sanitizedDynamicFields.bathrooms;
    if (typeof sanitizedDynamicFields?.additionalBedrooms === 'number') {
      payload.additionalBedrooms = sanitizedDynamicFields.additionalBedrooms;
    }

    const requestId = ++this.currentPricePreviewRequestId;
    this.isCheckingCoverage = true;
    this.bookingService
      .pricePreview(payload)
      .pipe(takeUntil(this.destroy$), timeout(30000))
      .subscribe({
        next: (res: any) => {
          if (requestId !== this.currentPricePreviewRequestId) return;
          this.isCheckingCoverage = false;
          this.isPricePreviewUnavailable = false;
          this.isPricePreviewDirty = false;
          this.pricePreviewCooldownUntil = 0;
          this.pricePreviewResult = res;
          const estimatedPrice = Number(res?.estimatedPrice);
          const finalPrice = Number(res?.finalPrice ?? res?.finalPricePreview);
          const discountAmount = Number(
            res?.breakdown?.discountAmount ?? res?.discountAmount,
          );
          const discountPercent = Number(
            res?.breakdown?.discountPercent ?? res?.discountPercent,
          );
          const distanceFee = Number(res?.fees?.distanceFee ?? res?.distanceFee);
          const itemsRaw = (res as any)?.breakdown?.items;

          if (!Number.isFinite(estimatedPrice) || !Number.isFinite(finalPrice)) {
            this.isPricePreviewDirty = true;
            this.estimatedPrice = 0;
            this.finalPrice = 0;
            this.pricingItems = [];
            this.discountPercent = 0;
            this.discountAmount = 0;
            this.distanceFee = 0;
            return;
          }

          this.estimatedPrice = estimatedPrice;
          this.finalPrice = finalPrice;
          this.discountAmount = Number.isFinite(discountAmount) ? discountAmount : 0;
          this.discountPercent = Number.isFinite(discountPercent) ? discountPercent : 0;
          this.distanceFee = Number.isFinite(distanceFee) ? distanceFee : 0;
          this.borderlineFeeV2 = Number(
            (res as any)?.fees?.borderlineFee ??
              (res as any)?.breakdown?.borderlineFee ??
              (res as any)?.borderlineFee ??
              0,
          );
          this.pricingItems = Array.isArray(itemsRaw)
            ? itemsRaw
                .filter((x) => x && typeof x === 'object')
                .map((x) => ({
                  label: String((x as any).label ?? ''),
                  amount: Number((x as any).amount),
                }))
                .filter((x) => x.label && Number.isFinite(x.amount))
            : [];

          const coverageResolved = (res as any)?.coverageResolved !== false;
          if (!coverageResolved) {
            this.hasVerifiedCoverage = false;
            this.coverageStatus = 'outside';
            this.isExtraCharge = false;
            this.coverageCity = '';
            this.assignedDistance = 0;
            this.coverageMessage =
              typeof (res as any)?.coverageMessage === 'string' &&
              String((res as any).coverageMessage).trim()
                ? String((res as any).coverageMessage).trim()
                : 'Address verification is temporarily unavailable. Estimate generated without coverage validation.';
            this.syncFormControlDisabledStates();
            return;
          }

          this.hasVerifiedCoverage = true;

          const v2Classification = String((res as any)?.coverageClassification ?? '').toUpperCase();
          const v2Valid =
            v2Classification === 'INSIDE' ||
            v2Classification === 'BORDERLINE' ||
            v2Classification === 'OUTSIDE';
          const statusRaw = String((res as any)?.coverageStatus ?? '').toLowerCase();
          const statusLegacyValid =
            statusRaw === 'inside' || statusRaw === 'borderline' || statusRaw === 'outside';
          const status: 'inside' | 'borderline' | 'outside' = v2Valid
            ? (v2Classification.toLowerCase() as any)
            : statusLegacyValid
              ? (statusRaw as any)
              : 'outside';

          this.coverageStatus = status;
          const v2Applicable = (res as any)?.v2BorderlineFeeApplicable === true;
          const v2ClassificationBorderline = status === 'borderline';
          this.isExtraCharge = v2Applicable || v2ClassificationBorderline || this.borderlineFeeV2 > 0;
          this.coverageCity = typeof (res as any)?.assignedZone === 'string' ? (res as any).assignedZone : '';
          const d =
            typeof (res as any)?.assignedDistanceKm === 'number'
              ? (res as any).assignedDistanceKm
              : typeof (res as any)?.distanceKm === 'number'
                ? (res as any).distanceKm
                : 0;
          this.assignedDistance = Number.isFinite(d) ? d : 0;

          if (status !== 'outside' && this.coverageCity) {
            if (this.isExtraCharge) {
              const v2Fee =
                this.borderlineFeeV2 > 0
                  ? this.borderlineFeeV2
                  : typeof (res as any)?.v2BorderlineFeeApplicable === 'boolean'
                    ? BORDERLINE_FEE_AMOUNT_V2
                    : this.distanceFee;
              const feeLabel =
                v2Fee > 0
                  ? ` Note: A $${v2Fee} borderline surcharge applies (≤1 km outside main zone limits).`
                  : '';
              this.coverageMessage = `Great news! We cover ${this.coverageCity} (${this.assignedDistance}km from center).${feeLabel}`;
            } else {
              this.coverageMessage = `Great news! We cover ${this.coverageCity} (${this.assignedDistance}km from center).`;
            }
          } else if (String(this.bookingForm.get('address')?.value ?? '').trim().length >= 10 || this.selectedCoords) {
            this.coverageMessage = 'Sorry, we currently do not serve your location.';
          } else {
            this.coverageMessage = '';
          }

          this.syncFormControlDisabledStates();
        },
        error: (err: unknown) => {
          if (requestId !== this.currentPricePreviewRequestId) return;
          this.isCheckingCoverage = false;
          this.pricePreviewResult = null;
          this.resetPricePreviewState();

          this.coverageStatus = 'outside';
          this.hasVerifiedCoverage = false;
          this.isPricePreviewDirty = true;
          this.isExtraCharge = false;
          this.assignedDistance = 0;
          this.coverageCity = '';

          const httpErr = err as HttpErrorResponse;
          if (httpErr && typeof httpErr.status === 'number') {
            if (httpErr.status === 400) {
              const msg =
                typeof (httpErr as any)?.error?.message === 'string'
                  ? String((httpErr as any).error.message).trim()
                  : '';
              this.coverageMessage =
                msg || "We couldn't verify this address. Please ensure it's correct and located in Florida.";
            } else if (httpErr.status === 429) {
              this.coverageMessage = 'Too many requests. Please try again later.';
            } else if (httpErr.status === 503) {
              this.isPricePreviewUnavailable = true;
              this.pricePreviewCooldownUntil = Date.now() + this.pricePreviewRetryCooldownMs;
              this.coverageMessage =
                'Address verification is temporarily unavailable. Reload the page after geolocation service is restored.';
            } else {
              this.coverageMessage = 'Unable to verify your location right now.';
              this.logger.warn('Unexpected price preview error', {
                status: httpErr.status,
                error: httpErr.error ?? httpErr.message,
              });
            }
          } else {
            this.coverageMessage = 'Unable to verify your location right now.';
            this.logger.warn('Price preview request failed', err);
          }

          this.syncFormControlDisabledStates();
        },
      });
  }

  private resetPricePreviewState(): void {
    this.estimatedPrice = 0;
    this.finalPrice = 0;
    this.pricingItems = [];
    this.discountPercent = 0;
    this.discountAmount = 0;
    this.distanceFee = 0;
  }

  checkQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const serviceSlug = String(params['service'] ?? '').trim();
        const serviceName = String(params['serviceName'] ?? '').trim();
        const promo = String(params['promo'] ?? '').trim();
        const discountParam = String(params['discount'] ?? '').trim();
        const canSyncBookingStatus =
          this.isAdminManualBooking ||
          (this.auth.hasValidToken() && this.auth.isAdminOrSupervisor());

        if (canSyncBookingStatus) {
          const bookingIdParam =
            String(params['bookingId'] ?? params['booking'] ?? params['id'] ?? '').trim();
          const sessionIdParam =
            String(params['session_id'] ?? params['sessionId'] ?? '').trim();
          const paymentReturnParam =
            String(params['payment'] ?? params['fromStripe'] ?? params['stripe'] ?? '').trim();
          const isPaymentReturn =
            paymentReturnParam === '1' ||
            paymentReturnParam.toLowerCase() === 'true' ||
            !!sessionIdParam;
          const isPaymentCancel = String(this.router.url ?? '').includes('/payment/cancel');
          const isPaymentSuccess = String(this.router.url ?? '').includes('/payment/success');
          const isPaymentContextFromPath = isPaymentCancel || isPaymentSuccess;

          const storedBookingId = !bookingIdParam
            ? String(sessionStorage.getItem(this.bookingIdStorageKey) ?? '').trim()
            : '';
          const effectiveBookingId = bookingIdParam || storedBookingId;

          if (effectiveBookingId && effectiveBookingId !== this.lastStatusRefreshBookingId) {
            this.refreshBookingStatus(effectiveBookingId, isPaymentReturn || isPaymentContextFromPath, isPaymentCancel);
          } else if (!effectiveBookingId && (isPaymentReturn || isPaymentContextFromPath)) {
            this.isPaymentReturnContext = true;
            this.isPaymentCancelContext = isPaymentCancel;
            this.paymentUiState = isPaymentCancel ? 'PAYMENT_FAILED' : 'PENDING_PAYMENT';
            this.paymentStatusHint = isPaymentCancel ? 'Payment cancelled.' : 'Payment pending confirmation.';
          }
        }

        if (discountParam === '1' || promo) {
          this.bookingForm.get('applyFirstDiscount')?.setValue(true, { emitEvent: true });
        }

        const service =
          (serviceSlug ? this.serviceData.getServiceBySlug(serviceSlug) : undefined) ??
          (serviceName ? this.serviceData.getEnabledServices().find(s => s.title === serviceName) : undefined);

        if (service) {
          this.selectService(service.slug);
          this.scrollToBookingForm();
        }

        if (discountParam === '1' || promo) {
          this.scrollToBookingForm();
        }
      });
  }

  private refreshBookingStatus(bookingId: string, isPaymentReturn: boolean, isPaymentCancel: boolean): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;

    this.lastStatusRefreshBookingId = id;
    this.isRefreshingBookingStatus = true;
    this.isPaymentReturnContext = isPaymentReturn;
    this.isPaymentCancelContext = isPaymentCancel;
    this.paymentStatusHint = '';
    this.paymentUiState = 'NONE';
    this.syncedBooking = null;
    this.paymentPollStop$.next();

    sessionStorage.setItem(this.bookingIdStorageKey, id);

    this.bookingService.getBookingById(id).subscribe({
      next: (booking) => {
        const status = (booking as any)?.status ?? null;
        this.syncedBooking = booking;
        this.submittedBookingId = (booking as any)?._id ?? id;
        this.submittedBookingStatus = status;
        this.submitSuccess = true;
        this.isWaitingForConfirmation = status === 'pending';
        this.submitMessage = this.getUserFriendlyStatusMessage(status);
        this.paymentUiState = this.derivePaymentUiState(booking, isPaymentReturn, isPaymentCancel);
        this.paymentStatusHint = this.getPaymentHint(this.paymentUiState, isPaymentReturn, isPaymentCancel);
        this.isRefreshingBookingStatus = false;

        if (isPaymentReturn && this.paymentUiState === 'PENDING_PAYMENT') {
          this.startPaymentPolling(id, isPaymentCancel);
        }
      },
      error: (error) => {
        this.isRefreshingBookingStatus = false;
        this.logger.error('Booking status refresh failed', error);
      }
    });
  }

  private startPaymentPolling(bookingId: string, isPaymentCancel: boolean): void {
    const id = String(bookingId ?? '').trim();
    if (!id) return;

    timer(4000, 4000)
      .pipe(
        takeUntil(merge(this.destroy$, this.paymentPollStop$)),
        switchMap(() =>
          this.bookingService.getBookingById(id).pipe(
            catchError(() => of(null))
          )
        )
      )
      .subscribe((booking) => {
        if (!booking) return;
        const status = (booking as any)?.status ?? null;
        this.syncedBooking = booking;
        this.submittedBookingId = (booking as any)?._id ?? id;
        this.submittedBookingStatus = status;
        this.isWaitingForConfirmation = status === 'pending';
        this.submitMessage = this.getUserFriendlyStatusMessage(status);
        this.paymentUiState = this.derivePaymentUiState(booking, true, isPaymentCancel);
        this.paymentStatusHint = this.getPaymentHint(this.paymentUiState, true, isPaymentCancel);

        if (this.paymentUiState === 'PAYMENT_CONFIRMED' || this.paymentUiState === 'PAYMENT_FAILED') {
          this.paymentPollStop$.next();
        }
      });
  }

  private derivePaymentUiState(booking: unknown, isPaymentReturn: boolean, isPaymentCancel: boolean): PaymentUiState {
    const anyBooking = booking as any;
    const bookingStatus = String(anyBooking?.status ?? '').trim();
    const paymentStatus = String(anyBooking?.payment?.status ?? '').trim();
    const hasPaymentUrl = typeof anyBooking?.paymentUrl === 'string' && anyBooking.paymentUrl.trim().length > 0;

    if (bookingStatus === 'paid' || paymentStatus === 'paid') return 'PAYMENT_CONFIRMED';
    if (paymentStatus === 'failed') return 'PAYMENT_FAILED';

    if (isPaymentCancel && bookingStatus !== 'paid') return 'PAYMENT_FAILED';

    if (bookingStatus === 'confirmed') {
      if (paymentStatus === 'pending' || hasPaymentUrl || isPaymentReturn) return 'PENDING_PAYMENT';
    }

    return 'NONE';
  }

  private getPaymentHint(state: PaymentUiState, isPaymentReturn: boolean, isPaymentCancel: boolean): string {
    if (!isPaymentReturn) return '';
    if (state === 'PAYMENT_CONFIRMED') return 'Payment confirmed.';
    if (state === 'PAYMENT_FAILED') return isPaymentCancel ? 'Payment cancelled.' : 'Payment failed.';
    if (state === 'PENDING_PAYMENT') return 'Payment pending confirmation.';
    return '';
  }

  private scrollToBookingForm(): void {
    setTimeout(() => {
      const el = document.getElementById('booking-form');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  selectService(slug: string): void {
    this.bookingForm.patchValue({ cleaningType: slug });
  }

  private resetDiscountAvailabilityState(): void {
    const applyDiscountControl = this.bookingForm.get('applyFirstDiscount');
    if (!applyDiscountControl) return;

    this.isCheckingDiscount = false;
    this.isDiscountBlocked = false;
    this.discountCheckMessage = '';
    this.lastCheckedDiscountEmail = '';
    this.syncFormControlDisabledStates();
  }

  onSubmit(): void {
    if (this.isCheckingCoverage) return;
    if (this.isSubmitting) return;

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.confirmSnapshot = this.buildConfirmationSnapshot();
    this.openConfirmModal();
  }

  openConfirmModal(): void {
    this.isConfirmModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    if (!this.isServiceInfoModalOpen) {
      document.body.style.overflow = 'auto';
    }
  }

  confirmAndSubmit(): void {
    if (this.isSubmitting) return;
    this.closeConfirmModal();
    this.submitBooking();
  }

  /** Abre modal ⓘ de un Special Service (contenido completo) */
  openSpecialServiceInfo(id: SpecialServiceIdV2): void {
    this.serviceInfoModalId = id;
    this.isServiceInfoModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /** Cierra modal ⓘ Special Service */
  closeSpecialServiceInfo(): void {
    this.isServiceInfoModalOpen = false;
    this.serviceInfoModalId = null;
    if (!this.isConfirmModalOpen && !this.isExtraInfoModalOpen) {
      document.body.style.overflow = 'auto';
    }
  }

  /** Datos Special Service del modal ⓘ (null si no hay o no existe) */
  getServiceInfoModalData(): SpecialServiceV2 | null {
    if (!this.serviceInfoModalId) return null;
    return SPECIAL_SERVICES_V2[this.serviceInfoModalId] ?? null;
  }

  /** Abre modal ⓘ Extra (contenido completo) */
  openExtraInfoModal(id: OptionalExtraIdV2): void {
    this.extraInfoModalId = id;
    this.isExtraInfoModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /** Cierra modal ⓘ Extra */
  closeExtraInfoModal(): void {
    this.isExtraInfoModalOpen = false;
    this.extraInfoModalId = null;
    if (!this.isConfirmModalOpen && !this.isServiceInfoModalOpen) {
      document.body.style.overflow = 'auto';
    }
  }

  /** Datos Extra del modal ⓘ (null si no hay o no existe) */
  getExtraInfoModalData(): OptionalExtraV2 | null {
    if (!this.extraInfoModalId) return null;
    return OPTIONAL_EXTRAS_V2[this.extraInfoModalId] ?? null;
  }

  /** Helper: ¿extra disabled + reason? facade sobre catalog isExtraDisabledV2 */
  getV2ExtraDisabledState(extraId: OptionalExtraIdV2): { disabled: boolean; reason?: string } {
    return isExtraDisabledV2(extraId, this.getV2SelectedSpecialServiceId(), this.v2SelectedExtrasSet);
  }

  /** ---------- [V2 UI] Counters bedrooms additional ---------- */
  get v2AddBedroomsValue(): number {
    const ctl = (this.bookingForm?.get('dynamicFields') as FormGroup | null)?.get('additionalBedroomsV2');
    const v = ctl?.value;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.max(0, v | 0) : 0;
  }
  incrementV2AdditionalBedrooms(): void {
    const ctl = (this.bookingForm?.get('dynamicFields') as FormGroup | null)?.get('additionalBedroomsV2');
    if (!ctl) return;
    const current = this.v2AddBedroomsValue;
    const next = Math.min(10, current + 1);
    ctl.setValue(next, { emitEvent: true });
    ctl.markAsDirty();
  }
  decrementV2AdditionalBedrooms(): void {
    const ctl = (this.bookingForm?.get('dynamicFields') as FormGroup | null)?.get('additionalBedroomsV2');
    if (!ctl) return;
    const next = Math.max(0, this.v2AddBedroomsValue - 1);
    ctl.setValue(next, { emitEvent: true });
    ctl.markAsDirty();
  }

  /** ---------- [V2 UI] Select Regular package (facade formControl) ---------- */
  selectV2RegularPackage(packageId: string): void {
    const dynamicGroup = this.bookingForm?.get('dynamicFields') as FormGroup | null;
    const ctl = dynamicGroup?.get('regularPackageId');
    if (!ctl) return;
    ctl.setValue(packageId, { emitEvent: true });
    ctl.markAsDirty();
  }
  getSelectedV2RegularPackage(): RegularCleaningPackageV2 | null {
    const dynamicGroup = this.bookingForm?.get('dynamicFields') as FormGroup | null;
    const id = dynamicGroup?.get('regularPackageId')?.value;
    return REGULAR_CLEANING_PACKAGES_V2.find(p => p.id === id) ?? null;
  }
  getSelectedV2RegularPackageId(): string | null {
    const pkg = this.getSelectedV2RegularPackage();
    return pkg ? pkg.id : null;
  }

  /** ---------- [V2 UI] Estimated Price PROGRESIVO (Fase 6: Regular + AddBeds + Special + Extras) ---------- */
  getV2ExtrasSubtotal(): number {
    let total = 0;
    for (const extra of this.optionalExtrasV2) {
      if (!this.v2SelectedExtrasSet.has(extra.id)) continue;
      const qty =
        extra.kind === 'qty' ? Math.max(0, this.getV2ExtraQty(extra.id) || (extra.minQuantity ?? 1)) : 1;
      if (qty <= 0) continue;
      const price = Number(extra.unitPrice);
      if (!Number.isFinite(price) || price < 0) continue;
      total += price * qty;
    }
    return total;
  }
  getV2ExtraItemPrice(extraId: OptionalExtraIdV2): number {
    const extra = this.optionalExtrasV2.find(e => e.id === extraId);
    if (!extra || !this.v2SelectedExtrasSet.has(extraId)) return 0;
    const qty =
      extra.kind === 'qty' ? Math.max(0, this.getV2ExtraQty(extraId) || (extra.minQuantity ?? 1)) : 1;
    return qty > 0 ? Math.max(0, Number(extra.unitPrice) || 0) * qty : 0;
  }
  getV2LocalEstimatedPrice(): number | null {
    const pkg = this.getSelectedV2RegularPackage();
    if (!pkg) return null;
    const addBeds = this.getV2AdditionalBedrooms();
    const addBedPrice = Number.isFinite(this.v2ExtraBedroomPrice) ? this.v2ExtraBedroomPrice : EXTRA_BEDROOM_PRICE_V2;
    let subtotal = pkg.basePrice + Math.max(0, addBeds) * Math.max(0, addBedPrice);
    const spId = this.getV2SelectedSpecialServiceId();
    if (spId) {
      const sp = SPECIAL_SERVICES_V2[spId];
      if (sp && typeof sp.flatFee === 'number' && Number.isFinite(sp.flatFee)) {
        subtotal += Math.max(0, sp.flatFee);
      }
    }
    subtotal += Math.max(0, this.getV2ExtrasSubtotal());
    return subtotal;
  }

  /** ---------- [V2 UI] Select Special Service (radio). ÚNICA selección. Click misma = deselecciona. ---------- */
  selectV2SpecialService(id: SpecialServiceIdV2 | null): void {
    const dynamicGroup = this.bookingForm?.get('dynamicFields') as FormGroup | null;
    const ctl = dynamicGroup?.get('specialServiceId');
    if (!ctl) return;
    const current = ctl.value as string | null | undefined;
    const nextSame = !!id && !!current && String(id) === String(current);
    const nextId: SpecialServiceIdV2 | null = nextSame ? null : id;
    ctl.setValue(nextId, { emitEvent: true });
    ctl.markAsDirty();
    /** Al cambiar Special, limpiar extras incompatibles automáticamente */
    const toRemove: OptionalExtraIdV2[] = [];
    for (const extraId of Array.from(this.v2SelectedExtrasSet)) {
      const state = isExtraDisabledV2(extraId, nextId, this.v2SelectedExtrasSet);
      if (state.disabled && this.v2SelectedExtrasSet.has(extraId)) {
        toRemove.push(extraId);
      }
    }
    for (const extraId of toRemove) {
      this.onV2ExtraBoolToggle(extraId, false);
    }
    this.markPricePreviewDirty();
  }

  /** ---------- [V2 UI] Coverage state classification ---------- */
  getV2CoverageState(): 'LOADING' | 'UNAVAILABLE' | 'INSIDE' | 'BORDERLINE' | 'OUTSIDE' {
    if (!this.useV2Model) return 'UNAVAILABLE';
    if (this.isCheckingCoverage) return 'LOADING';
    const classification = (this.pricePreviewResult as any)?.coverageClassification;
    if (classification === 'INSIDE') return 'INSIDE';
    if (classification === 'BORDERLINE') return 'BORDERLINE';
    if (classification === 'OUTSIDE') return 'OUTSIDE';
    /** Solo fallbacks V2-local, NUNCA usa isBorderline V1 */
    if (this.hasVerifiedCoverage) {
      if (this.coverageStatus === 'inside') return 'INSIDE';
      if (this.coverageStatus === 'borderline') return 'BORDERLINE';
      if (this.coverageStatus === 'outside') return 'OUTSIDE';
    }
    return 'UNAVAILABLE';
  }
  getV2CoverageFeeLabel(): string | null {
    if (this.getV2CoverageState() !== 'BORDERLINE') return null;
    return `+$${BORDERLINE_FEE_AMOUNT_V2}`;
  }

  /** ---------- [V2 UI] Price summary breakdown fields ---------- */
  getV2BaseServicePrice(): number {
    return Number((this.pricePreviewResult as any)?.fees?.baseServicePrice ?? (this.pricePreviewResult as any)?.baseServicePrice ?? 0);
  }
  getV2AdditionalBedroomsFee(): number {
    return Number((this.pricePreviewResult as any)?.fees?.additionalBedroomsFee ?? (this.pricePreviewResult as any)?.additionalBedroomsFee ?? 0);
  }
  getV2SpecialServiceFee(): number {
    return Number((this.pricePreviewResult as any)?.fees?.specialServiceFee ?? (this.pricePreviewResult as any)?.specialServiceFee ?? 0);
  }
  getV2ExtrasTotalFee(): number {
    return Number((this.pricePreviewResult as any)?.fees?.extrasTotal ?? (this.pricePreviewResult as any)?.extrasTotal ?? 0);
  }
  getV2BorderlineFee(): number {
    const ppr: unknown = this.pricePreviewResult as unknown;
    const feesBorderline = Number(
      (ppr as { fees?: { borderlineFee?: unknown } })?.fees?.borderlineFee,
    );
    if (Number.isFinite(feesBorderline)) return feesBorderline;
    const breakdownBorderline = Number(
      (ppr as { breakdown?: { borderlineFee?: unknown } })?.breakdown?.borderlineFee,
    );
    if (Number.isFinite(breakdownBorderline)) return breakdownBorderline;
    const rootBorderline = Number(
      (ppr as { borderlineFee?: unknown })?.borderlineFee,
    );
    if (Number.isFinite(rootBorderline)) return rootBorderline;
    const cached = Number(this.borderlineFeeV2);
    if (Number.isFinite(cached)) return cached;
    return 0;
  }
  getV2DiscountAmount(): number {
    return Number((this.pricePreviewResult as any)?.breakdown?.discountAmount ?? (this.pricePreviewResult as any)?.discountAmount ?? 0);
  }
  getV2EstimatedTotal(): number {
    const ppr: unknown = this.pricePreviewResult as unknown;
    const positiveFinite = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n) && n > 0) return n;
      return null;
    };
    const rootEstimated = positiveFinite(
      (ppr as { estimatedPrice?: unknown })?.estimatedPrice,
    );
    if (rootEstimated !== null) return rootEstimated;
    const cacheEstimated = positiveFinite(this.estimatedPrice);
    if (cacheEstimated !== null) return cacheEstimated;
    const pricingFinal = positiveFinite(
      (ppr as { pricing?: { finalPrice?: unknown } })?.pricing?.finalPrice,
    );
    if (pricingFinal !== null) return pricingFinal;
    const rootFinal = positiveFinite(
      (ppr as { finalPrice?: unknown })?.finalPrice,
    );
    if (rootFinal !== null) return rootFinal;
    const cache = positiveFinite(this.finalPrice);
    if (cache !== null) return cache;
    if (this.hasPricePreviewData === false) {
      const local = positiveFinite(this.getV2LocalEstimatedPrice());
      if (local !== null) return local;
    }
    return 0;
  }
  getV2FirstTimeDiscountApplicable(): boolean {
    return (this.pricePreviewResult as any)?.discountApplied === true;
  }
  getV2ExtrasSelectedListLabels(): string[] {
    const rows: string[] = [];
    for (const extra of this.optionalExtrasV2) {
      if (this.v2SelectedExtrasSet.has(extra.id)) {
        const qty = this.getV2ExtraQty(extra.id);
        if (extra.kind === 'qty' && qty > 1) {
          rows.push(`${extra.label} ×${qty}`);
        } else {
          rows.push(extra.label);
        }
      }
    }
    return rows;
  }
  getV2SelectedSpecialFeeLabel(): string | null {
    const id = this.getV2SelectedSpecialServiceId();
    if (!id) return null;
    const ss = SPECIAL_SERVICES_V2[id];
    return ss ? `+$${ss.flatFee}` : null;
  }

  /** ---------- [V2 UI] Clasificación reason visual extras ---------- */
  getV2ExtraVisualReason(extraId: OptionalExtraIdV2): { kind: 'included' | 'notcompatible' | 'excluded' | null; text: string } {
    const state = this.getV2ExtraDisabledState(extraId);
    if (!state.disabled || !state.reason) return { kind: null, text: '' };
    const r = state.reason.toLowerCase();
    if (r.includes('already included')) return { kind: 'included', text: state.reason };
    if (r.includes('not compatible') || r.includes('not available')) return { kind: 'notcompatible', text: state.reason };
    return { kind: 'excluded', text: state.reason };
  }

  /** ---------- [V2 UI] Alt labels extras ---------- */
  getV2ExtraAltLabel(extraId: OptionalExtraIdV2): string | null {
    if (extraId === 'garage' && this.v2SelectedExtrasSet.has('full_garage')) {
      return 'Alternative: Full Garage already selected';
    }
    if (extraId === 'full_garage' && this.v2SelectedExtrasSet.has('garage')) {
      return 'Alternative: Garage already selected';
    }
    if (extraId === 'laundry') return '$15/load · Maximum 2 loads';
    if (extraId === 'outside_window') return '$7 per window';
    if (extraId === 'heavy_furniture_moving') return '$25/item · Maximum 2 items';
    return null;
  }

  /** ---------- [V2 UI] Modal close on ESC key ---------- */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKeyHandler(event: KeyboardEvent): void {
    if (!this.useV2Model) return;
    if (this.isServiceInfoModalOpen) {
      this.closeSpecialServiceInfo();
      event.preventDefault();
    }
    if (this.isExtraInfoModalOpen) {
      this.closeExtraInfoModal();
      event.preventDefault();
    }
    if (this.isConfirmModalOpen) {
      this.closeConfirmModal();
      event.preventDefault();
    }
  }

  /** ---------- [V2 UI] Display label helpers & Custom Quote navigation ---------- */
  navigateToCustomQuote(): void {
    this.router.navigate(['/' + this.v2CustomQuoteRoutePath]);
  }
  getDisplayRegularPackageLabelV2(pkgId: string | null | undefined): string | null {
    if (!pkgId) return null;
    const pkg = this.regularPackagesV2.find(p => p.id === pkgId);
    return pkg?.label ?? null;
  }
  getDisplaySpecialServiceLabelV2(id: SpecialServiceIdV2 | null | undefined): string | null {
    if (!id) return null;
    return SPECIAL_SERVICES_V2[id]?.label ?? null;
  }

  /** ---------- [V2 UI] trackBy functions for *ngFor lists ---------- */
  trackByV2RegularPackageId(index: number, pkg: RegularCleaningPackageV2): string {
    return pkg.id;
  }
  trackByV2SpecialServiceId(index: number, ss: SpecialServiceV2): string {
    return ss.id;
  }
  trackByV2OptionalExtraId(index: number, e: OptionalExtraV2): string {
    return e.id;
  }
  trackByV2SinfoInclude(index: number, item: string): string {
    return String(index) + ':' + (item || '').substring(0, 24);
  }
  trackByV2SinfoDontInclude(index: number, item: string): string {
    return String(index) + ':' + (item || '').substring(0, 24);
  }

  /** ---------- [V2 UI] Stepper buttons for qty-based extras (Laundry/OutsideWindow) ---------- */
  incrementV2ExtraQtyButton(extraId: OptionalExtraIdV2): void {
    const extra = this.optionalExtrasV2.find(e => e.id === extraId);
    if (!extra) return;
    const min = extra.minQuantity || 1;
    const max = extra.maxQuantity || 9999;
    const cur = this.getV2ExtraQty(extraId);
    const base = cur ?? min;
    const next = Math.min(max, base + 1);
    this.onV2ExtraQtyChange(extraId, next);
  }
  decrementV2ExtraQtyButton(extraId: OptionalExtraIdV2): void {
    const extra = this.optionalExtrasV2.find(e => e.id === extraId);
    if (!extra) return;
    const min = extra.minQuantity || 1;
    const cur = this.getV2ExtraQty(extraId);
    const base = cur ?? min;
    const next = Math.max(min, base - 1);
    this.onV2ExtraQtyChange(extraId, next);
  }

  private getAncestorRouteDataFlag(key: string): boolean {
    let current: ActivatedRoute | null = this.route;
    while (current) {
      const value = (current.snapshot?.data as any)?.[key];
      if (value === true) return true;
      current = current.parent;
    }
    return false;
  }

  private submitBooking(): void {
    const discountControl = this.discountControl;

    if (this.isDiscountBlocked && discountControl?.value) {
      discountControl.setValue(false, { emitEvent: false });
    }

    this.isSubmitting = true;
    const finalPayload = this.buildSanitizedBookingData();
    const previewPayload = this.buildPricePreviewPayload(finalPayload);

    this.bookingService.pricePreview(previewPayload).subscribe({
      next: (previewResponse) => {
        this.pricePreviewResult = previewResponse;

        const coverageResolved = (previewResponse as any)?.coverageResolved !== false;
        if (!coverageResolved) {
          if (!this.isPublicQuoteRequestMode) {
            this.isSubmitting = false;
            this.coverageStatus = 'outside';
            this.coverageMessage =
              typeof (previewResponse as any)?.coverageMessage === 'string' &&
              String((previewResponse as any).coverageMessage).trim()
                ? String((previewResponse as any).coverageMessage).trim()
                : 'Address verification is temporarily unavailable. Please try again later.';
            return;
          }

          this.hasVerifiedCoverage = false;
          this.coverageMessage =
            typeof (previewResponse as any)?.coverageMessage === 'string' &&
            String((previewResponse as any).coverageMessage).trim()
              ? String((previewResponse as any).coverageMessage).trim()
              : 'Address verification is temporarily unavailable. Continuing without coverage validation.';
        }

        const v2Classification = String((previewResponse as any)?.coverageClassification ?? '').toUpperCase();
        const v2Valid =
          v2Classification === 'INSIDE' ||
          v2Classification === 'BORDERLINE' ||
          v2Classification === 'OUTSIDE';
        const statusRaw = String((previewResponse as any)?.coverageStatus ?? '').toLowerCase();
        const statusLegacyValid =
          statusRaw === 'inside' || statusRaw === 'borderline' || statusRaw === 'outside';
        // ⚠️ V2 SOURCE OF TRUTH ONLY — NO fallback a isBorderline V1 legacy
        // (criterio remainingKm <=3 incompatible con V2 1km, rompe traslapes).
        const coverageStatus: 'inside' | 'borderline' | 'outside' = v2Valid
          ? (v2Classification.toLowerCase() as any)
          : statusLegacyValid
            ? (statusRaw as any)
            : 'outside';

        if (coverageResolved && coverageStatus === 'outside') {
          this.isSubmitting = false;
          this.coverageStatus = 'outside';
          this.coverageMessage = 'Service is not available in your area.';
          return;
        }

        if (!this.pricePreviewResult) {
          this.isSubmitting = false;
          return;
        }

        this.applyPricePreviewToBookingPayload(finalPayload, this.pricePreviewResult);
        this.reconcileDiscountFlagsFromPreview(finalPayload, this.pricePreviewResult);
        const cleanedPayload = this.stripUndefinedDeep(finalPayload);

        if (!this.validateBookingPayload(cleanedPayload)) {
          this.isSubmitting = false;
          this.submitSuccess = false;
          this.isWaitingForConfirmation = false;
          this.submitMessage = 'Missing required booking fields. Please review the form and try again.';
          return;
        }

        this.submitQuoteOrBooking(cleanedPayload);
      },
      error: (error) => {
        this.pricePreviewResult = null;
        this.isSubmitting = false;
        this.submitSuccess = false;
        this.isWaitingForConfirmation = false;
        this.submitMessage = 'Unable to validate pricing right now. Please try again later.';
      }
    });
  }

  private submitQuoteOrBooking(cleanedPayload: any): void {
    const isQuoteRequest = this.isPublicQuoteRequestMode;
    const submitRequest = (payload: any) =>
      isQuoteRequest
        ? this.bookingService.requestQuote(payload)
        : this.bookingService.bookService(payload);

    this.submitMessage = isQuoteRequest
      ? 'Sending your quote request...'
      : 'Creating your booking...';

    submitRequest(cleanedPayload)
      .pipe(timeout(this.bookingSubmitTimeoutMs))
      .subscribe({
        next: (response) => {
          this.handleBookingSubmitSuccess(response);
        },
        error: (error) => {
          const httpError = error instanceof HttpErrorResponse ? error : null;
          const status = httpError?.status;
          const isTimeout = error instanceof TimeoutError;
          if ((status === 500 || isTimeout) && cleanedPayload?.applyFirstDiscount === true) {
            const retryPayload = this.stripUndefinedDeep({
              ...cleanedPayload,
              applyFirstDiscount: false
            });
            this.submitMessage = isQuoteRequest
              ? 'Sending your quote request without discount...'
              : 'Creating your booking without discount...';
            this.discountControl?.setValue(false, { emitEvent: false });
            this.discountControl?.disable({ emitEvent: false });
            this.isDiscountBlocked = true;
            this.discountCheckMessage =
              isQuoteRequest
                ? 'Discount could not be applied. Your quote request will be sent without discount.'
                : 'Discount could not be applied. Booking will be created without discount.';

            submitRequest(retryPayload)
              .pipe(timeout(this.bookingSubmitTimeoutMs))
              .subscribe({
                next: (response) => {
                  this.handleBookingSubmitSuccess(response);
                },
                error: (retryError) => {
                  this.handleBookingSubmitError(retryError);
                }
              });
            return;
          }

          this.handleBookingSubmitError(error);
        }
      });
  }

  private validateBookingPayload(payload: any): boolean {
    const missing: string[] = [];
    const name = String(payload?.name ?? '').trim();
    const email = String(payload?.email ?? '').trim();
    const address = String(payload?.address ?? '').trim();
    const cleaningType = String(payload?.cleaningType ?? '').trim();
    const desiredDate = String(payload?.desiredDate ?? '').trim();
    const desiredTime = String(payload?.desiredTime ?? '').trim();

    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!address) missing.push('address');
    if (!cleaningType) missing.push('cleaningType');
    if (!desiredDate) missing.push('desiredDate');
    if (!desiredTime) missing.push('desiredTime');

    if (missing.length) {
      return false;
    }

    return true;
  }

  private reconcileDiscountFlagsFromPreview(finalPayload: any, previewResponse: any): void {
    const wantsDiscount = finalPayload?.applyFirstDiscount === true;
    if (!wantsDiscount) return;

    const eligible = previewResponse?.discountEligible === true;

    if (!eligible) {
      finalPayload.applyFirstDiscount = false;
      this.discountControl?.setValue(false, { emitEvent: false });
      this.discountControl?.disable({ emitEvent: false });
      this.isDiscountBlocked = true;
      this.discountCheckMessage =
        '⚠️ This address has already used the first-time discount';
    }
  }

  private stripUndefinedDeep(value: any): any {
    if (Array.isArray(value)) {
      return value.map((v) => this.stripUndefinedDeep(v)).filter((v) => v !== undefined);
    }
    if (!value || typeof value !== 'object') {
      return value === undefined ? undefined : value;
    }
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = this.stripUndefinedDeep(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }

  private buildPricePreviewPayload(finalPayload: any): any {
    const previewPayload: any = {
      cleaningType: finalPayload?.cleaningType,
      address: finalPayload?.address,
      frequency: finalPayload?.frequency,
      extras: finalPayload?.extras,
      petsAtHome: !!finalPayload?.petsAtHome,
      useOwnProducts: !!finalPayload?.useOwnProducts,
      usesOwnCleaningProducts: !!finalPayload?.useOwnProducts,
      firstServiceDiscountRequested: !!finalPayload?.firstServiceDiscountRequested,
      applyFirstDiscount: !!finalPayload?.applyFirstDiscount,
      dynamicFields:
        finalPayload?.dynamicFields && typeof finalPayload.dynamicFields === 'object'
          ? finalPayload.dynamicFields
          : undefined
    };

    if (typeof finalPayload?.lat === 'number') previewPayload.lat = finalPayload.lat;
    if (typeof finalPayload?.lng === 'number') previewPayload.lng = finalPayload.lng;
    if (typeof finalPayload?.bedrooms === 'number') previewPayload.bedrooms = finalPayload.bedrooms;
    if (typeof finalPayload?.bathrooms === 'number') previewPayload.bathrooms = finalPayload.bathrooms;
    if (typeof finalPayload?.additionalBedrooms === 'number') {
      previewPayload.additionalBedrooms = finalPayload.additionalBedrooms;
    }
    if (typeof finalPayload?.regularCleaningPackageId === 'string') {
      previewPayload.regularCleaningPackageId = finalPayload.regularCleaningPackageId;
    }
    if (typeof finalPayload?.specialServiceId === 'string') {
      previewPayload.specialServiceId = finalPayload.specialServiceId;
    }
    if (typeof finalPayload?.pricingModelVersion === 'string') {
      previewPayload.pricingModelVersion = finalPayload.pricingModelVersion;
    }
    if (typeof finalPayload?.moveMode === 'string') previewPayload.moveMode = finalPayload.moveMode;
    if (finalPayload?.postConstruction && typeof finalPayload.postConstruction === 'object') {
      previewPayload.postConstruction = finalPayload.postConstruction;
    }
    if (finalPayload?.windowCleaning && typeof finalPayload.windowCleaning === 'object') {
      previewPayload.windowCleaning = finalPayload.windowCleaning;
    }

    return previewPayload;
  }

  private applyPricePreviewToBookingPayload(
    finalPayload: any,
    previewResponse: any
  ): void {
    if (typeof previewResponse?.assignedZone === 'string') {
      finalPayload.assignedZone = previewResponse.assignedZone;
    }
    if (typeof previewResponse?.isBorderline === 'boolean') {
      finalPayload.isBorderline = previewResponse.isBorderline;
    }
    const distanceKm =
      typeof previewResponse?.assignedDistanceKm === 'number'
        ? previewResponse.assignedDistanceKm
        : typeof previewResponse?.distanceKm === 'number'
          ? previewResponse.distanceKm
          : null;
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      finalPayload.distanceKm = distanceKm;
    }
    if (typeof previewResponse?.distanceSurcharge === 'boolean') {
      finalPayload.distanceSurcharge = previewResponse.distanceSurcharge;
    }
  }

  private handleBookingSubmitSuccess(response: any): void {
    const bookingId = this.extractBookingId(response);
    const bookingStatus =
      (response as any)?.status ??
      (response as any)?.data?.status ??
      null;
    const discountApplied =
      typeof (response as any)?.discountApplied === 'boolean'
        ? (response as any).discountApplied
        : typeof (response as any)?.data?.applyFirstDiscount === 'boolean'
          ? (response as any).data.applyFirstDiscount
          : undefined;

    this.isSubmitting = false;
    this.submitSuccess = response.success;
    this.submittedBookingId = bookingId;
    this.submittedBookingStatus = bookingStatus;
    this.isPaymentReturnContext = false;
    this.isPaymentCancelContext = false;
    this.paymentStatusHint = '';
    this.paymentUiState = 'NONE';
    this.syncedBooking = null;
    this.paymentPollStop$.next();
    if (bookingId) {
      sessionStorage.setItem(this.bookingIdStorageKey, bookingId);
    }
    const baseStatusMessage = this.isPublicQuoteRequestMode
      ? this.publicQuoteSuccessMessage
      : this.getUserFriendlyStatusMessage(bookingStatus);
    const discountFeedback =
      discountApplied === true
        ? '🎉 Your first-time discount was applied successfully!'
        : discountApplied === false
          ? '⚠️ This address has already used the first-time discount.'
          : '';
    this.submitMessage = [baseStatusMessage, discountFeedback].filter(Boolean).join(' ');
    if (response.success) {
      if (this.isAdminManualBooking) {
        this.submitMessage = 'Booking created manually. No payment required yet.';
      }
      this.bookingForm.reset({
        frequency: 'one-time',
        petsAtHome: false,
        useOwnProducts: false
      });
      this.resetDiscountAvailabilityState();
      this.selectedService = null;
      this.estimatedPrice = 0;
      this.confirmSnapshot = null;
      this.isWaitingForConfirmation = this.isPublicQuoteRequestMode;
    }
  }

  private handleBookingSubmitError(error: unknown): void {
    this.isSubmitting = false;
    this.isWaitingForConfirmation = false;
    this.submitSuccess = false;
    this.submittedBookingId = null;
    this.submittedBookingStatus = null;
    if (error instanceof TimeoutError) {
      this.submitMessage = this.isPublicQuoteRequestMode
        ? 'The quote request took too long. Please try again.'
        : 'The booking request took too long. Please try again.';
      this.logger.error('Booking timeout', error);
      return;
    }
    const httpError = error instanceof HttpErrorResponse ? error : null;
    const status = httpError?.status;
    const backendMessage =
      typeof httpError?.error?.message === 'string'
        ? httpError.error.message
        : typeof httpError?.message === 'string'
          ? httpError.message
          : '';

    if (status === 409) {
      this.discountControl.setValue(false, { emitEvent: true });
      this.discountControl.disable({ emitEvent: false });
      this.isDiscountBlocked = true;
      this.discountCheckMessage = '⚠️ This address already used the first-time discount';
      this.submitMessage = backendMessage || 'This address has already used the first-time discount.';

      const bookingId = (httpError?.error as any)?.bookingId;
      if (typeof bookingId === 'string' && bookingId) {
        this.logger.warn('Booking conflict (409) bookingId', bookingId);
      } else {
        this.logger.warn('Booking conflict (409)', httpError);
      }

      this.markPricePreviewDirty();
      return;
    }

    this.submitMessage = backendMessage || (
      this.isPublicQuoteRequestMode
        ? 'Unable to submit your quote request right now. Please try again later.'
        : 'An error occurred. Please try again later.'
    );
    this.logger.error('Booking error', error);
  }

  startNewBooking(): void {
    this.submitSuccess = false;
    this.isWaitingForConfirmation = false;
    this.isRefreshingBookingStatus = false;
    this.submitMessage = '';
    this.submittedBookingId = null;
    this.submittedBookingStatus = null;
    this.isSubmitting = false;
    this.isConfirmModalOpen = false;
    this.confirmSnapshot = null;
    this.isPaymentReturnContext = false;
    this.isPaymentCancelContext = false;
    this.paymentStatusHint = '';
    this.paymentUiState = 'NONE';
    this.syncedBooking = null;
    this.paymentPollStop$.next();
    sessionStorage.removeItem(this.bookingIdStorageKey);

    this.selectedService = null;
    this.resetCoverageState();

    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup | null;
    if (dynamicGroup) {
      Object.keys(dynamicGroup.controls).forEach((key) => dynamicGroup.removeControl(key));
    }

    const extrasArray = this.bookingForm.get('extras') as FormArray | null;
    if (extrasArray) {
      while (extrasArray.length !== 0) extrasArray.removeAt(0);
    }

    this.bookingForm.reset({
      frequency: 'one-time',
      petsAtHome: false,
      useOwnProducts: false,
      applyFirstDiscount: false,
    });
    this.resetDiscountAvailabilityState();
    this.bookingForm.markAsPristine();
    this.bookingForm.markAsUntouched();
    this.bookingForm.updateValueAndValidity({ emitEvent: false });
    this.scrollToBookingForm();
  }

  openPaymentIfConfirmed(bookingId: string | null | undefined): void {
    void bookingId;
    return;
  }

  private getUserFriendlyStatusMessage(
    status: 'pending' | 'confirmed' | 'paid' | 'cancelled' | null | undefined
  ): string {
    if (this.isPublicQuoteRequestMode) {
      if (status === 'confirmed') return 'Your request is under review. We will contact you with the next steps.';
      if (status === 'paid') return 'Payment received successfully.';
      if (status === 'cancelled') return 'This quote request has been cancelled.';
      return this.publicQuoteSuccessMessage;
    }
    if (status === 'confirmed') return 'Confirmed. Ready for payment.';
    if (status === 'paid') return 'Paid. Booking completed.';
    if (status === 'cancelled') return 'Cancelled.';
    return 'Booking submitted successfully. Waiting for admin approval.';
  }

  private extractBookingId(response: unknown): string | null {
    const anyRes = response as any;
    const candidates = [
      anyRes?.data?._id,
      anyRes?.bookingId,
      anyRes?.data?.id,
      anyRes?._id,
      anyRes?.id
    ];

    for (const c of candidates) {
      const value = String(c ?? '').trim();
      if (value) return value;
    }
    return null;
  }

  getStatusLabel(status: 'pending' | 'confirmed' | 'paid' | 'cancelled' | null | undefined): string {
    if (this.isPublicQuoteRequestMode) {
      if (status === 'pending') return 'Quote request received';
      if (status === 'confirmed') return 'Request under review';
      if (status === 'paid') return 'Payment received';
      if (status === 'cancelled') return 'Request cancelled';
      return '';
    }
    if (status === 'pending') return '⏳ Pending confirmation';
    if (status === 'confirmed') return '✅ Confirmed';
    if (status === 'paid') return '💳 Paid';
    if (status === 'cancelled') return '❌ Cancelled';
    return '';
  }

  trackByExtraId(_: number, item: ExtraCatalogItemUi): string {
    return item.id;
  }

  trackByServiceSlug(_: number, item: CleaningService): string {
    return item.slug;
  }

  private buildSanitizedBookingData(): any {
    const raw = this.bookingForm.getRawValue();
    return this.sanitizeBookingPayload(raw);
  }

  private sanitizeBookingPayload(raw: any): any {
    const cleaningType = sanitizeText(raw?.cleaningType, { maxLength: 60 });
    const phone = sanitizeText(raw?.phone, { maxLength: 20 });
    const frequency = sanitizeText(raw?.frequency, { maxLength: 40 }) || 'one-time';
    const df = raw?.dynamicFields && typeof raw.dynamicFields === 'object' ? raw.dynamicFields : {};

    this.syncV2RegularSelection();
    const regularPkg = this.getV2RegularPackage();
    if (!regularPkg) {
      return null;
    }
    const specialId = this.getV2SelectedSpecialServiceId();
    const addBeds = this.getV2AdditionalBedrooms();

    const extrasPayload: any[] = [];
    for (const extraDef of this.optionalExtrasV2) {
      if (!this.v2SelectedExtrasSet.has(extraDef.id)) continue;
      if (extraDef.kind === 'qty') {
        const q = this.toInt(
          this.v2ExtrasQty[extraDef.id] ?? df['v2_qty_' + extraDef.id],
          extraDef.minQuantity ?? 1,
          extraDef.maxQuantity ?? 9999,
          extraDef.minQuantity ?? 1
        );
        extrasPayload.push({ type: extraDef.id, quantity: q });
      } else {
        extrasPayload.push({ type: extraDef.id });
      }
    }

    const dynamicFields = {
      pricingModelVersion: 'V2' as PricingModelVersion,
      regularPackageId: regularPkg.id,
      specialServiceId: specialId ?? undefined,
      additionalBedroomsV2: addBeds,
      bedrooms: regularPkg.bedrooms + addBeds,
      bathrooms: regularPkg.bathrooms,
      additionalBedrooms: addBeds,
    };
    const v2Fields = {
      pricingModelVersion: 'V2' as PricingModelVersion,
      regularCleaningPackageId: regularPkg.id,
      specialServiceId: specialId ?? undefined,
    };

    const petsBool = !!raw?.petsAtHome;
    const ownProductsBool = !!raw?.useOwnProducts;
    const discountRequestedBool = !!raw?.applyFirstDiscount;
    const petNotes = String(raw?.petSafetyNotes ?? '').trim();
    const productNotes = String(raw?.cleaningProductNotes ?? '').trim();

    const payload: any = {
      name: sanitizeText(raw?.name, { maxLength: 60 }),
      email: sanitizeEmail(raw?.email, { maxLength: 254 }),
      address: sanitizeAddress(raw?.address, { maxLength: 160 }),
      cleaningType,
      desiredDate: sanitizeText(raw?.desiredDate, { maxLength: 20 }),
      desiredTime: sanitizeText(raw?.desiredTime, { maxLength: 10 }),
      petsAtHome: petsBool,
      useOwnProducts: ownProductsBool,
      usesOwnCleaningProducts: ownProductsBool,
      firstServiceDiscountRequested: discountRequestedBool,
      applyFirstDiscount: discountRequestedBool,
      frequency,
      extras: extrasPayload,
      dynamicFields,
      ...v2Fields,
    };
    if (petsBool && petNotes.length > 0) payload.petSafetyNotes = petNotes;
    if (ownProductsBool && productNotes.length > 0) payload.cleaningProductNotes = productNotes;

    const safeAddressValue = String(payload.address ?? '').trim();
    if (this.selectedCoords && safeAddressValue.length >= 10) {
      payload.lat = this.selectedCoords.lat;
      payload.lng = this.selectedCoords.lng;
    }

    if (phone) {
      payload.phone = phone;
    }

    if (dynamicFields && typeof dynamicFields === 'object') {
      if (typeof dynamicFields.bedrooms === 'number') payload.bedrooms = dynamicFields.bedrooms;
      if (typeof dynamicFields.bathrooms === 'number') payload.bathrooms = dynamicFields.bathrooms;
      if (typeof dynamicFields.additionalBedrooms === 'number') {
        payload.additionalBedrooms = dynamicFields.additionalBedrooms;
      }
    }

    return payload;
  }

  private toInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (!Number.isFinite(n)) return fallback;
    const i = Math.trunc(n);
    return Math.max(min, Math.min(max, i));
  }

  private syncFormControlDisabledStates(): void {
    if (!this.bookingForm) return;

    const shouldDisableForCoverage =
      this.hasVerifiedCoverage &&
      this.coverageStatus === 'outside' &&
      !this.isCheckingCoverage &&
      !this.isPricePreviewUnavailable;
    const dynamicGroup = this.bookingForm.get('dynamicFields');

    const coverageControlled = [
      'cleaningType',
      'desiredDate',
      'desiredTime',
      'petsAtHome',
      'useOwnProducts',
      'frequency'
    ];

    for (const name of coverageControlled) {
      const control = this.bookingForm.get(name);
      if (!control) continue;
      if (shouldDisableForCoverage) {
        if (!control.disabled) control.disable({ emitEvent: false });
      } else {
        if (control.disabled) control.enable({ emitEvent: false });
      }
    }

    if (dynamicGroup) {
      if (shouldDisableForCoverage) {
        if (!dynamicGroup.disabled) dynamicGroup.disable({ emitEvent: false });
      } else {
        if (dynamicGroup.disabled) dynamicGroup.enable({ emitEvent: false });
      }
    }

    const discountControl = this.bookingForm.get('applyFirstDiscount');
    if (discountControl) {
      const shouldDisableDiscount =
        shouldDisableForCoverage || this.isDiscountBlocked || this.isCheckingDiscount;
      if (shouldDisableDiscount) {
        if (!discountControl.disabled) discountControl.disable({ emitEvent: false });
      } else {
        if (discountControl.disabled) discountControl.enable({ emitEvent: false });
      }
    }
  }

  private buildConfirmationSnapshot(): any {
    const raw = this.bookingForm.getRawValue();
    const extrasPretty: string[] = [];
    const details: Array<{ label: string; value: string }> = [];
    const df = raw?.dynamicFields ?? {};

    this.syncV2RegularSelection();
    const regularPkg = this.getV2RegularPackage();
    if (!regularPkg) {
      return null;
    }
    const specialId = this.getV2SelectedSpecialServiceId();
    const addBeds = this.getV2AdditionalBedrooms();

    let serviceTitle = 'Regular Cleaning';
    if (specialId) {
      serviceTitle += ' + ' + getDisplaySpecialServiceLabelV2(specialId);
    }

    details.push({
      label: 'Base Package',
      value: getDisplayRegularPackageLabelV2(regularPkg.bedrooms, regularPkg.bathrooms) + ` ($${regularPkg.basePrice})`,
    });
    details.push({
      label: 'Additional Bedrooms',
      value: `${addBeds} × $${this.v2ExtraBedroomPrice} = $${addBeds * this.v2ExtraBedroomPrice}`,
    });
    details.push({ label: 'Total Bedrooms', value: String(regularPkg.bedrooms + addBeds) });
    details.push({ label: 'Bathrooms', value: String(regularPkg.bathrooms) });
    if (specialId) {
      const ss = this.specialServicesV2.find(s => s.id === specialId);
      if (ss) {
        details.push({
          label: 'Special Service',
          value: ss.label + ` (+$${ss.flatFee})`,
        });
      }
    }

    for (const extraDef of this.optionalExtrasV2) {
      if (!this.v2SelectedExtrasSet.has(extraDef.id)) continue;
      if (extraDef.kind === 'qty') {
        const q = this.toInt(
          this.v2ExtrasQty[extraDef.id] ?? df['v2_qty_' + extraDef.id],
          extraDef.minQuantity ?? 1,
          extraDef.maxQuantity ?? 9999,
          extraDef.minQuantity ?? 1
        );
        const unitLabel = extraDef.unitLabel ?? 'units';
        extrasPretty.push(`${getDisplayExtraLabelV2(extraDef.id)} (${q} ${unitLabel} × $${extraDef.unitPrice} = $${q * extraDef.unitPrice})`);
      } else {
        extrasPretty.push(`${getDisplayExtraLabelV2(extraDef.id)} ($${extraDef.unitPrice})`);
      }
    }

    const petsBool = !!raw?.petsAtHome;
    const ownProductsBool = !!raw?.useOwnProducts;
    const discountCustomerRequestedBool = !!raw?.applyFirstDiscount;
    const petNotes = String(raw?.petSafetyNotes ?? '').trim();
    const productNotes = String(raw?.cleaningProductNotes ?? '').trim();

    const isAdminActuallyApplied = (this.pricePreviewResult as any)?.discountApplied === true;
    const appliedDiscountPercent = isAdminActuallyApplied ? (this.discountPercent || 15) : 0;
    const appliedDiscountAmount = isAdminActuallyApplied ? (this.discountAmount || 0) : 0;

    const finiteNumber = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const preview: any = this.pricePreviewResult ?? null;

    const estimatedPrice =
      finiteNumber(preview?.estimatedPrice) ??
      finiteNumber(preview?.pricing?.estimatedPrice) ??
      finiteNumber(this.estimatedPrice) ??
      finiteNumber(this.finalPrice) ??
      finiteNumber(this.getV2LocalEstimatedPrice()) ??
      0;

    const finalPrice =
      finiteNumber(preview?.finalPrice) ??
      finiteNumber(preview?.pricing?.finalPrice) ??
      finiteNumber(this.finalPrice) ??
      finiteNumber(this.estimatedPrice) ??
      finiteNumber(this.getV2LocalEstimatedPrice()) ??
      0;

    const borderlineFee =
      finiteNumber(preview?.fees?.borderlineFee) ??
      finiteNumber(preview?.breakdown?.borderlineFee) ??
      finiteNumber(preview?.borderlineFee) ??
      finiteNumber(this.borderlineFeeV2) ??
      0;

    const itemsRawFinite =
      Array.isArray(preview?.breakdown?.items) ? preview.breakdown.items :
      Array.isArray(preview?.items) ? preview.items :
      this.pricingItems;
    const pricingItems = Array.isArray(itemsRawFinite)
      ? itemsRawFinite.filter((x: any) => x && typeof x === 'object')
      : [];

    const distanceFee = borderlineFee > 0
      ? borderlineFee
      : (finiteNumber(preview?.fees?.distanceFee) ??
         finiteNumber(preview?.distanceFee) ??
         finiteNumber(this.distanceFee) ??
         0);

    const distanceSurchargeApplied = borderlineFee > 0 || distanceFee > 0;

    return {
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      address: raw?.address ?? '',
      serviceTitle,
      desiredDate: raw?.desiredDate ?? '',
      desiredTime: raw?.desiredTime ?? '',
      petsAtHome: petsBool,
      petSafetyNotes: petsBool && petNotes.length > 0 ? petNotes : undefined,
      useOwnProducts: ownProductsBool,
      usesOwnCleaningProducts: ownProductsBool,
      cleaningProductNotes: ownProductsBool && productNotes.length > 0 ? productNotes : undefined,
      details,
      extras: extrasPretty,
      firstServiceDiscountRequested: discountCustomerRequestedBool,
      discountApplied: isAdminActuallyApplied,
      discountPercent: appliedDiscountPercent,
      discountAmount: appliedDiscountAmount,
      distanceSurchargeApplied,
      distanceFee,
      borderlineFee,
      pricingItems,
      estimatedPrice,
      finalPrice
    };
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.bookingForm.get(fieldName);
    const dynamicField = this.bookingForm.get('dynamicFields.' + fieldName);
    const targetField = field || dynamicField;
    return !!(targetField && targetField.invalid && (targetField.dirty || targetField.touched));
  }
}

function businessHoursTimeValidator(startTime: string, endTime: string): ValidatorFn {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;

    const minutes = parseTimeToMinutes(value);
    if (minutes === null || startMinutes === null || endMinutes === null) {
      return { outsideBusinessHours: true };
    }

    if (minutes < startMinutes || minutes > endMinutes) {
      return { outsideBusinessHours: true };
    }

    return null;
  };
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function allowedTimeSlotsValidator(allowed: readonly string[]): ValidatorFn {
  const allowedSet = new Set(allowed);
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return allowedSet.has(value) ? null : { invalidTimeSlot: true };
  };
}

function noPastDatesValidator(getMinDate: () => string, getMaxDate: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { invalidDateFormat: true };
    }

    const selected = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(selected.getTime())) {
      return { invalidDateFormat: true };
    }

    const min = String(getMinDate() ?? '').trim();
    const max = String(getMaxDate() ?? '').trim();
    if (min && value < min) return { pastDate: true };
    if (max && value > max) return { dateTooFar: true };
    return null;
  };
}
