import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService } from '../../core/services/contact.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { sanitizeEmail, sanitizeMultiline, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {
  contactForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitMessage = '';

  // Map options
  mapCenter: google.maps.LatLngLiteral = { lat: 27.9506, lng: -82.4572 }; // Tampa center
  mapOptions: google.maps.MapOptions = {
    zoom: 9.5,
    scrollwheel: true,
    disableDefaultUI: false,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };
  
  markers: any[] = [];
  circles: any[] = [];

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private geolocationService: GeolocationService,
    private logger: SafeLoggerService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initMapData();
  }

  initMapData(): void {
    const cities = this.geolocationService.getCoverageCitiesDetails();
    const primaryColor = '#3498db'; // Default primary blue color
    const googleAnimationDrop = (window as any)?.google?.maps?.Animation?.DROP;

    this.markers = cities.map(city => ({
      position: { lat: city.lat, lng: city.lng },
      label: {
        text: city.name,
        color: '#2c3e50',
        fontWeight: 'bold',
        fontSize: '12px'
      },
      title: city.name,
      options: googleAnimationDrop ? { animation: googleAnimationDrop } : {}
    }));

    this.circles = cities.map(city => ({
      center: { lat: city.lat, lng: city.lng },
      radius: city.radiusKm * 1000, // Convert Km to meters
      options: {
        strokeColor: primaryColor,
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: primaryColor,
        fillOpacity: 0.2,
        clickable: false,
        editable: false,
        zIndex: 1
      }
    }));
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
