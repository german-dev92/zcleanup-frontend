import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as L from 'leaflet';
import { ContactService } from '../../core/services/contact.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { CoverageCity } from '../../core/models/location.model';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { sanitizeEmail, sanitizeMultiline, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';

const LEAFLET_PRIMARY_COLOR = '#2c7fb8';
const LEAFLET_CIRCLE_FILL_OPACITY = 0.18;
const LEAFLET_CIRCLE_BORDER_WEIGHT = 2.5;
const LEAFLET_CIRCLE_BORDER_OPACITY = 0.9;
const LEAFLET_KM_PER_DEG_LAT = 111;

const configureLeafletIcons = (): void => {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
    iconUrl: 'assets/leaflet/marker-icon.png',
    shadowUrl: 'assets/leaflet/marker-shadow.png'
  });
};

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {
  contactForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitMessage = '';

  private coverageMap: L.Map | null = null;
  private mapLayers: L.Layer[] = [];

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private geolocationService: GeolocationService,
    private logger: SafeLoggerService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngAfterViewInit(): void {
    this.initCoverageMap();
  }

  ngOnDestroy(): void {
    if (this.coverageMap) {
      this.coverageMap.remove();
      this.coverageMap = null;
    }
    this.mapLayers = [];
  }

  private initCoverageMap(): void {
    if (this.coverageMap) return;

    const container = document.getElementById('coverage-map');
    if (!container) return;

    configureLeafletIcons();

    const map = L.map(container, {
      scrollWheelZoom: false,
      attributionControl: true,
      minZoom: 10,
      maxZoom: 15
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const cities = this.geolocationService.getCoverageCitiesDetails();
    const bounds = L.latLngBounds([]);

    cities.forEach((city) => {
      const cityBounds = this.addCoverageCity(map, city);
      bounds.extend(cityBounds);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12), { maxZoom: 12 });
    }

    this.coverageMap = map;
  }

  private addCoverageCity(map: L.Map, city: CoverageCity): L.LatLngBounds {
    const latLng: L.LatLngTuple = [city.lat, city.lng];
    const radiusMeters = city.radiusKm * 1000;

    const circle = L.circle(latLng, {
      radius: radiusMeters,
      color: LEAFLET_PRIMARY_COLOR,
      opacity: LEAFLET_CIRCLE_BORDER_OPACITY,
      weight: LEAFLET_CIRCLE_BORDER_WEIGHT,
      fillColor: LEAFLET_PRIMARY_COLOR,
      fillOpacity: LEAFLET_CIRCLE_FILL_OPACITY,
      interactive: false
    }).addTo(map);

    const marker = L.marker(latLng, {
      title: city.name,
      alt: city.name
    }).bindTooltip(city.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -12],
      className: 'coverage-city-tooltip'
    }).addTo(map);

    this.mapLayers.push(circle, marker);

    return this.computeCircleBounds(city.lat, city.lng, city.radiusKm);
  }

  private computeCircleBounds(lat: number, lng: number, radiusKm: number): L.LatLngBounds {
    const deltaLat = radiusKm / LEAFLET_KM_PER_DEG_LAT;
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const deltaLng = radiusKm / (LEAFLET_KM_PER_DEG_LAT * cosLat);

    const southWest: L.LatLngTuple = [lat - deltaLat, lng - deltaLng];
    const northEast: L.LatLngTuple = [lat + deltaLat, lng + deltaLng];
    return L.latLngBounds(southWest, northEast);
  }

  initForm(): void {
    this.contactForm = this.fb.group({
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
      subject: ['', [Validators.required]],
      message: ['', [
        Validators.required,
        trimmedMinLength(20),
        Validators.maxLength(1500),
        noHtmlLikeInput(),
        noControlChars()
      ]]
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = {
      ...this.contactForm.value,
      name: sanitizeText(this.contactForm.value?.name, { maxLength: 60 }),
      email: sanitizeEmail(this.contactForm.value?.email, { maxLength: 254 }),
      subject: sanitizeText(this.contactForm.value?.subject, { maxLength: 80 }),
      message: sanitizeMultiline(this.contactForm.value?.message, { maxLength: 1500 })
    };

    this.contactService.sendMessage(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.submitMessage = response.message;
        this.contactForm.reset();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitSuccess = false;
        this.submitMessage = 'An error occurred. Please try again later.';
        this.logger.error('Contact error', error);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
