import { Component, OnInit, OnDestroy } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, merge, of, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingService } from '../../core/services/booking.service';
import { ServiceDataService } from '../../core/services/service-data.service';
import { APARTMENT_PACKAGES, DEEP_PACKAGES, EXTRAS_CATALOG, EXTRA_ALIASES, ExtraCatalogItem, MOVE_IN_PACKAGES, MOVE_OUT_PACKAGES, STANDARD_PACKAGES } from '../../core/services/pricing.service';
import { CleaningService } from '../../core/models/service.model';
import { LocationResult } from '../../core/models/location.model';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { AuthService } from '../../core/services/auth.service';
import { sanitizeAddress, sanitizeEmail, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';

import { GeolocationService } from '../../core/services/geolocation.service';

type PaymentUiState = 'NONE' | 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED';

@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit, OnDestroy {
  bookingForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitMessage = '';
  submittedBookingStatus: 'pending' | 'confirmed' | 'paid' | 'cancelled' | null = null;
  submittedBookingId: string | null = null;
  isWaitingForConfirmation = false;
  isRefreshingBookingStatus = false;
  isAdminManualBooking = false;
  isPaymentReturnContext = false;
  isPaymentCancelContext = false;
  paymentStatusHint = '';
  paymentUiState: PaymentUiState = 'NONE';
  syncedBooking: any = null;
  isConfirmModalOpen = false;
  confirmSnapshot: any = null;
  
  selectedService: CleaningService | null = null;
  estimatedPrice: number | 'custom' = 0;
  availableServices: CleaningService[] = [];
  
  // Frontend pricing placeholders
  basePrice = 0;
  extrasPrice = 0;
  borderlineFee = 0; // $20 when borderline
  firstServiceDiscount = 0; // 15% placeholder when applied
  finalPrice = 0;
  
  // Geolocation properties
  isCheckingCoverage = false;
  coverageStatus: 'inside' | 'borderline' | 'outside' = 'outside';
  isExtraCharge = false;
  assignedDistance = 0;
  coverageMessage = '';
  coverageCity = '';
  coverageCitiesList: string[] = [];
  isCheckingDiscount = false;
  isDiscountBlocked = false;
  discountCheckMessage = '';

  private destroy$ = new Subject<void>();
  private serviceChange$ = new Subject<void>();
  private discountCheckRequestId = 0;
  private lastCheckedDiscountEmail = '';
  private currentLocationRequestId = 0;
  private currentPricePreviewRequestId = 0;
  private lastStatusRefreshBookingId: string | null = null;
  private readonly bookingIdStorageKey = 'zcleanup_last_booking_id';
  private readonly paymentPollStop$ = new Subject<void>();

  emailControl!: FormControl;
  discountControl!: FormControl;
  desiredTimeControl!: FormControl;
  petsAtHomeControl!: FormControl;
  useOwnProductsControl!: FormControl;

  standardPackages = STANDARD_PACKAGES;
  apartmentPackages = APARTMENT_PACKAGES;
  deepPackages = DEEP_PACKAGES;
  moveOutPackages = MOVE_OUT_PACKAGES;
  moveInPackages = MOVE_IN_PACKAGES;
  extrasCatalog: ExtraCatalogItem[] = EXTRAS_CATALOG;
  readonly allowedTimes = [
    '08:00', '08:30',
    '09:00', '09:30',
    '10:00', '10:30',
    '11:00', '11:30',
    '12:00', '12:30',
    '13:00', '13:30',
    '14:00', '14:30',
    '15:00', '15:30',
    '16:00', '16:30',
    '17:00', '17:30',
    '18:00', '18:30',
    '19:00', '19:30',
    '20:00'
  ];
  minBookingDate = this.formatDate(new Date());
  maxBookingDate = this.formatDate(this.addYears(new Date(), 1));

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

  ngOnInit(): void {
    this.isAdminManualBooking = this.getAncestorRouteDataFlag('isAdminManualBooking');
    const std = this.serviceData.getServiceBySlug('standard-cleaning') || null;
    this.availableServices = this.serviceData.getEnabledServices();
    this.coverageCitiesList = this.geolocationService.getCoverageCities();
    this.initForm();
    this.selectedService = std;
    if (std) {
      this.bookingForm.patchValue({ cleaningType: std.slug }, { emitEvent: false });
      this.setupStandardCleaningFields();
      this.subscribeDynamicFieldsPricing();
      this.updatePrice();
    }
    
    this.bookingForm.get('address')?.valueChanges
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((address) => {
          const value = String(address ?? '');
          if (!value || value.length < 10) {
            this.resetCoverageState();
            return of({ address: value, result: null as LocationResult | null });
          }

          this.isCheckingCoverage = true;
          this.coverageMessage = 'Verifying your address...';
          this.syncFormControlDisabledStates();
          return this.geolocationService.geocodeAddress(value).pipe(
            catchError(() => of(null)),
            map((result) => ({ address: value, result }))
          );
        })
      )
      .subscribe(({ address, result }) => {
        this.applyCoverageFromGeocode(address, result);
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
        const today = this.startOfDay(new Date());
        const selected = this.parseIsoDate(value);
        if (!selected) return;
        if (selected.getTime() < today.getTime()) {
          this.bookingForm.get('desiredDate')?.setValue(this.minBookingDate, { emitEvent: false });
        }
      });

    this.subscribeSharedPricingControls();

    this.checkQueryParams();
    this.syncFormControlDisabledStates();
  }

  private resetCoverageState(): void {
    this.isCheckingCoverage = false;
    this.coverageStatus = 'outside';
    this.isExtraCharge = false;
    this.assignedDistance = 0;
    this.coverageCity = '';
    this.coverageMessage = '';
    this.syncFormControlDisabledStates();
    this.updatePrice();
  }

  private applyCoverageFromGeocode(inputAddress: string, result: LocationResult | null): void {
    const value = String(inputAddress ?? '');
    if (!value || value.length < 10) return;

    this.isCheckingCoverage = false;
    if (!result) {
      this.coverageStatus = 'outside';
      this.coverageMessage = "We couldn't verify this address. Please ensure it's correct and located in Florida.";
      this.isExtraCharge = false;
      this.assignedDistance = 0;
      this.coverageCity = '';
      this.syncFormControlDisabledStates();
      this.updatePrice();
      return;
    }

    this.bookingForm.patchValue({ address: result.address }, { emitEvent: false });

    const coverage = this.geolocationService.isWithinCoverage(result.lat, result.lng);
    this.coverageStatus = coverage.status;
    this.isExtraCharge = coverage.isExtraCharge;
    this.assignedDistance = coverage.distance || 0;

    if (coverage.status !== 'outside') {
      this.coverageCity = coverage.city || '';
      if (coverage.isExtraCharge) {
        this.coverageMessage = `Great news! We cover ${coverage.city} (${this.assignedDistance}km from center). Note: A $20 distance surcharge applies to this borderline area.`;
      } else {
        this.coverageMessage = `Great news! We cover ${coverage.city} (${this.assignedDistance}km from center).`;
      }
      this.syncFormControlDisabledStates();
      this.updatePrice();
      return;
    }

    this.coverageMessage = 'Sorry, we currently do not serve your location.';
    this.syncFormControlDisabledStates();
    this.updatePrice();
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
          
          // First check coverage
          const coverage = this.geolocationService.isWithinCoverage(lat, lng);
          this.coverageStatus = coverage.status;
          this.isExtraCharge = coverage.isExtraCharge;
          this.assignedDistance = coverage.distance || 0;
          this.syncFormControlDisabledStates();
          
          if (coverage.status !== 'outside') {
            this.coverageCity = coverage.city || '';
            if (coverage.isExtraCharge) {
              this.coverageMessage = `Great news! Your location in ${coverage.city} is covered (${this.assignedDistance}km from center). Note: A $20 distance surcharge applies to this borderline area.`;
            } else {
              this.coverageMessage = `Great news! Your location in ${coverage.city} is covered (${this.assignedDistance}km from center).`;
            }
            this.updatePrice();
            
            // Reverse geocode to get a real address
            this.geolocationService.reverseGeocode(lat, lng).subscribe(address => {
              if (requestId !== this.currentLocationRequestId) return;
              this.isCheckingCoverage = false;
              this.syncFormControlDisabledStates();
              const currentAddress = String(this.bookingForm.get('address')?.value ?? '');
              if (currentAddress !== addressBefore) return;
              if (address) {
                this.bookingForm.patchValue({ address: address }, { emitEvent: false });
              } else {
                this.bookingForm.patchValue({ address: `Current Location (${coverage.city})` }, { emitEvent: false });
              }
            });
          } else {
            this.isCheckingCoverage = false;
            this.coverageMessage = "Sorry, we currently do not serve your location.";
            this.coverageCity = '';
            this.isExtraCharge = false;
            this.assignedDistance = 0;
            this.syncFormControlDisabledStates();
            this.updatePrice();
          }
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
        businessHoursTimeValidator('08:00', '20:00'),
        allowedTimeSlotsValidator(this.allowedTimes)
      ]],
      petsAtHome: [false],
      useOwnProducts: [false],
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
  }

  private formatDate(date: Date): string {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
    return this.startOfDay(d);
  }

  onServiceChange(slug: string): void {
    this.selectedService = this.serviceData.getServiceBySlug(slug) || null;
    this.serviceChange$.next();
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    
    // Clear existing dynamic fields
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    
    // Clear extras
    const extrasArray = this.bookingForm.get('extras') as FormArray;
    while (extrasArray.length !== 0) extrasArray.removeAt(0);

    if (this.selectedService && this.selectedService.slug === 'standard-cleaning') {
      this.setupStandardCleaningFields();
    } else if (this.selectedService && this.selectedService.slug === 'apartment-cleaning') {
      this.setupApartmentCleaningFields();
    } else if (this.selectedService && this.selectedService.slug === 'deep-cleaning') {
      this.setupDeepCleaningFields();
    } else if (this.selectedService && this.selectedService.slug === 'move-in-move-out') {
      this.setupMoveInOutFields();
    } else if (this.selectedService && this.selectedService.slug === 'post-construction-cleaning') {
      this.setupPostConstructionFields();
    } else if (this.selectedService && this.selectedService.slug === 'window-cleaning') {
      this.setupWindowCleaningFields();
    }
    
    this.subscribeDynamicFieldsPricing();
    this.updatePrice();
  }

  private setupStandardCleaningFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('stdPackage', new FormControl('1-1', [Validators.required]));
    dynamicGroup.addControl('extraBedrooms', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('bedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('bathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    this.ensureCommonDynamicFields(dynamicGroup);

    this.syncStandardSelection();
    dynamicGroup.get('stdPackage')?.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => {
        this.syncStandardSelection();
      });
    dynamicGroup.get('extraBedrooms')?.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => {
        this.syncStandardSelection();
      });
  }

  private setupApartmentCleaningFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('aptPackage', new FormControl('1-1', [Validators.required]));
    dynamicGroup.addControl('aptExtraBedrooms', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('bedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('bathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    this.ensureCommonDynamicFields(dynamicGroup);
    this.syncApartmentSelection();
    dynamicGroup.get('aptPackage')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncApartmentSelection();
    });
    dynamicGroup.get('aptExtraBedrooms')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncApartmentSelection();
    });
  }

  private syncApartmentSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgId = String(dynamicGroup.get('aptPackage')?.value || '1-1');
    const pkg = this.apartmentPackages.find(p => p.id === pkgId) || this.apartmentPackages[0];
    const extra = Number(dynamicGroup.get('aptExtraBedrooms')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));
    dynamicGroup.patchValue({
      bedrooms: pkg.bedrooms + extraBedrooms,
      bathrooms: pkg.bathrooms
    }, { emitEvent: false });
  }

  private setupDeepCleaningFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('deepPackage', new FormControl('1-1', [Validators.required]));
    dynamicGroup.addControl('deepExtraBedrooms', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('bedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('bathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    this.ensureCommonDynamicFields(dynamicGroup);
    this.syncDeepSelection();
    dynamicGroup.get('deepPackage')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncDeepSelection();
    });
    dynamicGroup.get('deepExtraBedrooms')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncDeepSelection();
    });
  }

  private syncDeepSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgId = String(dynamicGroup.get('deepPackage')?.value || '1-1');
    const pkg = this.deepPackages.find(p => p.id === pkgId) || this.deepPackages[0];
    const extra = Number(dynamicGroup.get('deepExtraBedrooms')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));
    dynamicGroup.patchValue({
      bedrooms: pkg.bedrooms + extraBedrooms,
      bathrooms: pkg.bathrooms
    }, { emitEvent: false });
  }

  private setupMoveInOutFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('moveMode', new FormControl('move_out', [Validators.required]));
    dynamicGroup.addControl('moPackage', new FormControl('1-1'));
    dynamicGroup.addControl('miPackage', new FormControl('1-1'));
    dynamicGroup.addControl('moveOutExtraBedrooms', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('moveInExtraBedrooms', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(10)]));
    dynamicGroup.addControl('moveOutBedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('moveOutBathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    dynamicGroup.addControl('moveInBedrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(14)]));
    dynamicGroup.addControl('moveInBathrooms', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(10)]));
    dynamicGroup.addControl('bedrooms', new FormControl(1));
    dynamicGroup.addControl('bathrooms', new FormControl(1));
    this.ensureCommonDynamicFields(dynamicGroup);
    this.syncMoveOutSelection();
    this.syncMoveInSelection();
    dynamicGroup.get('moveMode')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
    });
    dynamicGroup.get('moPackage')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncMoveOutSelection();
    });
    dynamicGroup.get('miPackage')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncMoveInSelection();
    });
    dynamicGroup.get('moveOutExtraBedrooms')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncMoveOutSelection();
    });
    dynamicGroup.get('moveInExtraBedrooms')?.valueChanges.pipe(takeUntil(merge(this.destroy$, this.serviceChange$))).subscribe(() => {
      this.syncMoveInSelection();
    });
  }

  private syncMoveOutSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgId = String(dynamicGroup.get('moPackage')?.value || '1-1');
    const pkg = this.moveOutPackages.find(p => p.id === pkgId) || this.moveOutPackages[0];
    const extra = Number(dynamicGroup.get('moveOutExtraBedrooms')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));
    dynamicGroup.patchValue({
      moveOutBedrooms: pkg.bedrooms + extraBedrooms,
      moveOutBathrooms: pkg.bathrooms
    }, { emitEvent: false });
  }

  private syncMoveInSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgId = String(dynamicGroup.get('miPackage')?.value || '1-1');
    const pkg = this.moveInPackages.find(p => p.id === pkgId) || this.moveInPackages[0];
    const extra = Number(dynamicGroup.get('moveInExtraBedrooms')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));
    dynamicGroup.patchValue({
      moveInBedrooms: pkg.bedrooms + extraBedrooms,
      moveInBathrooms: pkg.bathrooms
    }, { emitEvent: false });
  }

  private setupPostConstructionFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('hours', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(200)]));
    dynamicGroup.addControl('cleaners', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(3)]));
    this.ensureCommonDynamicFields(dynamicGroup);
  }

  private setupWindowCleaningFields(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    dynamicGroup.addControl('units', new FormControl(0, [Validators.required, Validators.min(0), Validators.max(5000)]));
    this.ensureCommonDynamicFields(dynamicGroup);
  }

  private ensureCommonDynamicFields(dynamicGroup: FormGroup): void {
    if (!dynamicGroup.get('windowsQuantity')) {
      dynamicGroup.addControl('windowsQuantity', new FormControl(1, [Validators.min(1), Validators.max(5000)]));
    }
    if (!dynamicGroup.get('laundryLoads')) {
      dynamicGroup.addControl('laundryLoads', new FormControl(1, [Validators.min(0), Validators.max(2)]));
    }
  }

  private syncStandardSelection(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup;
    const pkgId = String(dynamicGroup.get('stdPackage')?.value || '1-1');
    const pkg = this.standardPackages.find(p => p.id === pkgId) || this.standardPackages[0];
    const extra = Number(dynamicGroup.get('extraBedrooms')?.value) || 0;
    const extraBedrooms = Math.max(0, Math.min(extra, 10));

    dynamicGroup.patchValue({
      bedrooms: pkg.bedrooms + extraBedrooms,
      bathrooms: pkg.bathrooms
    }, { emitEvent: false });
  }

  get standardPackageBedrooms(): number {
    const pkgId = String((this.bookingForm.get('dynamicFields.stdPackage')?.value) || '1-1');
    const pkg = this.standardPackages.find(p => p.id === pkgId) || this.standardPackages[0];
    return pkg.bedrooms;
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
    this.updatePrice();
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
        this.updatePrice();
      });

    this.discountControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePrice();
      });
  }

  private subscribeDynamicFieldsPricing(): void {
    const dynamicGroup = this.bookingForm.get('dynamicFields') as FormGroup | null;
    if (!dynamicGroup) return;

    dynamicGroup.valueChanges
      .pipe(takeUntil(merge(this.destroy$, this.serviceChange$)))
      .subscribe(() => {
        this.updatePrice();
      });
  }

  updatePrice(): void {
    if (!this.selectedService) {
      this.estimatedPrice = 0;
      this.basePrice = 0;
      this.extrasPrice = 0;
      this.borderlineFee = 0;
      this.firstServiceDiscount = 0;
      this.finalPrice = 0;
      return;
    }

    const applyDiscount = !!this.bookingForm.get('applyFirstDiscount')?.value;

    const cleaningType = this.selectedService.slug;
    const dynamicFieldsRaw =
      (this.bookingForm.get('dynamicFields') as FormGroup | null)?.getRawValue() ?? {};

    const rawExtras: unknown[] = Array.isArray(this.bookingForm.get('extras')?.value)
      ? (this.bookingForm.get('extras')?.value as unknown[])
      : [];
    const normalizedExtras = Array.from(
      new Set(
        rawExtras
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .map((x) => String(EXTRA_ALIASES[x] ?? x))
      )
    );

    const sanitizedDynamicFields: any = this.sanitizeDynamicFields(
      cleaningType,
      dynamicFieldsRaw,
      normalizedExtras
    );

    const windowsQuantity = this.toInt(dynamicFieldsRaw?.windowsQuantity, 1, 5000, 1);
    const laundryLoads = this.toInt(dynamicFieldsRaw?.laundryLoads, 1, 2, 1);

    const extrasPayload: any[] = normalizedExtras
      .map((e) => {
        const id = String(e ?? '').trim();
        if (!id) return null;
        if (id === 'windows_exterior') return { type: 'outside_windows', quantity: windowsQuantity };
        if (id === 'laundry') return { type: 'laundry', quantity: laundryLoads };
        if (id === 'heavy_buildup') return 'heavy';
        if (id === 'organize_clothes') return 'organize';
        return id;
      })
      .filter((x) => x !== null);

    const payload: any = {
      cleaningType,
      address: this.bookingForm.get('address')?.value,
      frequency: this.bookingForm.get('frequency')?.value,
      extras: extrasPayload,
      petsAtHome: !!this.bookingForm.get('petsAtHome')?.value,
      distanceSurcharge: !!this.isExtraCharge,
      applyFirstDiscount: applyDiscount,
      dynamicFields: sanitizedDynamicFields
    };

    if (typeof sanitizedDynamicFields?.bedrooms === 'number') payload.bedrooms = sanitizedDynamicFields.bedrooms;
    if (typeof sanitizedDynamicFields?.bathrooms === 'number') payload.bathrooms = sanitizedDynamicFields.bathrooms;
    if (typeof sanitizedDynamicFields?.additionalBedrooms === 'number') {
      payload.additionalBedrooms = sanitizedDynamicFields.additionalBedrooms;
    }
    if (typeof sanitizedDynamicFields?.moveMode === 'string') payload.moveMode = sanitizedDynamicFields.moveMode;
    if (sanitizedDynamicFields?.postConstruction && typeof sanitizedDynamicFields.postConstruction === 'object') {
      payload.postConstruction = sanitizedDynamicFields.postConstruction;
    }
    if (sanitizedDynamicFields?.windowCleaning && typeof sanitizedDynamicFields.windowCleaning === 'object') {
      payload.windowCleaning = sanitizedDynamicFields.windowCleaning;
    }

    const requestId = ++this.currentPricePreviewRequestId;
    this.bookingService.pricePreview(payload).subscribe({
      next: (res) => {
        if (requestId !== this.currentPricePreviewRequestId) return;
        const estimatedPrice = Number(res?.estimatedPrice);
        const finalPricePreview = Number(res?.finalPricePreview);
        const discountAmount = Number(res?.discountAmount);
        const extrasTotal = Number(res?.extrasTotal);
        const petsFee = Number(res?.petsFee);
        const distanceFee = Number(res?.distanceFee);

        if (!Number.isFinite(estimatedPrice) || !Number.isFinite(finalPricePreview)) {
          this.basePrice = 0;
          this.extrasPrice = 0;
          this.borderlineFee = 0;
          this.firstServiceDiscount = 0;
          this.finalPrice = 0;
          this.estimatedPrice = 0;
          return;
        }

        this.basePrice = estimatedPrice;
        this.extrasPrice =
          Number.isFinite(extrasTotal) && Number.isFinite(petsFee)
            ? extrasTotal + petsFee
            : 0;
        this.borderlineFee = Number.isFinite(distanceFee) ? distanceFee : 0;
        this.firstServiceDiscount = Number.isFinite(discountAmount) ? discountAmount : 0;
        this.finalPrice = finalPricePreview;
        this.estimatedPrice = Math.round(this.basePrice + this.borderlineFee);
      },
      error: () => {
        if (requestId !== this.currentPricePreviewRequestId) return;
        this.basePrice = 0;
        this.extrasPrice = 0;
        this.borderlineFee = 0;
        this.firstServiceDiscount = 0;
        this.finalPrice = 0;
        this.estimatedPrice = 0;
      }
    });
  }

  checkQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const serviceSlug = String(params['service'] ?? '').trim();
        const serviceName = String(params['serviceName'] ?? '').trim();
        const promo = String(params['promo'] ?? '').trim();
        const discountParam = String(params['discount'] ?? '').trim();
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

        const canSyncBookingStatus =
          this.isAdminManualBooking ||
          (this.auth.hasValidToken() && this.auth.isAdminOrSupervisor());

        const storedBookingId =
          canSyncBookingStatus && !bookingIdParam
            ? String(sessionStorage.getItem(this.bookingIdStorageKey) ?? '').trim()
            : '';
        const effectiveBookingId = bookingIdParam || storedBookingId;

        if (canSyncBookingStatus && effectiveBookingId && effectiveBookingId !== this.lastStatusRefreshBookingId) {
          this.refreshBookingStatus(effectiveBookingId, isPaymentReturn || isPaymentContextFromPath, isPaymentCancel);
        } else if (!effectiveBookingId && (isPaymentReturn || isPaymentContextFromPath)) {
          this.isPaymentReturnContext = true;
          this.isPaymentCancelContext = isPaymentCancel;
          this.paymentUiState = isPaymentCancel ? 'PAYMENT_FAILED' : 'PENDING_PAYMENT';
          this.paymentStatusHint = isPaymentCancel ? 'Payment cancelled.' : 'Payment pending confirmation.';
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

  onEmailBlur(): void {
    return;
  }

  private validateDiscountAvailability(rawEmail: unknown, forceCheck: boolean = false): void {
    void rawEmail;
    void forceCheck;
    return;
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
    if (this.coverageStatus === 'outside') {
      this.coverageMessage = 'Service is not available in your area.';
      this.bookingForm.markAllAsTouched();
      return;
    }

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
    document.body.style.overflow = 'auto';
  }

  confirmAndSubmit(): void {
    if (this.isSubmitting) return;
    this.closeConfirmModal();
    this.submitBooking();
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
    const bookingData = this.buildSanitizedBookingData();

    this.bookingService.bookService(bookingData).subscribe({
      next: (response) => {
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
        const discountFeedback =
          discountApplied === true
            ? '🎉 Your 15% first-time discount was applied successfully!'
            : discountApplied === false
              ? '⚠️ This address has already used the 15% first-time discount.'
              : '';
        const statusMessage = this.getUserFriendlyStatusMessage(bookingStatus);
        this.submitMessage = [statusMessage, discountFeedback].filter(Boolean).join(' ');
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
          this.isWaitingForConfirmation = true;
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.isWaitingForConfirmation = false;
        this.submitSuccess = false;
        this.submittedBookingId = null;
        this.submittedBookingStatus = null;
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
          this.discountCheckMessage = '⚠️ This address already used the 15% first-time discount';
          this.submitMessage = backendMessage || 'This address has already used the first-time discount.';

          const bookingId = (httpError?.error as any)?.bookingId;
          if (typeof bookingId === 'string' && bookingId) {
            this.logger.warn('Booking conflict (409) bookingId', bookingId);
          } else {
            this.logger.warn('Booking conflict (409)', httpError);
          }

          this.updatePrice();
          return;
        }

        this.submitMessage = backendMessage || 'An error occurred. Please try again later.';
        this.logger.error('Booking error', error);
      }
    });
  }

  openPaymentIfConfirmed(bookingId: string | null | undefined): void {
    void bookingId;
    return;
  }

  private getUserFriendlyStatusMessage(
    status: 'pending' | 'confirmed' | 'paid' | 'cancelled' | null | undefined
  ): string {
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
    if (status === 'pending') return '⏳ Pending confirmation';
    if (status === 'confirmed') return '✅ Confirmed';
    if (status === 'paid') return '💳 Paid';
    if (status === 'cancelled') return '❌ Cancelled';
    return '';
  }

  trackByExtraId(_: number, item: ExtraCatalogItem): string {
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

    const rawExtras: unknown[] = Array.isArray(raw?.extras) ? raw.extras : [];
    const normalizedExtras = Array.from(
      new Set(
        rawExtras
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .map((x) => String(EXTRA_ALIASES[x] ?? x))
      )
    );

    const phone = sanitizeText(raw?.phone, { maxLength: 20 });
    const frequency = sanitizeText(raw?.frequency, { maxLength: 40 }) || 'one-time';

    const df = raw?.dynamicFields && typeof raw.dynamicFields === 'object' ? raw.dynamicFields : {};
    const dynamicFields: any = this.sanitizeDynamicFields(cleaningType, df, normalizedExtras);
    const distanceSurcharge = !!this.isExtraCharge;
    dynamicFields.distanceSurcharge = distanceSurcharge;

    const windowsQuantity = this.toInt(df?.windowsQuantity, 1, 5000, 1);
    const laundryLoads = this.toInt(df?.laundryLoads, 1, 2, 1);

    const extrasPayload: any[] = normalizedExtras.map((e) => {
      const id = String(e ?? '').trim();
      if (!id) return null;

      if (id === 'windows_exterior') {
        return { type: 'outside_windows', quantity: windowsQuantity };
      }
      if (id === 'laundry') {
        return { type: 'laundry', quantity: laundryLoads };
      }
      if (id === 'heavy_buildup') return 'heavy';
      if (id === 'organize_clothes') return 'organize';

      return id;
    }).filter((x) => x !== null);

    const payload: any = {
      name: sanitizeText(raw?.name, { maxLength: 60 }),
      email: sanitizeEmail(raw?.email, { maxLength: 254 }),
      address: sanitizeAddress(raw?.address, { maxLength: 160 }),
      cleaningType,
      desiredDate: sanitizeText(raw?.desiredDate, { maxLength: 20 }),
      desiredTime: sanitizeText(raw?.desiredTime, { maxLength: 10 }),
      petsAtHome: !!raw?.petsAtHome,
      useOwnProducts: !!raw?.useOwnProducts,
      applyFirstDiscount: !!raw?.applyFirstDiscount,
      distanceSurcharge,
      frequency,
      extras: extrasPayload,
      dynamicFields
    };

    if (phone) {
      payload.phone = phone;
    }

    if (dynamicFields && typeof dynamicFields === 'object') {
      if (typeof dynamicFields.bedrooms === 'number') payload.bedrooms = dynamicFields.bedrooms;
      if (typeof dynamicFields.bathrooms === 'number') payload.bathrooms = dynamicFields.bathrooms;
      if (typeof dynamicFields.additionalBedrooms === 'number') {
        payload.additionalBedrooms = dynamicFields.additionalBedrooms;
      }
      if (typeof dynamicFields.moveMode === 'string') payload.moveMode = dynamicFields.moveMode;
      if (dynamicFields.postConstruction && typeof dynamicFields.postConstruction === 'object') {
        payload.postConstruction = dynamicFields.postConstruction;
      }
      if (dynamicFields.windowCleaning && typeof dynamicFields.windowCleaning === 'object') {
        payload.windowCleaning = dynamicFields.windowCleaning;
      }
    }

    return payload;
  }

  private sanitizeDynamicFields(cleaningType: string, df: any, extras: string[]): any {
    const out: any = {};

    if (cleaningType === 'standard-cleaning') {
      const pkgId = sanitizeText(df?.stdPackage ?? '1-1', { maxLength: 20 });
      const pkg = this.standardPackages.find((p) => p.id === pkgId) || this.standardPackages[0];
      const extraBedrooms = this.toInt(df?.extraBedrooms, 0, 10, 0);
      out.stdPackage = pkgId;
      out.extraBedrooms = extraBedrooms;
      out.bedrooms = this.toInt(pkg?.bedrooms, 1, 14, 1);
      out.bathrooms = this.toInt(pkg?.bathrooms, 1, 10, 1);
      out.additionalBedrooms = extraBedrooms;
    } else if (cleaningType === 'apartment-cleaning') {
      const pkgId = sanitizeText(df?.aptPackage ?? '1-1', { maxLength: 20 });
      const pkg = this.apartmentPackages.find((p) => p.id === pkgId) || this.apartmentPackages[0];
      const extraBedrooms = this.toInt(df?.aptExtraBedrooms, 0, 10, 0);
      out.aptPackage = pkgId;
      out.aptExtraBedrooms = extraBedrooms;
      out.bedrooms = this.toInt(pkg?.bedrooms, 1, 14, 1);
      out.bathrooms = this.toInt(pkg?.bathrooms, 1, 10, 1);
      out.additionalBedrooms = extraBedrooms;
    } else if (cleaningType === 'deep-cleaning') {
      const pkgId = sanitizeText(df?.deepPackage ?? '1-1', { maxLength: 20 });
      const pkg = this.deepPackages.find((p) => p.id === pkgId) || this.deepPackages[0];
      const extraBedrooms = this.toInt(df?.deepExtraBedrooms, 0, 10, 0);
      out.deepPackage = pkgId;
      out.deepExtraBedrooms = extraBedrooms;
      out.bedrooms = this.toInt(pkg?.bedrooms, 1, 14, 1);
      out.bathrooms = this.toInt(pkg?.bathrooms, 1, 10, 1);
      out.additionalBedrooms = extraBedrooms;
    } else if (cleaningType === 'move-in-move-out') {
      const moveMode = String(df?.moveMode ?? '').trim();
      out.moveMode = moveMode === 'move_in' || moveMode === 'both' || moveMode === 'move_out' ? moveMode : 'move_out';

      let bedrooms = 1;
      let bathrooms = 1;
      let additionalBedrooms = 0;

      if (out.moveMode === 'move_out' || out.moveMode === 'both') {
        const pkgId = sanitizeText(df?.moPackage ?? '1-1', { maxLength: 20 });
        const pkg = this.moveOutPackages.find((p) => p.id === pkgId) || this.moveOutPackages[0];
        const extra = this.toInt(df?.moveOutExtraBedrooms, 0, 10, 0);
        out.moPackage = pkgId;
        out.moveOutExtraBedrooms = extra;
        bedrooms = this.toInt(pkg?.bedrooms, 1, 14, 1);
        bathrooms = this.toInt(pkg?.bathrooms, 1, 10, 1);
        additionalBedrooms = extra;
      }

      if (out.moveMode === 'move_in' || out.moveMode === 'both') {
        const pkgId = sanitizeText(df?.miPackage ?? '1-1', { maxLength: 20 });
        const pkg = this.moveInPackages.find((p) => p.id === pkgId) || this.moveInPackages[0];
        const extra = this.toInt(df?.moveInExtraBedrooms, 0, 10, 0);
        out.miPackage = pkgId;
        out.moveInExtraBedrooms = extra;
        const inBedrooms = this.toInt(pkg?.bedrooms, 1, 14, 1);
        const inBathrooms = this.toInt(pkg?.bathrooms, 1, 10, 1);
        if (out.moveMode === 'move_in') {
          bedrooms = inBedrooms;
          bathrooms = inBathrooms;
          additionalBedrooms = extra;
        } else {
          bedrooms = Math.max(bedrooms, inBedrooms);
          bathrooms = Math.max(bathrooms, inBathrooms);
          additionalBedrooms = Math.max(additionalBedrooms, extra);
        }
      }

      out.bedrooms = bedrooms;
      out.bathrooms = bathrooms;
      out.additionalBedrooms = additionalBedrooms;
    } else if (cleaningType === 'post-construction-cleaning') {
      const hours = this.toInt(df?.hours, 1, 200, 1);
      const cleaners = this.toInt(df?.cleaners, 1, 3, 1);
      out.hours = hours;
      out.cleaners = cleaners;
      out.postConstruction = { hours, cleaners };
    } else if (cleaningType === 'window-cleaning') {
      const windowCount = this.toInt(df?.units, 1, 5000, 1);
      out.units = windowCount;
      out.windowCleaning = { windowCount };
    }

    if (extras.includes('windows_exterior')) {
      out.windowsQuantity = this.toInt(df?.windowsQuantity, 1, 5000, 1);
    }

    if (extras.includes('laundry')) {
      out.laundryLoads = this.toInt(df?.laundryLoads, 1, 2, 1);
    }

    return out;
  }

  private toInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (!Number.isFinite(n)) return fallback;
    const i = Math.trunc(n);
    return Math.max(min, Math.min(max, i));
  }

  private syncFormControlDisabledStates(): void {
    if (!this.bookingForm) return;

    const shouldDisableForCoverage = this.coverageStatus === 'outside' && !this.isCheckingCoverage;
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
    const serviceTitle = this.selectedService?.title ?? '';
    const mode = String(raw?.dynamicFields?.moveMode ?? '');
    const extras: string[] = Array.isArray(raw?.extras) ? raw.extras : [];
    const windowsQty = Number(raw?.dynamicFields?.windowsQuantity ?? 1);
    const laundryLoads = Number(raw?.dynamicFields?.laundryLoads ?? 1);

    const extrasPretty = extras.map((rawName) => {
      const name = EXTRA_ALIASES[rawName] ?? rawName;
      const catalogItem = this.extrasCatalog.find(e => e.id === name);
      const label = catalogItem?.label ?? name;
      if (name === 'windows_exterior') return `${label} (Qty: ${Number.isFinite(windowsQty) ? windowsQty : 1})`;
      if (name === 'laundry') return `${label} (Loads: ${Number.isFinite(laundryLoads) ? laundryLoads : 1})`;
      return label;
    });

    const details: Array<{ label: string; value: string }> = [];
    const df = raw?.dynamicFields ?? {};

    if (this.selectedService?.slug === 'standard-cleaning') {
      details.push({ label: 'Bedrooms', value: String(df?.bedrooms ?? '') });
      details.push({ label: 'Bathrooms', value: String(df?.bathrooms ?? '') });
      details.push({ label: 'Additional Bedrooms', value: String(df?.extraBedrooms ?? 0) });
    } else if (this.selectedService?.slug === 'apartment-cleaning') {
      details.push({ label: 'Bedrooms', value: String(df?.bedrooms ?? '') });
      details.push({ label: 'Bathrooms', value: String(df?.bathrooms ?? '') });
      details.push({ label: 'Additional Bedrooms', value: String(df?.aptExtraBedrooms ?? 0) });
    } else if (this.selectedService?.slug === 'deep-cleaning') {
      details.push({ label: 'Bedrooms', value: String(df?.bedrooms ?? '') });
      details.push({ label: 'Bathrooms', value: String(df?.bathrooms ?? '') });
      details.push({ label: 'Additional Bedrooms', value: String(df?.deepExtraBedrooms ?? 0) });
    } else if (this.selectedService?.slug === 'move-in-move-out') {
      details.push({ label: 'Mode', value: mode === 'move_in' ? 'Move-In' : mode === 'both' ? 'Both' : 'Move-Out' });
      if (mode === 'move_out' || mode === 'both') {
        details.push({ label: 'Move-Out Bedrooms', value: String(df?.moveOutBedrooms ?? '') });
        details.push({ label: 'Move-Out Bathrooms', value: String(df?.moveOutBathrooms ?? '') });
        details.push({ label: 'Move-Out Additional Bedrooms', value: String(df?.moveOutExtraBedrooms ?? 0) });
      }
      if (mode === 'move_in' || mode === 'both') {
        details.push({ label: 'Move-In Bedrooms', value: String(df?.moveInBedrooms ?? '') });
        details.push({ label: 'Move-In Bathrooms', value: String(df?.moveInBathrooms ?? '') });
        details.push({ label: 'Move-In Additional Bedrooms', value: String(df?.moveInExtraBedrooms ?? 0) });
      }
    } else if (this.selectedService?.slug === 'post-construction-cleaning') {
      details.push({ label: 'Hours', value: String(df?.hours ?? '') });
      details.push({ label: 'Number of Cleaners', value: String(df?.cleaners ?? '') });
    } else if (this.selectedService?.slug === 'window-cleaning') {
      details.push({ label: 'Number of Windows', value: String(df?.units ?? '') });
    }

    return {
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      address: raw?.address ?? '',
      serviceTitle,
      desiredDate: raw?.desiredDate ?? '',
      desiredTime: raw?.desiredTime ?? '',
      petsAtHome: !!raw?.petsAtHome,
      useOwnProducts: !!raw?.useOwnProducts,
      details,
      extras: extrasPretty,
      discountApplied: !!raw?.applyFirstDiscount,
      discountAmount: this.firstServiceDiscount,
      borderlineApplied: this.borderlineFee > 0,
      borderlineFee: this.borderlineFee,
      finalPrice: this.finalPrice
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
