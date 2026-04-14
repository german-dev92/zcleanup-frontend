export type SanitizerOptions = {
  maxLength?: number;
  preserveNewlines?: boolean;
};

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const ANGLE_BRACKETS = /[<>]/g;

export function sanitizeText(input: unknown, options: SanitizerOptions = {}): string {
  if (input == null) return '';
  let value = String(input);

  value = value.replace(CONTROL_CHARS, '');
  value = value.replace(ANGLE_BRACKETS, '');
  value = value.replace(/\s+/g, (m) => (options.preserveNewlines && m.includes('\n') ? '\n' : ' '));
  value = value.trim();

  if (options.maxLength != null && options.maxLength >= 0) {
    value = value.slice(0, options.maxLength);
  }

  return value;
}

export function sanitizeEmail(input: unknown, options: SanitizerOptions = {}): string {
  const cleaned = sanitizeText(input, { maxLength: options.maxLength ?? 254 });
  return cleaned.replace(/\s+/g, '').toLowerCase();
}

export function sanitizeAddress(input: unknown, options: SanitizerOptions = {}): string {
  let value = sanitizeText(input, { maxLength: options.maxLength ?? 160 });
  value = value.replace(/[`]/g, '');
  return value;
}

export function sanitizeMultiline(input: unknown, options: SanitizerOptions = {}): string {
  if (input == null) return '';
  let value = String(input);
  value = value.replace(CONTROL_CHARS, '');
  value = value.replace(ANGLE_BRACKETS, '');
  value = value.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
  value = value.replace(/\n{3,}/g, '\n\n');
  value = value.trim();
  if (options.maxLength != null && options.maxLength >= 0) {
    value = value.slice(0, options.maxLength);
  }
  return value;
}

export function sanitizeObjectDeep<T>(value: T, sanitizeString: (s: string) => string): T {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value) as unknown as T;
  if (Array.isArray(value)) return value.map(v => sanitizeObjectDeep(v, sanitizeString)) as unknown as T;
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      out[k] = sanitizeObjectDeep(v, sanitizeString);
    }
    return out as T;
  }
  return value;
}
