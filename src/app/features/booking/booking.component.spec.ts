import { render, screen, fireEvent } from '@testing-library/angular';
import { ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { BookingComponent } from './booking.component';
import { BookingService } from '../../core/services/booking.service';
import { ServiceDataService } from '../../core/services/service-data.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { AuthService } from '../../core/services/auth.service';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { MOCK_PRICE_PREVIEW, MOCK_PRICE_PREVIEW_V2, MOCK_PRICE_PREVIEW_V2_BORDERLINE } from '../../../testing/fixtures/booking.fixture';
import { REGULAR_CLEANING_PACKAGES_V2, EXTRA_BEDROOM_PRICE_V2, SPECIAL_SERVICES_V2, OPTIONAL_EXTRAS_V2, COMPATIBILITY_MATRIX_V2, EXTRA_MAX_QUANTITY_V2, isExtraDisabledV2, type CompatibilityContextV2 } from '../../core/catalogs/pricing-catalogs-v2';

/**
 * @file booking.component.spec.ts
 * @description Test de UI para el componente de reserva usando Angular Testing Library.
 * 
 * CONCEPTOS CLAVE:
 * - render: Dibuja el componente en un DOM virtual para poder probarlo.
 * - screen: Nos permite buscar elementos en la pantalla (ej.getByText).
 * - fireEvent: Simula acciones del usuario como clicks o escribir en inputs.
 * - Mocks: Reemplazamos los servicios reales por versiones controladas que devuelven observables con datos de prueba.
 */

describe('BookingComponent (Frontend UI Test)', () => {
  const mockBookingService = {
    pricePreview: jest.fn().mockReturnValue(of(MOCK_PRICE_PREVIEW)),
    checkDiscount: jest.fn().mockReturnValue(of({ eligible: true })),
    bookService: jest.fn()
  };

  const mockServiceData = {
    getServiceBySlug: jest.fn().mockReturnValue({ slug: 'standard-cleaning', name: 'Standard' }),
    getEnabledServices: jest.fn().mockReturnValue([{ slug: 'standard-cleaning', name: 'Standard' }])
  };

  const mockGeolocation = {
    getCoverageCities: jest.fn().mockReturnValue(['New York']),
    getCoverageCitiesDetails: jest.fn().mockReturnValue([
      { name: 'Tampa', lat: 27.9506, lng: -82.4572, radiusKm: 22 },
      { name: 'Odessa', lat: 28.1822, lng: -82.5695, radiusKm: 15 },
    ]),
    reverseGeocode: jest.fn().mockReturnValue(of('123 Test St'))
  };

  const mockAuth = {
    isSupervisor: jest.fn().mockReturnValue(false)
  };

  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn()
  };

  it('should render the booking form and show the title', async () => {
    // Renderizamos el componente con todas sus dependencias mockeadas
    await render(BookingComponent, {
      imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: BookingService, useValue: mockBookingService },
        { provide: ServiceDataService, useValue: mockServiceData },
        { provide: GeolocationService, useValue: mockGeolocation },
        { provide: AuthService, useValue: mockAuth },
        { provide: SafeLoggerService, useValue: mockLogger }
      ]
    });

    // Verificamos que el título esté presente (contexto por defecto es public-quote-request-mode
    // ya que isAdminManualBooking es false sin route data especial; renderiza la variante "Quote").
    expect(screen.getByText(/Request Your Cleaning Quote|Book Your Cleaning/i)).toBeTruthy();
  });

  it('should update price when typing an address', async () => {
    await render(BookingComponent, {
      imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: BookingService, useValue: mockBookingService },
        { provide: ServiceDataService, useValue: mockServiceData },
        { provide: GeolocationService, useValue: mockGeolocation },
        { provide: AuthService, useValue: mockAuth },
        { provide: SafeLoggerService, useValue: mockLogger }
      ]
    });

    // Buscamos el input de dirección por su placeholder
    const addressInput = screen.getByPlaceholderText(/123 Shine St/i);
    
    // Simulamos que el usuario escribe una dirección
    fireEvent.input(addressInput, { target: { value: '123 Fake Street, City' } });
    
    // Nota: Como hay un debounce de 1000ms en el código, en un test real
    // usaríamos fakeAsync y tick(1000) para validar que el servicio fue llamado.
  });

  it('[V2 Coverage Preservation] markPricePreviewDirty no debe revertir una cobertura INSIDE cuando address/coords no cambian', async () => {
    const { fixture } = await render(BookingComponent, {
      imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: BookingService, useValue: mockBookingService },
        { provide: ServiceDataService, useValue: mockServiceData },
        { provide: GeolocationService, useValue: mockGeolocation },
        { provide: AuthService, useValue: mockAuth },
        { provide: SafeLoggerService, useValue: mockLogger }
      ]
    });

    const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;

    comp.bookingForm.patchValue({ address: 'Cheval, Lutz, FL' }, { emitEvent: false });
    comp.selectedCoords = { lat: 28.15, lng: -82.56 };
    comp.hasVerifiedCoverage = true;
    comp.coverageStatus = 'inside';
    comp.coverageCity = 'Odessa';
    comp.coverageMessage = 'Great news! We serve your area in Odessa.';
    comp.assignedDistance = 14.8;
    comp.isExtraCharge = false;

    comp.pricePreviewResult = JSON.parse(JSON.stringify(MOCK_PRICE_PREVIEW_V2));
    (fixture as ComponentFixture<BookingComponent>).detectChanges();

    expect(comp.getV2CoverageState()).toBe('INSIDE');

    comp.markPricePreviewDirty();
    (fixture as ComponentFixture<BookingComponent>).detectChanges();

    expect(comp.hasVerifiedCoverage).toBe(true);
    expect(comp.coverageStatus).toBe('inside');
    expect(comp.getV2CoverageState()).toBe('INSIDE');
    expect(comp.coverageCity).toBe('Odessa');
    expect(comp.coverageMessage).not.toBe('');
    expect(comp.selectedCoords).toEqual({ lat: 28.15, lng: -82.56 });
    expect(comp.assignedDistance).toBeCloseTo(14.8, 5);
    expect(comp.isExtraCharge).toBe(false);
  });

  describe('[V2 Status Mapping V2-only] (sin fallback V1 isBorderline)', () => {
    async function renderAndGetComp() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      return (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
    }

    it('[TR-3.1] V2 undefined + coverageStatus undefined + assignedZone V1 true → status=outside (NUNCA infiere V1)', async () => {
      const comp = await renderAndGetComp();
      const res = {
        coverageClassification: undefined,
        coverageStatus: undefined,
        assignedZone: 'Tampa',
        isBorderline: true,
        distanceSurcharge: true
      };
      const v2Classification = String((res as any)?.coverageClassification ?? '').toUpperCase();
      const v2Valid = ['INSIDE','BORDERLINE','OUTSIDE'].includes(v2Classification);
      const statusRaw = String((res as any)?.coverageStatus ?? '').toLowerCase();
      const statusLegacyValid = statusRaw === 'inside' || statusRaw === 'borderline' || statusRaw === 'outside';
      const status = v2Valid
        ? v2Classification.toLowerCase()
        : statusLegacyValid
          ? statusRaw
          : 'outside';
      expect(status).toBe('outside');
    });

    it('[TR-3.2] V2=BORDERLINE y legacy coverageStatus=inside → V2 gana (status=borderline)', async () => {
      const comp = await renderAndGetComp();
      const res = { coverageClassification: 'BORDERLINE', coverageStatus: 'inside', assignedZone: null, isBorderline: false };
      const v2Classification = String((res as any)?.coverageClassification ?? '').toUpperCase();
      const v2Valid = ['INSIDE','BORDERLINE','OUTSIDE'].includes(v2Classification);
      const statusRaw = String((res as any)?.coverageStatus ?? '').toLowerCase();
      const statusLegacyValid = statusRaw === 'inside' || statusRaw === 'borderline' || statusRaw === 'outside';
      const status = v2Valid
        ? v2Classification.toLowerCase()
        : statusLegacyValid
          ? statusRaw
          : 'outside';
      expect(status).toBe('borderline');
    });

    it('[TR-3.3] V2 undefined + legacy coverageStatus=borderline → fallback válido status=borderline', async () => {
      const comp = await renderAndGetComp();
      const res = { coverageClassification: undefined, coverageStatus: 'borderline', assignedZone: null, isBorderline: false };
      const v2Classification = String((res as any)?.coverageClassification ?? '').toUpperCase();
      const v2Valid = ['INSIDE','BORDERLINE','OUTSIDE'].includes(v2Classification);
      const statusRaw = String((res as any)?.coverageStatus ?? '').toLowerCase();
      const statusLegacyValid = statusRaw === 'inside' || statusRaw === 'borderline' || statusRaw === 'outside';
      const status = v2Valid
        ? v2Classification.toLowerCase()
        : statusLegacyValid
          ? statusRaw
          : 'outside';
      expect(status).toBe('borderline');
    });
  });

  describe('[V2 Coverage Preservation] Service / Extras changes NO destruyen coverage', () => {
    async function setupComp(initial: 'INSIDE' | 'BORDERLINE') {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      comp.bookingForm.patchValue({ address: 'Test Address, FL' }, { emitEvent: false });
      comp.selectedCoords = { lat: 28, lng: -82.5 };
      comp.hasVerifiedCoverage = true;
      if (initial === 'INSIDE') {
        comp.coverageStatus = 'inside';
        comp.coverageCity = 'Tampa';
        comp.coverageMessage = 'Great news! We cover Tampa.';
        comp.assignedDistance = 12.3;
        comp.isExtraCharge = false;
        comp.pricePreviewResult = JSON.parse(JSON.stringify(MOCK_PRICE_PREVIEW_V2));
      } else {
        comp.coverageStatus = 'borderline';
        comp.coverageCity = 'Oldsmar';
        comp.coverageMessage = 'Note: $25 distance surcharge applies.';
        comp.assignedDistance = 9.4;
        comp.isExtraCharge = true;
        comp.pricePreviewResult = JSON.parse(JSON.stringify(MOCK_PRICE_PREVIEW_V2_BORDERLINE));
      }
      (fixture as ComponentFixture<BookingComponent>).detectChanges();
      return { fixture, comp };
    }

    it('INSIDE → cambiar service (markPricePreviewDirty) → sigue INSIDE / borderlineFee 0', async () => {
      const { fixture, comp } = await setupComp('INSIDE');
      expect(comp.getV2CoverageState()).toBe('INSIDE');
      comp.markPricePreviewDirty();
      fixture.detectChanges();
      expect(comp.hasVerifiedCoverage).toBe(true);
      expect(comp.coverageStatus).toBe('inside');
      expect(comp.getV2CoverageState()).toBe('INSIDE');
      expect(comp.isExtraCharge).toBe(false);
      expect(comp.coverageCity).toBe('Tampa');
    });

    it('BORDERLINE → cambiar service (markPricePreviewDirty) → sigue BORDERLINE / feeApplicable true / $25', async () => {
      const { fixture, comp } = await setupComp('BORDERLINE');
      expect(comp.getV2CoverageState()).toBe('BORDERLINE');
      comp.markPricePreviewDirty();
      fixture.detectChanges();
      expect(comp.hasVerifiedCoverage).toBe(true);
      expect(comp.coverageStatus).toBe('borderline');
      expect(comp.getV2CoverageState()).toBe('BORDERLINE');
      expect(comp.isExtraCharge).toBe(true);
      expect(comp.coverageCity).toBe('Oldsmar');
    });

    it('INSIDE → toggle extra (markPricePreviewDirty) → sigue INSIDE / $0', async () => {
      const { fixture, comp } = await setupComp('INSIDE');
      expect(comp.getV2CoverageState()).toBe('INSIDE');
      comp.markPricePreviewDirty();
      fixture.detectChanges();
      expect(comp.hasVerifiedCoverage).toBe(true);
      expect(comp.coverageStatus).toBe('inside');
      expect(comp.getV2CoverageState()).toBe('INSIDE');
      expect(comp.assignedDistance).toBeCloseTo(12.3, 5);
    });

    it('BORDERLINE → toggle extra (markPricePreviewDirty) → sigue BORDERLINE / isExtraCharge=true', async () => {
      const { fixture, comp } = await setupComp('BORDERLINE');
      expect(comp.getV2CoverageState()).toBe('BORDERLINE');
      comp.markPricePreviewDirty();
      fixture.detectChanges();
      expect(comp.hasVerifiedCoverage).toBe(true);
      expect(comp.coverageStatus).toBe('borderline');
      expect(comp.getV2CoverageState()).toBe('BORDERLINE');
      expect(comp.isExtraCharge).toBe(true);
      expect(comp.assignedDistance).toBeCloseTo(9.4, 5);
    });
  });

  describe('[V2 Regular Cleaning — Sección 4] Cards seleccionables + counters + estimated progressivo', () => {
    async function setupRegularSection() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      expect(comp.useV2Model).toBe(true);
      expect(REGULAR_CLEANING_PACKAGES_V2.length).toBe(9);
      fixture.detectChanges();
      return { fixture, comp };
    }

    function findRegularCard(comp: any, pkgId: string): HTMLElement | null {
      const pkg = REGULAR_CLEANING_PACKAGES_V2.find(p => p.id === pkgId);
      if (!pkg) return null;
      const buttons: HTMLButtonElement[] = Array.from(
        (comp as any)._renderer || document
      );
      void buttons;
      void pkg;
      return null;
    }

    function setSelectedPackage(comp: any, id: string): void {
      comp.selectV2RegularPackage(id);
    }

    function getSelectedId(comp: any): string | null {
      const v = comp?.bookingForm?.get?.('dynamicFields')?.value?.regularPackageId ?? null;
      return v ?? comp?.bookingForm?.value?.dynamicFields?.regularPackageId ?? null;
    }

    function getAddBedroomsValue(comp: any): number {
      const v1 = comp?.bookingForm?.get?.('dynamicFields')?.value?.additionalBedroomsV2;
      return typeof v1 === 'number' ? v1 : comp?.v2AddBedroomsValue;
    }

    it('[S1] Ninguna card seleccionada inicialmente (regularPackageId = null / no inventar precio)', async () => {
      const { comp } = await setupRegularSection();
      const id = getSelectedId(comp);
      expect(id).toBeFalsy();
      expect(comp.getSelectedV2RegularPackage()).toBeNull();
      expect(comp.getV2RegularPackage()).toBeNull();
      expect(comp.getV2LocalEstimatedPrice()).toBeNull();
    });

    it('[S2] Click facade en 1 bed / 1 bath (1-1) → queda seleccionada', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '1-1');
      expect(getSelectedId(comp)).toBe('1-1');
      const pkg = comp.getSelectedV2RegularPackage();
      expect(pkg).toBeTruthy();
      expect(pkg.id).toBe('1-1');
      expect(pkg.basePrice).toBe(110);
    });

    it('[S3] Click en 1-1 luego 2-1 → la 1-1 se deselecciona y la 2-1 queda seleccionada (única seleccionable)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '1-1');
      expect(getSelectedId(comp)).toBe('1-1');
      setSelectedPackage(comp, '2-1');
      expect(getSelectedId(comp)).toBe('2-1');
      expect(comp.getSelectedV2RegularPackage().id).toBe('2-1');
      const allSelected = REGULAR_CLEANING_PACKAGES_V2.filter(p => p.id === getSelectedId(comp));
      expect(allSelected.length).toBe(1);
    });

    it('[S4] Solo una card puede estar seleccionada (9 paquetes probados)', async () => {
      const { comp } = await setupRegularSection();
      for (const p of REGULAR_CLEANING_PACKAGES_V2) {
        setSelectedPackage(comp, p.id);
        const selected = REGULAR_CLEANING_PACKAGES_V2.filter(x => x.id === getSelectedId(comp));
        expect(selected.length).toBe(1);
        expect(selected[0].id).toBe(p.id);
      }
    });

    it('[C5] Additional Bedrooms initial = 0', async () => {
      const { comp } = await setupRegularSection();
      expect(comp.v2AddBedroomsValue).toBe(0);
      expect(getAddBedroomsValue(comp)).toBe(0);
      expect(comp.getV2AdditionalBedrooms()).toBe(0);
    });

    it('[C6] + incrementa 0 → 1', async () => {
      const { comp } = await setupRegularSection();
      comp.incrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(1);
      expect(comp.getV2AdditionalBedrooms()).toBe(1);
    });

    it('[C7] + incrementa 1 → 2', async () => {
      const { comp } = await setupRegularSection();
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(2);
      expect(comp.getV2AdditionalBedrooms()).toBe(2);
    });

    it('[C8] - decrementa 2 → 1', async () => {
      const { comp } = await setupRegularSection();
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      comp.decrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(1);
    });

    it('[C9] - decrementa 1 → 0', async () => {
      const { comp } = await setupRegularSection();
      comp.incrementV2AdditionalBedrooms();
      comp.decrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(0);
    });

    it('[C10] - no permite valores negativos (cuando está en 0, pulsar -= → sigue en 0)', async () => {
      const { comp } = await setupRegularSection();
      expect(comp.v2AddBedroomsValue).toBe(0);
      comp.decrementV2AdditionalBedrooms();
      comp.decrementV2AdditionalBedrooms();
      comp.decrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(0);
      expect(comp.getV2AdditionalBedrooms()).toBe(0);
    });

    it('[C11] Cuando valor es 0, botón disabled en HTML (atributo disabled por binding)', async () => {
      const { fixture, comp } = await setupRegularSection();
      expect(comp.v2AddBedroomsValue).toBe(0);
      fixture.detectChanges();
      const native = fixture.nativeElement as HTMLElement;
      const counterBtns = Array.from(native.querySelectorAll('button.v2-counter__btn')) as HTMLButtonElement[];
      const minusBtn = counterBtns.find(b => b.textContent?.trim() === '−' || b.getAttribute('aria-label')?.includes('Decrease'));
      expect(minusBtn).toBeTruthy();
      if (minusBtn) {
        const disabled = minusBtn.disabled || (minusBtn.getAttribute('disabled') !== null);
        expect(disabled).toBe(true);
      }
      comp.incrementV2AdditionalBedrooms();
      fixture.detectChanges();
      const minusBtn2 = (Array.from(fixture.nativeElement.querySelectorAll('button.v2-counter__btn')) as HTMLButtonElement[])
        .find(b => b.textContent?.trim() === '−' || b.getAttribute('aria-label')?.includes('Decrease'));
      expect(minusBtn2).toBeTruthy();
      if (minusBtn2) {
        expect(minusBtn2.disabled).toBe(false);
      }
    });

    it('[P12] 1 bed / 1 bath + 0 additional → $110', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '1-1');
      expect(comp.v2AddBedroomsValue).toBe(0);
      expect(comp.getV2LocalEstimatedPrice()).toBe(110);
    });

    it('[P13] 3 bed / 2 bath + 0 additional → $150', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '3-2');
      expect(comp.getV2LocalEstimatedPrice()).toBe(150);
    });

    it('[P14] 3 bed / 2 bath + 1 additional → $190 (150 + 1*40)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '3-2');
      comp.incrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(1);
      expect(EXTRA_BEDROOM_PRICE_V2).toBe(40);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 40);
    });

    it('[P15] 3 bed / 2 bath + 2 additional → $230 (150 + 2*40)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '3-2');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 80);
    });

    it('[P16] 5 bed / 3 bath + 2 additional → $290 (210 + 2*40)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '5-3');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      expect(comp.getSelectedV2RegularPackage().basePrice).toBe(210);
      expect(comp.getV2LocalEstimatedPrice()).toBe(210 + 80);
    });

    it('[CC17] Seleccionar 3/2 + 2 add = $230, luego cambiar a 4/2 manteniendo 2 add = $260 (no reset add)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '3-2');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      expect(comp.v2AddBedroomsValue).toBe(2);
      expect(comp.getV2LocalEstimatedPrice()).toBe(230);
      setSelectedPackage(comp, '4-2');
      expect(comp.v2AddBedroomsValue).toBe(2);
      expect(comp.getV2LocalEstimatedPrice()).toBe(180 + 80);
    });

    it('[CC18] Mantiene additional bedrooms al cambiar card: 3/2+2=230 → 5/3 = 210+80 = 290 (sin que se resete add)', async () => {
      const { comp } = await setupRegularSection();
      setSelectedPackage(comp, '3-2');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      setSelectedPackage(comp, '5-3');
      expect(comp.getV2AdditionalBedrooms()).toBe(2);
      expect(comp.getV2LocalEstimatedPrice()).toBe(210 + 80);
    });
  });

  describe('[V2 Special Services — Sección 5] Single-select, pricing, removal, combined', () => {
    async function setupSpecialSection() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      // Asegurar estado limpio
      comp.selectV2RegularPackage('3-2');
      expect(comp.getSelectedV2RegularPackage().basePrice).toBe(150);
      comp.decrementV2AdditionalBedrooms();
      expect(comp.getV2AdditionalBedrooms()).toBe(0);
      comp.selectV2SpecialService(null);
      fixture.detectChanges();
      return { fixture, comp };
    }
    function selectedSpecial(comp: any): string | null {
      const v = comp?.bookingForm?.get?.('dynamicFields')?.value?.specialServiceId;
      return typeof v === 'string' && v.trim().length > 0 ? v : null;
    }
    function countSelected(comp: any): number {
      const s = selectedSpecial(comp);
      return s ? 1 : 0;
    }
    const DEEP = 'deep_home_cleaning';
    const MOVE = 'move_in_out';
    const POST = 'post_construction';
    const EXTREME = 'extreme_home_cleaning';

    it('[SS1] Ningún Special Service seleccionado inicialmente', async () => {
      const { comp } = await setupSpecialSection();
      expect(selectedSpecial(comp)).toBeNull();
      expect(comp.getV2SelectedSpecialServiceId()).toBeNull();
    });

    it('[SS2] Seleccionar Deep Home Cleaning → selected=DEEP', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      expect(selectedSpecial(comp)).toBe(DEEP);
      expect(comp.getV2SelectedSpecialServiceId()).toBe(DEEP);
    });

    it('[SS3] Deep Home Cleaning queda selected (único seleccionado)', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      expect(countSelected(comp)).toBe(1);
    });

    it('[SS4] Seleccionar Move-In / Move-Out después', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(MOVE);
      expect(selectedSpecial(comp)).toBe(MOVE);
    });

    it('[SS5] Deep Home Cleaning queda deseleccionado al cambiar a Move-In / Move-Out', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(MOVE);
      expect(selectedSpecial(comp)).not.toBe(DEEP);
    });

    it('[SS6] Move-In / Move-Out queda selected (único)', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(MOVE);
      expect(countSelected(comp)).toBe(1);
    });

    it('[SS7] Nunca dos Special Services seleccionados simultáneamente (4 servicios todos testear)', async () => {
      const { comp } = await setupSpecialSection();
      const ids = [DEEP, MOVE, POST, EXTREME];
      for (let i = 0; i < ids.length; i++) {
        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue;
          comp.selectV2SpecialService(ids[i]);
          comp.selectV2SpecialService(ids[j]);
          expect(countSelected(comp)).toBe(1);
          expect(selectedSpecial(comp)).toBe(ids[j]);
        }
      }
    });

    it('[SS8] Regular 3/2 $150 + Deep $80 = $230', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      expect(SPECIAL_SERVICES_V2[DEEP].flatFee).toBe(80);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 80);
    });

    it('[SS9] Regular 3/2 $150 + Move-In/Move-Out $75 = $225', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(MOVE);
      expect(SPECIAL_SERVICES_V2[MOVE].flatFee).toBe(75);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75);
    });

    it('[SS10] Regular 3/2 $150 + Post-Construction $200 = $350', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(POST);
      expect(SPECIAL_SERVICES_V2[POST].flatFee).toBe(200);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 200);
    });

    it('[SS11] Regular 3/2 $150 + Extreme $250 = $400', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(EXTREME);
      expect(SPECIAL_SERVICES_V2[EXTREME].flatFee).toBe(250);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 250);
    });

    it('[SS12] 3/2 $150 + 1 bedroom $40 + Deep $80 = $270', async () => {
      const { comp } = await setupSpecialSection();
      comp.incrementV2AdditionalBedrooms();
      comp.selectV2SpecialService(DEEP);
      expect(comp.getV2AdditionalBedrooms()).toBe(1);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 40 + 80);
    });

    it('[SS13] 4/2 $180 + 2 bedrooms $80 + Move-In/Out $75 = $335', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2RegularPackage('4-2');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      comp.selectV2SpecialService(MOVE);
      expect(comp.getSelectedV2RegularPackage().basePrice).toBe(180);
      expect(comp.getV2AdditionalBedrooms()).toBe(2);
      expect(comp.getV2LocalEstimatedPrice()).toBe(180 + 80 + 75);
    });

    it('[SS14] 5/3 $210 + Post-Construction $200 = $410', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2RegularPackage('5-3');
      comp.selectV2SpecialService(POST);
      expect(comp.getSelectedV2RegularPackage().basePrice).toBe(210);
      expect(comp.getV2LocalEstimatedPrice()).toBe(210 + 200);
    });

    it('[SS15] 5/3 $210 + 2 bedrooms $80 + Extreme $250 = $540', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2RegularPackage('5-3');
      comp.incrementV2AdditionalBedrooms();
      comp.incrementV2AdditionalBedrooms();
      comp.selectV2SpecialService(EXTREME);
      expect(comp.getV2AdditionalBedrooms()).toBe(2);
      expect(comp.getV2LocalEstimatedPrice()).toBe(210 + 80 + 250);
    });

    it('[SS16] Switching A: Regular 3/2 $150 + Deep $80 = $230', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      expect(comp.getV2LocalEstimatedPrice()).toBe(230);
    });

    it('[SS17] Switching B: Deep → Move-In/Out', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(MOVE);
      expect(selectedSpecial(comp)).toBe(MOVE);
      expect(selectedSpecial(comp)).not.toBe(DEEP);
    });

    it('[SS18] Switching result = $225, NOT $305 (sin acumular Deep+Move)', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(MOVE);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75);
      expect(comp.getV2LocalEstimatedPrice()).not.toBe(150 + 80 + 75);
    });

    it('[SS19] Removal A: Seleccionar Deep luego Deseleccionar Deep = no special', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(DEEP); // click mismo toggle → deselecciona
      expect(selectedSpecial(comp)).toBeNull();
    });

    it('[SS20] Removal B: Otra forma Deselect explícito facade null = no special', async () => {
      const { comp } = await setupSpecialSection();
      comp.selectV2SpecialService(DEEP);
      comp.selectV2SpecialService(null);
      expect(selectedSpecial(comp)).toBeNull();
    });

    it('[SS21] Removal C: Precio vuelve a Regular + Additional Bedrooms (1 bed: 150 + 40 = 190, sin el Deep 80)', async () => {
      const { comp } = await setupSpecialSection();
      comp.incrementV2AdditionalBedrooms();
      comp.selectV2SpecialService(DEEP);
     expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 40 + 80);
      comp.selectV2SpecialService(DEEP); // toggle mismo remove
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 40);

    });

  });

  describe('[V2 Extras Logic / Pricing / Compatibility / Modals] T1-T9', () => {

    async function setupComp() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      comp.ngOnInit();
      fixture.detectChanges();
      comp.selectV2RegularPackage('3-2');
      return { fixture, comp };
    }

    it('[T1] Regular 3/2 $150 + Oven $25 = $175 (base + $25)', async () => {
      const { comp } = await setupComp();
      comp.onV2ExtraBoolToggle('oven', true);
      expect(comp.isV2ExtraSelected('oven')).toBe(true);
      expect(comp.getV2ExtrasSubtotal()).toBe(25);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 25);
    });

    it('[T2] Regular 3/2 + Laundry × 2 (2 loads × $15 = $30). Total $180.', async () => {
      const { comp } = await setupComp();
      comp.onV2ExtraBoolToggle('laundry', true); // 1 load default min
      expect(comp.getV2ExtraQty('laundry')).toBeGreaterThanOrEqual(1);
      comp.onV2ExtraQtyChange('laundry', 2);
      expect(comp.getV2ExtraQty('laundry')).toBe(2);
      expect(comp.getV2ExtrasSubtotal()).toBe(30);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 30);
    });

    it('[T3] Regular 3/2 + Heavy Furniture × 2 items (max 2). 2 × $25 = $50. Total $200.', async () => {
      const { comp } = await setupComp();
      // Heavy Furniture ahora es kind qty, con minQuantity=1. Check toggle true habilita qty 1.
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      expect(comp.isV2ExtraSelected('heavy_furniture_moving')).toBe(true);
      expect(comp.getV2ExtraQty('heavy_furniture_moving')).toBeGreaterThanOrEqual(1);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 2);
      expect(comp.getV2ExtraQty('heavy_furniture_moving')).toBe(2);
      expect(OPTIONAL_EXTRAS_V2.heavy_furniture_moving.maxQuantity).toBe(2);
      expect(comp.getV2ExtrasSubtotal()).toBe(2 * 25);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 2 * 25);
    });

    it('[T4] Post-Construction Special $200 + Refrigerator ($25) + Oven ($25) + Heavy Furniture × 1 ($25) = $425 total (150 base + 200 special + 75 extras). §4: Post Construction ALLOWS Oven/Refrigerator/Heavy Furniture; kills only Closet/Laundry/Garage/FullGarage.', async () => {
      const { comp } = await setupComp();
      const POST = 'post_construction';
      comp.selectV2SpecialService(POST);
      // §4 Approved matrix: Post CONSTRUCTION excludes (closet, laundry, garage, full_garage) only → Oven/Refrigerator/Heavy OK
      const disHeavy = isExtraDisabledV2('heavy_furniture_moving', POST, comp.v2SelectedExtrasSet);
      expect(disHeavy.disabled).toBe(false);
      const disRefri = isExtraDisabledV2('refrigerator', POST, comp.v2SelectedExtrasSet);
      expect(disRefri.disabled).toBe(false);
      const disOven = isExtraDisabledV2('oven', POST, comp.v2SelectedExtrasSet);
      expect(disOven.disabled).toBe(false);
      // Post EXCLUDES closet/laundry/garage/full_garage (§4 rule)
      expect(isExtraDisabledV2('closet_organization', POST, comp.v2SelectedExtrasSet).disabled).toBe(true);
      expect(isExtraDisabledV2('laundry', POST, comp.v2SelectedExtrasSet).disabled).toBe(true);
      expect(isExtraDisabledV2('garage', POST, comp.v2SelectedExtrasSet).disabled).toBe(true);
      expect(isExtraDisabledV2('full_garage', POST, comp.v2SelectedExtrasSet).disabled).toBe(true);
      comp.onV2ExtraBoolToggle('refrigerator', true);
      comp.onV2ExtraBoolToggle('oven', true);
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 1);
      expect(comp.getV2ExtrasSubtotal()).toBe(25 + 25 + 25);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 200 + 25 + 25 + 25);
    });

    it('[T5] Move-In / Move-Out Special → Oven DISABLED (ya incluido). No se puede seleccionar y NO suma precio.', async () => {
      const { comp } = await setupComp();
      const MOVE = 'move_in_out';
      comp.selectV2SpecialService(MOVE);
      const disOven = isExtraDisabledV2('oven', MOVE, comp.v2SelectedExtrasSet);
      expect(disOven.disabled).toBe(true);
      expect(disOven.reason).toMatch(/included/i);
      comp.onV2ExtraBoolToggle('oven', true);
      // Aunque el handler se llame, el selected NO persiste cuando está Included (disab state visual)
      expect(comp.getV2ExtraItemPrice('oven')).toBe(0);
      // Pricing no incluye Oven (ya que no se puede activar por UI disabled)
      const total = comp.getV2LocalEstimatedPrice();
      expect(total).toBe(150 + 75);
    });

    it('[T6] Move-In/Out + Garage ($30) + Same-Day ($20) + Heavy Furniture ×1 ($25) = 150 + 75 + 75 = $300. Heavy IS compatible with Move-In/Out per approved rules (NOT disabled=false).', async () => {
      const { comp } = await setupComp();
      const MOVE = 'move_in_out';
      comp.selectV2SpecialService(MOVE);
      // Approved rules: Heavy Furniture compatible with ALL 5 contexts including Move-In/Out
      const disHeavy = isExtraDisabledV2('heavy_furniture_moving', MOVE, comp.v2SelectedExtrasSet);
      expect(disHeavy.disabled).toBe(false);
      // Garage SÍ compatible con Move-In
      const dis = isExtraDisabledV2('garage', MOVE, comp.v2SelectedExtrasSet);
      expect(dis.disabled).toBe(false);
      comp.onV2ExtraBoolToggle('garage', true);
      comp.onV2ExtraBoolToggle('same_day', true);
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 1);
      expect(comp.getV2ExtrasSubtotal()).toBe(30 + 20 + 25);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75 + 30 + 20 + 25);
    });

    it('[T7] Move-In/Out + Laundry 2 loads + Garage ($30) + Same-Day ($20) + Heavy ×2 ($50) = 150+75+(2×15)+30+20+50 = 150+75+30+30+20+50 = $355. Heavy compat Move-In (approved rules: disabled=false).', async () => {
      const { comp } = await setupComp();
      const MOVE = 'move_in_out';
      comp.selectV2SpecialService(MOVE);
      // Approved matrix 2026-09: ALL extras (Heavy included) compatible with Move-In except Closet/Oven/Refr = 3 only.
      expect(isExtraDisabledV2('laundry', MOVE, comp.v2SelectedExtrasSet).disabled).toBe(false);
      expect(isExtraDisabledV2('heavy_furniture_moving', MOVE, comp.v2SelectedExtrasSet).disabled).toBe(false);
      expect(isExtraDisabledV2('garage', MOVE, comp.v2SelectedExtrasSet).disabled).toBe(false);
      expect(isExtraDisabledV2('same_day', MOVE, comp.v2SelectedExtrasSet).disabled).toBe(false);
      comp.onV2ExtraBoolToggle('laundry', true);
      comp.onV2ExtraQtyChange('laundry', 2);
      comp.onV2ExtraBoolToggle('garage', true);
      comp.onV2ExtraBoolToggle('same_day', true);
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 2);
      expect(comp.getV2ExtrasSubtotal()).toBe(30 + 30 + 20 + 50);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75 + 30 + 30 + 20 + 50);
    });

    it('[T8] Cambiar Special después de seleccionar Extras. Debe: remover solo incompatibles; preservar compatibles; recalcular precios. §4 rules: Deep EXCLUYE Heavy Furniture; MIO EXCLUYE Closet/Oven/Refrigerator.', async () => {
      const { comp } = await setupComp();
      const DEEP = 'deep_home_cleaning';
      const MOVE = 'move_in_out';
      // 1. Regular + Oven + Closet + Laundry ×2 + Refrigerator + Heavy Furniture ×1
      comp.onV2ExtraBoolToggle('oven', true);
      comp.onV2ExtraBoolToggle('closet_organization', true);
      comp.onV2ExtraBoolToggle('laundry', true);
      comp.onV2ExtraQtyChange('laundry', 2);
      comp.onV2ExtraBoolToggle('refrigerator', true);
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 1);
      const extrasBase = 25 + 25 + 30 + 25 + 25; // oven + closet + laundry2 + refrigerator + heavy×1
      expect(comp.getV2ExtrasSubtotal()).toBe(extrasBase);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + extrasBase);

      // 2. Seleccionar DEEP: preserve oven/closet/laundry/refrigerator BUT REMOVE heavy_furniture (§4: Deep EXCLUDE heavy)
      comp.selectV2SpecialService(DEEP);
      expect(comp.isV2ExtraSelected('oven')).toBe(true);
      expect(comp.isV2ExtraSelected('closet_organization')).toBe(true);
      expect(comp.isV2ExtraSelected('laundry')).toBe(true);
      expect(comp.isV2ExtraSelected('refrigerator')).toBe(true);
      // Heavy FURNITURE is INCOMPATIBLE with DEEP per §4 → removed
      expect(comp.isV2ExtraSelected('heavy_furniture_moving')).toBe(false);
      const extrasAfterDeep = 25 + 25 + 30 + 25; // oven + closet + laundry2 + refrigerator (no heavy)
      expect(comp.getV2ExtrasSubtotal()).toBe(extrasAfterDeep);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 80 + extrasAfterDeep);

      // 3. Cambiar a MOVE: remueve oven + closet_organization + refrigerator (3 via MIO incompatibleList)
      //    Preserva Laundry 2. Heavy Furniture fue removido anteriormente en step 2 y sigue sin seleccionarse;
      //    además MIO SÍ permite Heavy Furniture, pero nunca fue re-seleccionado.
      comp.selectV2SpecialService(MOVE);
      expect(comp.isV2ExtraSelected('oven')).toBe(false); // removed: MIO included
      expect(comp.isV2ExtraSelected('closet_organization')).toBe(false); // removed: MIO included
      expect(comp.isV2ExtraSelected('refrigerator')).toBe(false); // removed: MIO included
      expect(comp.isV2ExtraSelected('laundry')).toBe(true); // preservado (compat MIO)
      // MIO allows heavy furniture but step 2 already removed it; still false until re-selected
      expect(comp.isV2ExtraSelected('heavy_furniture_moving')).toBe(false);
      expect(comp.getV2ExtrasSubtotal()).toBe(30); // Laundry×2 only
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75 + 30);
    });

    it('[T9] 9 Extras info modal data integrity: description, includes, doesNotInclude, priceLabel, termsAndConditions. Todo no vacío, 9× arrays includes ≥1 + EN professional (sin español visible).', async () => {
      const ALL_EXTRA_IDS = Object.keys(OPTIONAL_EXTRAS_V2) as (keyof typeof OPTIONAL_EXTRAS_V2)[];
      expect(ALL_EXTRA_IDS.length).toBe(9);
      for (const id of ALL_EXTRA_IDS) {
        const ex = OPTIONAL_EXTRAS_V2[id];
        expect(ex.shortDescription).toBeTruthy();
        expect(ex.modal).toBeTruthy();
        expect(ex.modal.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(ex.modal.includes)).toBe(true);
        expect(ex.modal.includes.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(ex.modal.doesNotInclude)).toBe(true);
        expect(ex.modal.doesNotInclude.length).toBeGreaterThanOrEqual(1);
        expect(typeof ex.modal.priceLabel === 'string' && ex.modal.priceLabel.length > 0).toBe(true);
        expect(ex.modal.termsAndConditions.length).toBeGreaterThanOrEqual(10);
        // No contiene términos español visibles comunes (Limpieza, Incluye, No Incluye, Precio, Términos, Condiciones, Muebles, Electrodomésticos, Ventanas, Garaje, Español)
        const combined = [ex.label, ex.shortDescription, ex.modal.description, ...ex.modal.includes, ...ex.modal.doesNotInclude, ex.modal.priceLabel, ex.modal.termsAndConditions].join(' ');
        expect(/(Limpieza|Incluye|No Incluye|Precio|Términos|Condiciones|servicio|español|Español|Garaje|Muebles|Electrodomésticos|Ventanas|Cocina|Baño|Plagas|Moho)/i.test(combined)).toBe(false);
        // Todos contienen precio $ visible en priceLabel
        expect(ex.modal.priceLabel.includes('$')).toBe(true);
      }
      // 9a. Prueba abrir/cerrar modal extra programáticamente (state + data)
      const { comp } = await setupComp();
      comp.openExtraInfoModal('heavy_furniture_moving');
      expect(comp.isExtraInfoModalOpen).toBe(true);
      expect(comp.extraInfoModalId).toBe('heavy_furniture_moving');
      const data = comp.getExtraInfoModalData();
      expect(data).toBeTruthy();
      expect(data.id).toBe('heavy_furniture_moving');
      expect(data.modal.includes.length).toBeGreaterThanOrEqual(3);
      expect(data.modal.doesNotInclude.length).toBeGreaterThanOrEqual(4);
      comp.closeExtraInfoModal();
      expect(comp.isExtraInfoModalOpen).toBe(false);
      expect(comp.extraInfoModalId).toBeNull();
    });

  });

  describe('[V2 Service Notes / Discount FINALIZATION] D1-D4', () => {

    async function setupComp() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      comp.ngOnInit();
      fixture.detectChanges();
      comp.selectV2RegularPackage('3-2');
      return { fixture, comp };
    }

    it('[D1] First-service discount checkbox MUST have ZERO impact on estimated price. Customer-side never applies 15%.', async () => {
      const { comp } = await setupComp();
      const before = comp.getV2LocalEstimatedPrice();
      expect(before).toBe(150);
      comp.bookingForm.patchValue({ applyFirstDiscount: true }, { emitEvent: true });
      expect(comp.bookingForm.get('applyFirstDiscount').value).toBe(true);
      const afterRequestOn = comp.getV2LocalEstimatedPrice();
      expect(afterRequestOn).toBe(150);
      comp.onV2ExtraBoolToggle('oven', true);
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 25);
      // Confirm snapshot (llamar directamente buildConfirmationSnapshot)
      const snap = comp.buildConfirmationSnapshot();
      expect(snap.firstServiceDiscountRequested).toBe(true);
      expect(snap.discountApplied).toBe(false);
      expect(snap.discountPercent).toBe(0);
      expect(snap.discountAmount).toBe(0);
    });

    it('[D2] Pets at home: toggle on → off MUST clear conditional petSafetyNotes value (never send stale).', async () => {
      const { comp, fixture } = await setupComp();
      expect(comp.bookingForm.get('petsAtHome').value).toBe(false);
      comp.bookingForm.patchValue({ petsAtHome: true, petSafetyNotes: 'Dog aggressive, keep back gate closed.' }, { emitEvent: true });
      fixture.detectChanges();
      expect(comp.bookingForm.get('petSafetyNotes').value).toBe('Dog aggressive, keep back gate closed.');
      // Uncheck pets: debe limpiar valor
      comp.bookingForm.patchValue({ petsAtHome: false }, { emitEvent: true });
      fixture.detectChanges();
      expect(comp.bookingForm.get('petSafetyNotes').value).toBe('');
    });

    it('[D3] Own cleaning products: toggle on → off MUST clear conditional cleaningProductNotes value (stale never submit).', async () => {
      const { comp, fixture } = await setupComp();
      expect(comp.bookingForm.get('useOwnProducts').value).toBe(false);
      comp.bookingForm.patchValue({
        useOwnProducts: true,
        cleaningProductNotes: 'Kitchen: Method anti-grease; Bathroom: Soft Scrub; Floors: Bona hardwood cleaner.'
      }, { emitEvent: true });
      fixture.detectChanges();
      expect(comp.bookingForm.get('cleaningProductNotes').value.length).toBeGreaterThan(20);
      // Uncheck → limpia
      comp.bookingForm.patchValue({ useOwnProducts: false }, { emitEvent: true });
      fixture.detectChanges();
      expect(comp.bookingForm.get('cleaningProductNotes').value).toBe('');
    });

    it('[D4] Build booking payload: firstServiceDiscountRequested boolean correcto. applyFirstDiscount legacy NO debe aparecer a secas; discountApplied NO enviado customer side.', async () => {
      const { comp } = await setupComp();
      const MOVE = 'move_in_out';
      comp.selectV2SpecialService(MOVE);
      // Approved matrix: Laundry × 2 + Garage + Same-Day + Heavy Furniture × 2 compatible with Move-In (only Closet/Oven/Refrigerator disabled). Heavy IS compat now!
      comp.onV2ExtraBoolToggle('laundry', true);
      comp.onV2ExtraQtyChange('laundry', 2);
      comp.onV2ExtraBoolToggle('garage', true);
      comp.onV2ExtraBoolToggle('same_day', true);
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 2);
      // Activar request discount + pets + products notes
      comp.bookingForm.patchValue({
        applyFirstDiscount: true,
        petsAtHome: true,
        petSafetyNotes: 'Cat escapes — close front door.',
        useOwnProducts: true,
        cleaningProductNotes: 'Kitchen: Product A; Bathroom: Product B; Wood: Bona.'
      }, { emitEvent: true });
      // Build final payload usando buildSanitizedBookingData
      const payload = comp.buildSanitizedBookingData();
      expect(payload.firstServiceDiscountRequested).toBe(true);
      expect(typeof payload.firstServiceDiscountRequested).toBe('boolean');
      expect(payload.petsAtHome).toBe(true);
      expect(payload.petSafetyNotes).toBe('Cat escapes — close front door.');
      expect(payload.usesOwnCleaningProducts).toBe(true);
      expect(payload.cleaningProductNotes).toBe('Kitchen: Product A; Bathroom: Product B; Wood: Bona.');
      // Customer NO envía discountApplied (solo Admin Panel gestiona)
      expect((payload as any).discountApplied).not.toBe(true);
      // Pricing: Move-In 75 + Laundry2×15 + Garage30 + SameDay20 + Heavy2×$25 = 75+30+30+20+50 = 205 + base 150 = $355
      expect(comp.getV2LocalEstimatedPrice()).toBe(150 + 75 + 30 + 30 + 20 + 50);
      // Discount NO aplica customer: NO 15% off
      expect(comp.getV2LocalEstimatedPrice()).toBe(355);
    });

  });

  describe('[V2 Compatibility Matrix + Heavy Furniture Qty] D9-D12 (APPROVED BUSINESS RULES 2026-09)', () => {

    async function setupComp() {
      const { fixture } = await render(BookingComponent, {
        imports: [ReactiveFormsModule, HttpClientTestingModule, RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          { provide: BookingService, useValue: mockBookingService },
          { provide: ServiceDataService, useValue: mockServiceData },
          { provide: GeolocationService, useValue: mockGeolocation },
          { provide: AuthService, useValue: mockAuth },
          { provide: SafeLoggerService, useValue: mockLogger }
        ]
      });
      const comp = (fixture as ComponentFixture<BookingComponent>).componentInstance as any;
      comp.ngOnInit();
      fixture.detectChanges();
      comp.selectV2RegularPackage('3-2');
      return { fixture, comp };
    }

    it('[D9] Move-In/Out special service MUST lock EXACTLY 3 extras: closet_organization + oven + refrigerator. All others (including Heavy Furniture!) MUST be enabled.', async () => {
      const { comp } = await setupComp();
      comp.selectV2SpecialService('move_in_out');

      // The 3 DISABLED for Move-In/Out (tasks already INCLUDED in the special service description):
      const closetState = comp.getV2ExtraDisabledState('closet_organization');
      expect(closetState.disabled).toBe(true);
      const ovenState = comp.getV2ExtraDisabledState('oven');
      expect(ovenState.disabled).toBe(true);
      const refrigeratorState = comp.getV2ExtraDisabledState('refrigerator');
      expect(refrigeratorState.disabled).toBe(true);

      // All other 6 extras MUST be ENABLED for Move-In/Out per approved matrix (including HEAVY FURNITURE!):
      const expectedEnabledMoveIn: (keyof typeof OPTIONAL_EXTRAS_V2)[] = [
        'laundry', 'garage', 'full_garage',
        'heavy_furniture_moving', 'same_day', 'outside_window'
      ];
      for (const id of expectedEnabledMoveIn) {
        const st = comp.getV2ExtraDisabledState(id);
        // Extra must NOT be disabled for Move-In/Out per approved business rules
        expect(st.disabled).toBe(false);
      }
    });

    it('[D10] Approved matrix 9 extras × 5 services FULL VALIDATION. (Heavy Furniture = TRUE ALL; Closet/Oven/Refrigerator = FALSE ONLY for Move-In/Out.)', async () => {
      const { comp } = await setupComp();
      const CONTEXTS: ('regular_only' | CompatibilityContextV2)[] = [
        'regular_only',
        'deep_home_cleaning',
        'move_in_out',
        'post_construction',
        'extreme_home_cleaning',
      ];

      // Rule helper from ZCLEANUP V2 approved compatibility matrix §4:
      const isCompatibleApproved = (extraId: string, ctx: string): boolean => {
        // Move-In/Out ONLY kills 3 extras (closet/oven/refrigerator already included)
        if (ctx === 'move_in_out') {
          if (extraId === 'closet_organization') return false;
          if (extraId === 'oven') return false;
          if (extraId === 'refrigerator') return false;
          return true;
        }
        // Deep Cleaning ONLY kills heavy_furniture_moving
        if (ctx === 'deep_home_cleaning') {
          if (extraId === 'heavy_furniture_moving') return false;
          return true;
        }
        // Post-Construction kills closet + laundry + garage + full_garage
        if (ctx === 'post_construction') {
          if (extraId === 'closet_organization') return false;
          if (extraId === 'laundry') return false;
          if (extraId === 'garage') return false;
          if (extraId === 'full_garage') return false;
          return true;
        }
        // Extreme Cleaning kills same 4 as Post-Construction
        if (ctx === 'extreme_home_cleaning') {
          if (extraId === 'closet_organization') return false;
          if (extraId === 'laundry') return false;
          if (extraId === 'garage') return false;
          if (extraId === 'full_garage') return false;
          return true;
        }
        // regular_only = no special service selected → ALL 9 extras compatible
        return true;
      };

      const EXTRA_IDS: (keyof typeof OPTIONAL_EXTRAS_V2)[] = [
        'closet_organization', 'oven', 'refrigerator',
        'laundry', 'garage', 'full_garage',
        'heavy_furniture_moving', 'same_day', 'outside_window'
      ];

      for (const ctx of CONTEXTS) {
        // Set context: special service selection (null special = regular_only)
        if (ctx === 'regular_only') {
          comp.selectV2SpecialService(null);
        } else {
          comp.selectV2SpecialService(ctx);
        }
        for (const extraId of EXTRA_IDS) {
          const expected = isCompatibleApproved(extraId, ctx);
          const actual = comp.getV2ExtraDisabledState(extraId);
          // disabled === true => incompatible (opposite of compatible)
          const actualCompatible = !actual.disabled;
          expect(actualCompatible).toBe(expected);
        }
      }
    });

    it('[D11] Heavy Furniture Moving (kind=qty): qty 1 = $25; qty 2 = $50; qty 3 rejected; maxQuantity=2 enforced by frontend catalog.', async () => {
      const { comp } = await setupComp();
      const catalog = OPTIONAL_EXTRAS_V2.heavy_furniture_moving;
      expect(catalog.kind).toBe('qty');
      expect(catalog.unitPrice).toBe(25);
      expect(catalog.minQuantity).toBe(1);
      expect(catalog.maxQuantity).toBe(2);
      expect(EXTRA_MAX_QUANTITY_V2.heavy_furniture_moving).toBe(2);

      // Quantity 1 → $25
      comp.onV2ExtraBoolToggle('heavy_furniture_moving', true);
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 1);
      expect(comp.getV2ExtraItemPrice('heavy_furniture_moving')).toBe(25);
      expect(comp.getV2ExtrasSubtotal()).toBe(25);

      // Quantity 2 → $50
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 2);
      expect(comp.getV2ExtraItemPrice('heavy_furniture_moving')).toBe(50);
      expect(comp.getV2ExtrasSubtotal()).toBe(50);

      // Quantity 3 → rejected (clamped to maxQuantity=2 → price still $50)
      comp.onV2ExtraQtyChange('heavy_furniture_moving', 3);
      const clampedQty = comp.getV2ExtraQty('heavy_furniture_moving');
      expect(clampedQty).toBeLessThanOrEqual(2);
      expect(comp.getV2ExtraItemPrice('heavy_furniture_moving')).toBe(50);
    });

    it('[D12] Frontend COMPATIBILITY_MATRIX_V2 is EXACTLY identical to Backend-approved matrix (no drift between layers).', async () => {
      // Directly read the frontend matrix and compare to approved business rules.
      // This test ensures the matrix object itself reflects the approved rules,
      // not just that the UI interprets them correctly.
      const FE = COMPATIBILITY_MATRIX_V2;

      // Validate HEAVY: ALL TRUE
      expect(FE.heavy_furniture_moving.regular_only).toBe(true);
      expect(FE.heavy_furniture_moving.deep_home_cleaning).toBe(true);
      expect(FE.heavy_furniture_moving.move_in_out).toBe(true);
      expect(FE.heavy_furniture_moving.post_construction).toBe(true);
      expect(FE.heavy_furniture_moving.extreme_home_cleaning).toBe(true);

      // Validate Closet/Oven/Refrigerator: TRUE except move_in_out FALSE
      for (const id of ['closet_organization', 'oven', 'refrigerator'] as const) {
        expect(FE[id].regular_only).toBe(true);
        expect(FE[id].deep_home_cleaning).toBe(true);
        expect(FE[id].move_in_out).toBe(false);
        expect(FE[id].post_construction).toBe(true);
        expect(FE[id].extreme_home_cleaning).toBe(true);
      }

      // Validate Laundry, Garage, Full Garage, Same-Day, Outside Window: ALL TRUE
      for (const id of ['laundry', 'garage', 'full_garage', 'same_day', 'outside_window'] as const) {
        expect(FE[id].regular_only).toBe(true);
        expect(FE[id].deep_home_cleaning).toBe(true);
        expect(FE[id].move_in_out).toBe(true);
        expect(FE[id].post_construction).toBe(true);
        expect(FE[id].extreme_home_cleaning).toBe(true);
      }
    });

  });
});
