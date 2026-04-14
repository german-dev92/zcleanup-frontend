import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function noHtmlLikeInput(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null;
    if (typeof value !== 'string') return null;
    return /[<>]/.test(value) ? { unsafeInput: true } : null;
  };
}

export function trimmedMinLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null;
    if (typeof value !== 'string') return null;
    return value.trim().length < min ? { trimmedMinLength: { requiredLength: min } } : null;
  };
}

export function noControlChars(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null;
    if (typeof value !== 'string') return null;
    return /[\u0000-\u001F\u007F]/.test(value) ? { controlChars: true } : null;
  };
}
