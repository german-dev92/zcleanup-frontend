import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BookingService } from '../../core/services/booking.service';
import { SafeLoggerService } from '../../core/services/safe-logger.service';
import { sanitizeEmail, sanitizeMultiline, sanitizeText } from '../../shared/security/input-sanitizer';
import { noControlChars, noHtmlLikeInput, trimmedMinLength } from '../../shared/security/security-validators';

export type CustomQuoteRequestType =
  | 'commercial_cleaning'
  | 'deep_cleaning_large'
  | 'hoarding'
  | 'post_construction_large'
  | 'other';

export interface CustomQuoteRequestTypeOption {
  id: CustomQuoteRequestType;
  label: string;
  hint: string;
}

export const CUSTOM_QUOTE_REQUEST_TYPES: CustomQuoteRequestTypeOption[] = [
  {
    id: 'commercial_cleaning',
    label: 'Commercial / Office Cleaning',
    hint: 'Offices, retail spaces, warehouses, etc.',
  },
  {
    id: 'deep_cleaning_large',
    label: 'Large / Extra Deep Cleaning',
    hint: 'Properties requiring heavier work than standard.',
  },
  {
    id: 'hoarding',
    label: 'Hoarding / Extreme Cleanup',
    hint: 'Cluttered or extreme-condition properties.',
  },
  {
    id: 'post_construction_large',
    label: 'Large Post-Construction',
    hint: 'Full-home or large-area post-remodel cleanup.',
  },
  {
    id: 'other',
    label: 'Other / Special Request',
    hint: 'Anything that does not fit the standard catalog.',
  },
];

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS_COUNT = 10;

interface PhotoPreview {
  file: File;
  url: string;
  sizeKB: number;
}

@Component({
  selector: 'app-custom-quote',
  templateUrl: './custom-quote.component.html',
  styleUrls: ['./custom-quote.component.scss']
})
export class CustomQuoteComponent implements OnInit, OnDestroy {
  quoteForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  submitMessage = '';
  readonly requestTypes = CUSTOM_QUOTE_REQUEST_TYPES;
  readonly MAX_PHOTOS = MAX_PHOTOS_COUNT;

  selectedPhotos: PhotoPreview[] = [];
  photoErrors: string[] = [];

  private subs = new Subscription();

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private logger: SafeLoggerService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearPhotoPreviews();
  }

  private initForm(): void {
    this.quoteForm = this.fb.group({
      name: ['', [
        Validators.required,
        trimmedMinLength(2),
        Validators.maxLength(100),
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
      address: ['', [
        Validators.required,
        trimmedMinLength(8),
        Validators.maxLength(300),
        noHtmlLikeInput(),
        noControlChars()
      ]],
      requestType: ['', [
        Validators.required
      ]],
      description: ['', [
        Validators.required,
        trimmedMinLength(20),
        Validators.maxLength(2000),
        noHtmlLikeInput(),
        noControlChars()
      ]],
    });
  }

  get totalPhotosSizeKB(): number {
    const bytes = this.selectedPhotos.reduce((s, p) => s + p.file.size, 0);
    return Math.round(bytes / 1024);
  }

  get descriptionLength(): number {
    const v = this.quoteForm?.get('description')?.value;
    return typeof v === 'string' ? v.length : 0;
  }

  get descriptionBelowMin(): boolean {
    const desc = this.quoteForm?.get('description');
    if (!desc) return true;
    const touched = desc.dirty || desc.touched;
    if (!touched) return false;
    return this.descriptionLength > 0 && this.descriptionLength < 20;
  }

  get descriptionAtMinOrMore(): boolean {
    return this.descriptionLength >= 20;
  }

  onPhotoFilesSelected(event: Event): void {
    this.photoErrors = [];
    const target = event.target as HTMLInputElement | null;
    if (!target || !target.files || target.files.length === 0) return;

    const newFiles = Array.from(target.files);
    for (const file of newFiles) {
      if (this.selectedPhotos.length >= MAX_PHOTOS_COUNT) {
        this.photoErrors.push(`Maximum ${MAX_PHOTOS_COUNT} photos allowed.`);
        break;
      }

      const allowed = /^image\/(png|jpe?g|webp)$/i;
      if (!allowed.test(file.type)) {
        this.photoErrors.push(`Skipped "${file.name}": invalid type "${file.type}". Allowed: PNG, JPG, JPEG, WEBP.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        this.photoErrors.push(`Skipped "${file.name}": exceeds ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB per photo.`);
        continue;
      }
      const totalNow = this.selectedPhotos.reduce((s, p) => s + p.file.size, 0);
      if (totalNow + file.size > MAX_TOTAL_BYTES) {
        this.photoErrors.push(`Skipped "${file.name}": total size limit ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB would be exceeded.`);
        continue;
      }

      const url = URL.createObjectURL(file);
      this.selectedPhotos.push({
        file,
        url,
        sizeKB: Math.round(file.size / 1024)
      });
    }

    if (target) {
      target.value = '';
    }
  }

  removePhoto(index: number): void {
    const item = this.selectedPhotos[index];
    if (!item) return;
    URL.revokeObjectURL(item.url);
    this.selectedPhotos.splice(index, 1);
  }

  private clearPhotoPreviews(): void {
    for (const p of this.selectedPhotos) {
      try {
        URL.revokeObjectURL(p.url);
      } catch {
        /* ignore */
      }
    }
    this.selectedPhotos = [];
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quoteForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    this.photoErrors = [];
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      return;
    }

    const raw = this.quoteForm.value;
    const name = sanitizeText(raw.name, { maxLength: 100 });
    const email = sanitizeEmail(raw.email, { maxLength: 254 });
    const address = sanitizeText(raw.address, { maxLength: 300 });
    const requestType = sanitizeText(raw.requestType, { maxLength: 60 });
    const description = sanitizeMultiline(raw.description, { maxLength: 2000 });

    if (!name || !email || !address || !requestType || !description) {
      this.quoteForm.markAllAsTouched();
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('email', email);
    fd.append('address', address);
    fd.append('requestType', requestType);
    fd.append('description', description);
    for (const p of this.selectedPhotos) {
      fd.append('photos', p.file, p.file.name);
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = false;
    this.submitMessage = '';

    this.subs.add(
      this.bookingService.submitCustomQuote(fd).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.submitSuccess = true;
          this.submitMessage =
            (response && typeof response === 'object' && 'message' in response && typeof (response as any).message === 'string')
              ? (response as any).message
              : 'Your Custom Quote request has been sent successfully.';
          this.quoteForm.reset();
          this.clearPhotoPreviews();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitSuccess = false;
          const fallback = 'An error occurred while sending your request. Please try again later.';
          let msg = fallback;
          try {
            if (err && typeof err === 'object') {
              const errAny = err as any;
              const candidateMsg =
                errAny.error?.message ??
                errAny.message ??
                (Array.isArray(errAny.error?.errors) ? errAny.error.errors.join('; ') : undefined);
              if (typeof candidateMsg === 'string' && candidateMsg.length > 0) {
                msg = candidateMsg;
              }
            }
          } catch {
            /* ignore */
          }
          this.submitError = msg;
          this.logger.error('Custom Quote submit error', err);
        }
      })
    );
  }
}
