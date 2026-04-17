import { Component, OnInit, OnDestroy } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingService } from '../../core/services/booking.service';
import { ServiceDataService } from '../../core/services/service-data.service';
import { APARTMENT_PACKAGES, DEEP_PACKAGES, EXTRAS_CATALOG, EXTRA_ALIASES, ExtraCatalogItem, MOVE_IN_PACKAGES, MOVE_OUT_PACKAGES, PricingService, STANDARD_PACKAGES } from '../../core/services/pricing.service';
import { CleaningService } from '../../core/models/service.model';
import { LocationResult } from '../../core/models/location.model';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { sanitizeAddress, sanitizeEmail, sanitizeMultiline, sanitizeObjectDeep, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';

import { GeolocationService } from '../../core/services/geolocation.service';

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

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private serviceData: ServiceDataService,
    private pricingService: PricingService,
    private geolocationService: GeolocationService,
    private route: ActivatedRoute,
    private logger: SafeLoggerService
  ) {}

  ngOnInit(): void {
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
          return this.geolocationService.geocodeAddress(value).pipe(
            catchError(() => of(null)),
            map((result) => ({ address: value, result }))
          );
        })
      )
      .subscribe(({ address, result }) => {
        this.applyCoverageFromGeocode(address, result);
      });

    this.bookingForm.get('email')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(email => {
        this.validateDiscountAvailability(email);
      });

    // Listen for service changes to update dynamic fields
    this.bookingForm.get('cleaningType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(slug => {
        this.onServiceChange(slug);
      });

    this.subscribeSharedPricingControls();

    this.checkQueryParams();
  }

  private resetCoverageState(): void {
    this.isCheckingCoverage = false;
    this.coverageStatus = 'outside';
    this.isExtraCharge = false;
    this.assignedDistance = 0;
    this.coverageCity = '';
    this.coverageMessage = '';
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
      this.updatePrice();
      return;
    }

    this.coverageMessage = 'Sorry, we currently do not serve your location.';
    this.updatePrice();
  }

  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      const requestId = ++this.currentLocationRequestId;
      const addressBefore = String(this.bookingForm.get('address')?.value ?? '');
      this.isCheckingCoverage = true;
      this.coverageMessage = 'Locating you...';
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // First check coverage
          const coverage = this.geolocationService.isWithinCoverage(lat, lng);
          this.coverageStatus = coverage.status;
          this.isExtraCharge = coverage.isExtraCharge;
          this.assignedDistance = coverage.distance || 0;
          
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
            this.updatePrice();
          }
        },
        (error) => {
          this.isCheckingCoverage = false;
          this.coverageMessage = "Unable to get your location. Please enter your address manually.";
        },
        { timeout: 10000 }
      );
    }
  }

  ngOnDestroy(): void {
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
      desiredDate: ['', [Validators.required]],
      desiredTime: ['', [Validators.required, businessHoursTimeValidator('08:00', '18:00')]],
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
    dynamicGroup.addControl('cleaners', new FormControl(1, [Validators.required, Validators.min(1), Validators.max(50)]));
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

    const formValue = {
      ...this.bookingForm.get('dynamicFields')?.value,
      frequency: this.bookingForm.get('frequency')?.value,
      extras: this.bookingForm.get('extras')?.value,
      applyDiscount
    };

    const breakdown = this.pricingService.calculateBreakdown(this.selectedService, formValue, this.isExtraCharge);
    if (breakdown === 'custom') {
      this.basePrice = 0;
      this.extrasPrice = 0;
      this.borderlineFee = 0;
      this.firstServiceDiscount = 0;
      this.finalPrice = 0;
      return;
    }

    this.basePrice = breakdown.basePrice;
    this.extrasPrice = breakdown.extrasPrice;
    this.borderlineFee = breakdown.borderlineFee;
    this.firstServiceDiscount = breakdown.discount;
    this.finalPrice = breakdown.finalPrice;
    this.estimatedPrice = Math.round(this.basePrice + this.borderlineFee);
  }

  checkQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const serviceSlug = String(params['service'] ?? '').trim();
        const serviceName = String(params['serviceName'] ?? '').trim();
        const promo = String(params['promo'] ?? '').trim();
        const discountParam = String(params['discount'] ?? '').trim();

        if (discountParam === '1' || promo) {
          this.bookingForm.get('applyFirstDiscount')?.setValue(true, { emitEvent: true });
        }

        const service =
          (serviceSlug ? this.serviceData.getServiceBySlug(serviceSlug) : undefined) ??
          (serviceName ? this.serviceData.getEnabledServices().find(s => s.title === serviceName) : undefined);

        if (service) {
          this.selectService(service.slug);
          this.scrollToBookingForm();
          return;
        }

        if (discountParam === '1' || promo) {
          this.scrollToBookingForm();
        }
      });
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
    this.validateDiscountAvailability(this.bookingForm.get('email')?.value, true);
  }

  private validateDiscountAvailability(rawEmail: unknown, forceCheck: boolean = false): void {
    const applyDiscountControl = this.bookingForm.get('applyFirstDiscount');
    const emailControl = this.bookingForm.get('email');
    if (!applyDiscountControl || !emailControl) return;

    const normalizedEmail = String(rawEmail ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      this.resetDiscountAvailabilityState();
      return;
    }

    if (!normalizedEmail.includes('@')) {
      this.isDiscountBlocked = false;
      applyDiscountControl.enable({ emitEvent: false });
      applyDiscountControl.setValue(false, { emitEvent: false });
      return;
    }

    if (emailControl.invalid) {
      this.resetDiscountAvailabilityState();
      return;
    }

    if (!forceCheck && normalizedEmail === this.lastCheckedDiscountEmail) {
      return;
    }

    this.lastCheckedDiscountEmail = normalizedEmail;
    this.isCheckingDiscount = true;
    const requestId = ++this.discountCheckRequestId;

    this.bookingService.checkDiscount(normalizedEmail).subscribe({
      next: (response) => {
        if (requestId !== this.discountCheckRequestId) return;
        this.isCheckingDiscount = false;

        if (response?.canUseDiscount === false) {
          applyDiscountControl.setValue(false, { emitEvent: true });
          applyDiscountControl.disable({ emitEvent: false });
          this.isDiscountBlocked = true;
          this.discountCheckMessage = '⚠️ This email already used the 15% first-time discount';
          return;
        }

        if (applyDiscountControl.disabled) {
          applyDiscountControl.enable({ emitEvent: false });
        }
        this.isDiscountBlocked = false;
        this.discountCheckMessage = '';
      },
      error: (error) => {
        if (requestId !== this.discountCheckRequestId) return;
        this.isCheckingDiscount = false;
        if (applyDiscountControl.disabled) {
          applyDiscountControl.enable({ emitEvent: false });
        }
        this.isDiscountBlocked = false;
        this.discountCheckMessage = 'Unable to verify discount availability right now.';
        this.logger.warn('Discount check failed', error);
      }
    });
  }

  private resetDiscountAvailabilityState(): void {
    const applyDiscountControl = this.bookingForm.get('applyFirstDiscount');
    if (!applyDiscountControl) return;

    this.isCheckingDiscount = false;
    this.isDiscountBlocked = false;
    this.discountCheckMessage = '';
    this.lastCheckedDiscountEmail = '';
    if (applyDiscountControl.disabled) {
      applyDiscountControl.enable({ emitEvent: false });
    }
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

  private submitBooking(): void {
    const discountControl = this.discountControl;

    if (this.isDiscountBlocked && discountControl?.value) {
      discountControl.setValue(false, { emitEvent: false });
    }

    this.isSubmitting = true;
    const bookingData = this.buildSanitizedBookingData();

    this.bookingService.bookService(bookingData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.submitSuccess = response.success;
        const discountApplied = response?.discountApplied;
        const discountFeedback =
          discountApplied === true
            ? '🎉 Your 15% first-time discount was applied successfully!'
            : discountApplied === false
              ? '⚠️ This email has already used the 15% first-time discount.'
              : '';
        this.submitMessage = [response.message, discountFeedback].filter(Boolean).join(' ');
        if (response.success) {
          this.bookingForm.reset({
            frequency: 'one-time',
            petsAtHome: false,
            useOwnProducts: false
          });
          this.resetDiscountAvailabilityState();
          this.selectedService = null;
          this.estimatedPrice = 0;
          this.confirmSnapshot = null;
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitSuccess = false;
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
          this.discountCheckMessage = '⚠️ This email already used the 15% first-time discount';
          this.submitMessage = backendMessage || 'This email has already used the first-time discount.';

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

  private buildSanitizedBookingData(): any {
    const raw = this.bookingForm.value;

    const base = {
      ...raw,
      name: sanitizeText(raw?.name, { maxLength: 60 }),
      email: sanitizeEmail(raw?.email, { maxLength: 254 }),
      phone: sanitizeText(raw?.phone, { maxLength: 20 }),
      address: sanitizeAddress(raw?.address, { maxLength: 160 }),
      estimatedPrice: this.estimatedPrice,
      finalPricePreview: this.finalPrice
    };

    if (base?.dynamicFields && typeof base.dynamicFields === 'object') {
      base.dynamicFields = sanitizeObjectDeep(base.dynamicFields, (s) => sanitizeText(s, { maxLength: 200 }));
    }

    if (typeof base?.message === 'string') {
      base.message = sanitizeMultiline(base.message, { maxLength: 1500 });
    }

    return base;
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
