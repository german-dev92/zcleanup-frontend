import { Injectable, Optional } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, TimeoutError, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, timeout } from 'rxjs/operators';
import { CoverageCity, LocationResult } from '../models/location.model';

interface NominatimAddressDetails {
  state?: string;
  country_code?: string;
  [key: string]: unknown;
}

interface NominatimSearchResult {
  readonly lat?: unknown;
  readonly lon?: unknown;
  readonly display_name?: unknown;
  readonly address?: NominatimAddressDetails;
  readonly error?: unknown;
  [key: string]: unknown;
}

interface NominatimReverseResult {
  readonly lat?: unknown;
  readonly lon?: unknown;
  readonly display_name?: unknown;
  readonly address?: NominatimAddressDetails;
  readonly error?: unknown;
  [key: string]: unknown;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

/**
 * Caché en memoria local por instancia del servicio para reducir llamadas
 * repetidas a Nominatim y disminuir el riesgo de HTTP 429 (rate limit).
 *
 * - TTL de 5 minutos; las entradas expiradas se ignoran y purgan al consultarse.
 * - Las claves de dirección se normalizan (trim, minúsculas, espacios consecutivos colapsados).
 * - Las claves de reverse usan lat/lng truncados a 5 decimales (~1 m de precisión).
 * - No se cachean errores ni respuestas null; solo resultados válidos.
 * - Solicitudes idénticas concurrentes comparten el mismo Observable (shareReplay)
 *   para evitar duplicados mientras la petición está en curso.
 *
 * Esta caché es por navegador/instancia; no sustituye Redis ni un proxy backend.
 */
@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  private static readonly NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
  private static readonly MIN_ADDRESS_LENGTH = 5;
  private static readonly MIN_LAT = -90;
  private static readonly MAX_LAT = 90;
  private static readonly MIN_LON = -180;
  private static readonly MAX_LON = 180;
  private static readonly COORD_KEY_DECIMALS = 5;

  // Timeout razonable para UX: evita que la petición se quede colgada
  // indefinidamente cuando el proveedor o la red están degradados.
  private static readonly REQUEST_TIMEOUT_MS = 5000;

  // TTL de la caché local para reducir presión sobre Nominatim.
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private readonly geocodeCache = new Map<string, CacheEntry<LocationResult>>();
  private readonly reverseCache = new Map<string, CacheEntry<string>>();
  private readonly inFlightRequests = new Map<string, Observable<unknown>>();

  private readonly coverageArea: CoverageCity[] = [
    { name: 'Tampa', lat: 27.9506, lng: -82.4572, radiusKm: 22 },
    { name: 'Brandon', lat: 27.9378, lng: -82.2859, radiusKm: 8 },
    { name: 'Odessa', lat: 28.1822, lng: -82.5695, radiusKm: 15 },
    { name: 'Wesley Chapel', lat: 28.1858, lng: -82.3500, radiusKm: 11 },
    { name: 'New Port Richey', lat: 28.2442, lng: -82.7193, radiusKm: 11 },
    { name: 'Saint Petersburg', lat: 27.7676, lng: -82.6403, radiusKm: 11 },
    { name: 'Clearwater', lat: 27.9659, lng: -82.8001, radiusKm: 11 },
    { name: 'Palm Harbor', lat: 28.0781, lng: -82.7637, radiusKm: 11 },
    { name: 'Bardmoor', lat: 27.8586, lng: -82.7494, radiusKm: 11 },
    { name: 'Oldsmar', lat: 28.0486, lng: -82.6697, radiusKm: 9 }
  ];

  constructor(@Optional() private readonly http: HttpClient | null = null) {}

  /**
   * Geocodifica una dirección (texto) en coordenadas.
   * Restringe los resultados a Estados Unidos y valida que la respuesta
   * pertenezca a Florida (nuestra única zona operativa).
   *
   * Estrategia ROBUSTA de geocodificación:
   *  Paso 1 (Full Query): búsqueda free-text completa.
   *  Paso 2 (Fallback Structured/Relaxed): si el Paso 1 devuelve 0 resultados,
   *    reintentar con una consulta estructurada (street + postalcode + state +
   *    country) o una relajada (número + calle + zip + estado) eliminando
   *    cualquier token de ciudad/localidad que Nominatim no reconozca.
   *    Esto resuelve discrepancias como Cheval (que en OSM pertenece al CDP
   *    "Cheval" pero el usuario escribe Lutz), Land O' Lakes, Trinity, etc.
   *    NUNCA hardcodea nombres concretos de ciudades.
   */
  geocodeAddress(address: string): Observable<LocationResult | null> {
    const trimmed = typeof address === 'string' ? address.trim() : '';
    if (trimmed.length < GeolocationService.MIN_ADDRESS_LENGTH) return of(null);
    if (!this.http) return of(null);

    const cacheKey = this.normalizeAddressKey(trimmed);
    const cached = this.readCache(this.geocodeCache, cacheKey);
    if (cached !== null) return of(cached);

    const inFlightKey = `geo:${cacheKey}`;
    const existing = this.inFlightRequests.get(inFlightKey);
    if (existing) return existing as Observable<LocationResult | null>;

    const biasedQuery = this.buildBiasedQuery(trimmed);
    const request$ = this.runGeocodeStrategy(trimmed, biasedQuery, cacheKey, inFlightKey);
    this.inFlightRequests.set(inFlightKey, request$);
    return request$;
  }

  /**
   * Construye la query biased añadiendo ", FL, USA"
   * SOLAMENTE si el texto del usuario no contiene ya los tokens que
   * aseguran la restricción geográfica.
   * Evita endings tales como: `..., FL 33558, FL, USA`.
   */
  private buildBiasedQuery(trimmed: string): string {
    const upper = trimmed.toUpperCase();
    const hasState = /(?:^|[^A-Z])(FL|FLORIDA)(?:$|[^A-Z])/.test(upper);
    const hasCountry = /(?:^|[^A-Z])(US|USA|UNITED\s+STATES|UNITED\s+STATES\s+OF\s+AMERICA|U\.S\.A?\.?|AMERICA)(?:$|[^A-Z])/.test(upper);
    if (hasState && hasCountry) return trimmed;
    if (hasState) return `${trimmed}, USA`;
    if (hasCountry) return `${trimmed}, FL`;
    return `${trimmed}, FL, USA`;
  }

  private runGeocodeStrategy(
    trimmed: string,
    biasedQuery: string,
    cacheKey: string,
    inFlightKey: string,
  ): Observable<LocationResult | null> {
    const url = GeolocationService.NOMINATIM_BASE + '/search';
    const firstHeaders = { Accept: 'application/json' };
    const firstParams = {
      q: biasedQuery,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'us',
    };

    const STEP1_VALID_RESULT = 'valid';
    const STEP1_EMPTY_ARRAY = 'empty';
    const STEP1_INVALID_RESULT = 'invalid';
    const STEP1_ERROR = 'error';

    const firstRequest$ = this.http!
      .get<unknown>(url, { params: firstParams, headers: firstHeaders })
      .pipe(
        timeout(GeolocationService.REQUEST_TIMEOUT_MS),
        map((payload) => {
          const isEmptyArray = Array.isArray(payload) && payload.length === 0;
          if (isEmptyArray) {
            return { kind: STEP1_EMPTY_ARRAY };
          }
          const extracted = this.extractLocationFromSearch(payload, biasedQuery);
          if (extracted === null) {
            return { kind: STEP1_INVALID_RESULT };
          }
          return { kind: STEP1_VALID_RESULT, value: extracted };
        }),
        catchError((err) => this.handleNominatimError(err, { kind: STEP1_ERROR })),
      );

    return firstRequest$.pipe(
      switchMap((firstOut: any) => {
        if (firstOut?.kind === STEP1_VALID_RESULT) {
          return of(firstOut.value as LocationResult);
        }
        if (firstOut?.kind === STEP1_ERROR || firstOut?.kind === STEP1_INVALID_RESULT) {
          return of(null);
        }
        const fallback = this.buildFallbackRequest(trimmed, url, firstHeaders);
        if (!fallback) {
          return of(null);
        }
        return this.http!
          .get<unknown>(url, { params: fallback.params, headers: firstHeaders })
          .pipe(
            timeout(GeolocationService.REQUEST_TIMEOUT_MS),
            map((payload) => this.extractLocationFromSearch(payload, fallback.fallbackQueryDisplay)),
            catchError((err) => this.handleNominatimError<LocationResult | null>(err, null)),
          );
      }),
      map((result) => {
        if (result !== null) {
          this.writeCache(this.geocodeCache, cacheKey, result);
        }
        return result;
      }),
      finalize(() => this.inFlightRequests.delete(inFlightKey)),
      shareReplay({ bufferSize: 1, refCount: false }),
    ) as Observable<LocationResult | null>;
  }

  /**
   * Construye una solicitud fallback cuando la consulta free-text devuelve
   * vacío. Intenta primero parámetros estructurados (street / postalcode /
   * state / country); si no dispone de suficientes componentes cae en una
   * query free-text relajada con los tokens más confiables.
   *
   * Reglas generales (NUNCA hardcodea nombres de ciudades concretas):
   *  - Se conservan: número, nombre de vía, código postal, estado, país.
   *  - Se descartan: tokens de localidad/town/city que a menudo generan
   *    no-match en zonas suburbanas, CDPs, unincorporated, límites ambiguos.
   */
  private buildFallbackRequest(
    trimmed: string,
    url: string,
    headers: { Accept: string },
  ): { params: Record<string, string>; fallbackQueryDisplay: string } | null {
    const postal = this.extractUsZip(trimmed);
    const street = this.extractStreetNumber(trimmed);
    const stateCountry = 'FL, USA';

    const structuredIfPossible: { params?: Record<string, string>; display?: string } = {};
    if (street.length >= 5 && postal.length === 5) {
      structuredIfPossible.params = {
        street,
        postalcode: postal,
        state: 'Florida',
        country: 'us',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '1',
      };
      structuredIfPossible.display = `[Structured] street=${street} postalcode=${postal} state=Florida country=us`;
    }

    if (structuredIfPossible.params) {
      return {
        params: structuredIfPossible.params,
        fallbackQueryDisplay:
          structuredIfPossible.display ?? `${street} ${postal} ${stateCountry}`,
      };
    }

    // Fallback relaxed: número + vía + zip + estado/pais
    const relaxedParts: string[] = [];
    if (street.length > 0) relaxedParts.push(street);
    if (postal.length > 0) relaxedParts.push(postal);
    if (relaxedParts.length === 0) return null;
    relaxedParts.push(stateCountry);
    const relaxedQ = relaxedParts.join(', ');

    const params: Record<string, string> = {
      q: relaxedQ,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'us',
    };
    return { params, fallbackQueryDisplay: relaxedQ };
  }

  private extractUsZip(trimmed: string): string {
    const m = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
    return m ? m[1] : '';
  }

  /**
   * Extrae "número + nombre de vía" de una dirección estilo US.
   * Toma la porción ANTES de la primera coma que contenga un token de
   * vía (Blvd, Ave, St, Dr, Way, Rd, Cir, Ct, Pl, Ln, Hwy, Pike, Blvd, etc)
   * o simplemente la primera coma si no detecta vía; si no hay coma, todo
   * el texto hasta que aparezca un token tipo ciudad/postal/estado.
   */
  private extractStreetNumber(trimmed: string): string {
    const commaIdx = trimmed.indexOf(',');
    const firstChunk = commaIdx >= 0 ? trimmed.substring(0, commaIdx).trim() : trimmed;
    const zip = this.extractUsZip(firstChunk);
    if (zip.length > 0) {
      const beforeZip = firstChunk.replace(zip, '').replace(/[-]/g, '').trim();
      if (beforeZip.length > 0) return beforeZip;
    }
    return firstChunk;
  }

  /**
   * Realiza geocodificación inversa a partir de coordenadas y devuelve
   * la dirección formateada o null si no se pudo resolver.
   */
  reverseGeocode(lat: number, lng: number): Observable<string | null> {
    if (!this.isValidLat(lat) || !this.isValidLon(lng)) return of(null);
    if (!this.http) return of(null);

    const cacheKey = this.normalizeReverseKey(lat, lng);
    const cached = this.readCache(this.reverseCache, cacheKey);
    if (cached !== null) return of(cached);

    const inFlightKey = `rev:${cacheKey}`;
    const existing = this.inFlightRequests.get(inFlightKey);
    if (existing) return existing as Observable<string | null>;

    const url = GeolocationService.NOMINATIM_BASE + '/reverse';
    const params = {
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1'
    };

    const request$ = this.http
      .get<unknown>(url, {
        params,
        headers: { Accept: 'application/json' }
      })
      .pipe(
        timeout(GeolocationService.REQUEST_TIMEOUT_MS),
        map((payload) => this.extractAddressFromReverse(payload)),
        catchError((err) => this.handleNominatimError<string | null>(err, null)),
        map((result) => {
          if (result !== null && result.length > 0) {
            this.writeCache(this.reverseCache, cacheKey, result);
          }
          return result;
        }),
        finalize(() => this.inFlightRequests.delete(inFlightKey)),
        shareReplay({ bufferSize: 1, refCount: false })
      ) as Observable<string | null>;

    this.inFlightRequests.set(inFlightKey, request$);
    return request$;
  }

  getCoverageCities(): string[] {
    return this.coverageArea.map((c) => c.name);
  }

  getCoverageCitiesDetails(): CoverageCity[] {
    return [...this.coverageArea];
  }

  private extractLocationFromSearch(
    payload: unknown,
    fallbackQuery: string
  ): LocationResult | null {
    if (!Array.isArray(payload) || payload.length === 0) return null;
    const first = payload[0] as NominatimSearchResult | null | undefined;
    if (!first || typeof first !== 'object') return null;
    if (first.error) return null;

    const parsedLat = this.parseCoordinate(first.lat);
    const parsedLng = this.parseCoordinate(first.lon);
    if (parsedLat === null || parsedLng === null) return null;
    if (!this.isValidLat(parsedLat) || !this.isValidLon(parsedLng)) return null;

    const address = first.address;
    const countryCode = address?.country_code;
    const isInUS =
      typeof countryCode === 'string' &&
      (countryCode.toLowerCase() === 'us' || countryCode.toLowerCase() === 'usa');
    if (!isInUS) return null;

    // La operación actual sólo cubre Florida. Filtramos aquí para no devolver
    // falsos positivos a estados vecinos que coinciden por nombre.
    const isInFlorida =
      address?.state === 'Florida' ||
      address?.state === 'FL';
    if (!isInFlorida) return null;

    const displayName = first.display_name;
    return {
      lat: parsedLat,
      lng: parsedLng,
      address: typeof displayName === 'string' && displayName.length > 0
        ? displayName
        : fallbackQuery
    };
  }

  private extractAddressFromReverse(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const result = payload as NominatimReverseResult;
    if (result.error) return null;
    const displayName = result.display_name;
    return typeof displayName === 'string' && displayName.length > 0 ? displayName : null;
  }

  private handleNominatimError<T>(err: unknown, fallback: T): Observable<T> {
    if (err instanceof TimeoutError) return of(fallback);
    if (err instanceof HttpErrorResponse) {
      const status = err.status;
      if (
        status === 429 ||
        status === 403 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
      ) {
        return of(fallback);
      }
    }
    return of(fallback);
  }

  private parseCoordinate(value: unknown): number | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isValidLat(value: number): boolean {
    return (
      Number.isFinite(value) &&
      value >= GeolocationService.MIN_LAT &&
      value <= GeolocationService.MAX_LAT
    );
  }

  private isValidLon(value: number): boolean {
    return (
      Number.isFinite(value) &&
      value >= GeolocationService.MIN_LON &&
      value <= GeolocationService.MAX_LON
    );
  }

  private normalizeAddressKey(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeReverseKey(lat: number, lng: number): string {
    const latKey = Number(lat.toFixed(GeolocationService.COORD_KEY_DECIMALS));
    const lngKey = Number(lng.toFixed(GeolocationService.COORD_KEY_DECIMALS));
    return `${latKey},${lngKey}`;
  }

  private readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
    cache.set(key, { value, expiresAtMs: Date.now() + GeolocationService.CACHE_TTL_MS });
  }
}
