import { fakeAsync, flush, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { GeolocationService } from './geolocation.service';
import { LocationResult } from '../models/location.model';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

const TAMPA_ADDR = '601 N Ashley Dr, Tampa';
const TAMPA_SEARCH_PAYLOAD = [
  {
    lat: '27.9490',
    lon: '-82.4590',
    display_name: '601 North Ashley Drive, Tampa, Hillsborough County, Florida, 33602, USA',
    address: { state: 'Florida', country_code: 'us' }
  }
];

const TAMPA_REVERSE_PAYLOAD = {
  lat: '27.9490',
  lon: '-82.4590',
  display_name: '601 North Ashley Drive, Tampa, Hillsborough County, Florida, 33602, USA',
  address: { state: 'Florida', country_code: 'us' }
};

function expectOneSearch(http: HttpTestingController, expectedQ?: string) {
  const req = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET');
  if (expectedQ !== undefined) {
    expect(req.request.params.get('q')).toBe(expectedQ);
  }
  expect(req.request.params.get('format')).toBe('jsonv2');
  expect(req.request.params.get('countrycodes')).toBe('us');
  return req;
}

function expectOneReverse(http: HttpTestingController) {
  const req = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/reverse` && r.method === 'GET');
  expect(req.request.params.get('format')).toBe('jsonv2');
  return req;
}

function expectNominatimSearch(
  http: HttpTestingController,
  nth: number,
  checks: { q?: string; street?: string; postalcode?: string; state?: string; country?: string } = {},
) {
  const reqs = http.match((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET');
  if (reqs.length <= nth) {
    throw new Error(`expected at least ${nth + 1} search request(s), only ${reqs.length} found`);
  }
  const req = reqs[nth];
  const p = (k: string) => req.request.params.get(k);
  expect(p('format')).toBe('jsonv2');
  if (checks.q !== undefined) expect(p('q')).toBe(checks.q);
  if (checks.street !== undefined) expect(p('street')).toBe(checks.street);
  if (checks.postalcode !== undefined) expect(p('postalcode')).toBe(checks.postalcode);
  if (checks.state !== undefined) expect(p('state')).toBe(checks.state);
  if (checks.country !== undefined) expect(p('country')).toBe(checks.country);
  return req;
}

function subscribeSync<T>(obs$: { subscribe: (o: { next: (v: T) => void; error: (e: unknown) => void }) => { unsubscribe: () => void } }) {
  const out: { value: T | 'NOT_SET' | null; error: unknown } = { value: 'NOT_SET', error: undefined };
  const sub = obs$.subscribe({
    next: (v: T) => { out.value = v; },
    error: (e: unknown) => { out.error = e; }
  });
  return { out, sub };
}

function advance() {
  tick();
  flushMicrotasks();
}

describe('GeolocationService', () => {
  let service: GeolocationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GeolocationService]
    });
    service = TestBed.inject(GeolocationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      if (http) {
        try {
          const pending = http.match(() => true);
          pending.forEach((req) => {
            try { req.flush(null, { status: 499, statusText: 'Cleanup' }); } catch { /* noop */ }
          });
          http.verify();
        } catch { /* ignore cancelled / unflushed leftover requests */ }
      }
    } catch { /* noop */ }
  });

  it('exposes coverage city names', () => {
    const svc = new GeolocationService();
    const cities = svc.getCoverageCities();
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities).toContain('Tampa');
  });

  it('exposes coverage city details', () => {
    const details = service.getCoverageCitiesDetails();
    expect(details.length).toBe(10);
    expect(details[0]).toEqual(expect.objectContaining({ name: 'Tampa', radiusKm: 22 }));
  });

  describe('geocodeAddress', () => {
    it('dirección válida devuelve LocationResult', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      const req = expectOneSearch(http, `${TAMPA_ADDR}, FL, USA`);
      req.flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(out.error).toBeUndefined();
      expect(out.value).not.toBeNull();
      expect((out.value as LocationResult).lat).toBeCloseTo(27.949, 3);
      expect((out.value as LocationResult).lng).toBeCloseTo(-82.459, 3);
      expect((out.value as LocationResult).address).toContain('Tampa');
    }));

    it('respuesta vacía devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress('123 Foo Bar'));

      const req0 = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
        && r.params.get('q') === '123 Foo Bar, FL, USA');
      expect(req0.request.params.get('format')).toBe('jsonv2');
      req0.flush([]);
      advance();
      flush();

      const reqsAfter = http.match((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET');
      const req1 = reqsAfter[reqsAfter.length - 1];
      expect(req1.request.params.get('format')).toBe('jsonv2');
      expect(req1.request.params.get('q')).toBe('123 Foo Bar, FL, USA');
      req1.flush([]);
      advance();
      expect(out.value).toBeNull();
    }));

    describe('biasedQuery SMART no duplicar estado/país', () => {
      it('input contiene FL + USA → no agrega sufijo', fakeAsync(() => {
        const addr = '601 N Ashley Dr, Tampa, FL 33602, USA';
        const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(addr));
        const req = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
          && r.params.get('q') === addr);
        expect(req.request.params.get('format')).toBe('jsonv2');
        req.flush(TAMPA_SEARCH_PAYLOAD);
        advance();
        expect(out.value).not.toBeNull();
      }));

      it('input contiene solo FL → agrega solamente USA', fakeAsync(() => {
        const addr = '601 N Ashley Dr, Tampa, FL 33602';
        const expectedQ = '601 N Ashley Dr, Tampa, FL 33602, USA';
        const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(addr));
        const req = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
          && r.params.get('q') === expectedQ);
        expect(req.request.params.get('format')).toBe('jsonv2');
        req.flush(TAMPA_SEARCH_PAYLOAD);
        advance();
        expect(out.value).not.toBeNull();
      }));

      it('input sin state ni country → agrega FL, USA', fakeAsync(() => {
        const expectedQ = `${TAMPA_ADDR}, FL, USA`;
        const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
        const req = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
          && r.params.get('q') === expectedQ);
        expect(req.request.params.get('format')).toBe('jsonv2');
        req.flush(TAMPA_SEARCH_PAYLOAD);
        advance();
        expect(out.value).not.toBeNull();
      }));
    });

    describe('fallback strategy 2-step', () => {
      it('full query vacía → ejecuta fallback structured con street/postalcode → resuelve dirección Florida/USA', fakeAsync(() => {
        const cheval = '4312 Cheval Blvd, Lutz, FL 33558';
        const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(cheval));

        const req0 = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
          && r.params.get('q') === '4312 Cheval Blvd, Lutz, FL 33558, USA');
        expect(req0.request.params.get('format')).toBe('jsonv2');
        req0.flush([]);
        advance();
        flush();

        const reqsAfter = http.match((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET');
        const req1 = reqsAfter[reqsAfter.length - 1];
        expect(req1.request.params.get('format')).toBe('jsonv2');
        expect(req1.request.params.get('street')).toBe('4312 Cheval Blvd');
        expect(req1.request.params.get('postalcode')).toBe('33558');
        expect(req1.request.params.get('state')).toBe('Florida');
        expect(req1.request.params.get('country')).toBe('us');

        req1.flush([
          {
            lat: '28.1496604',
            lon: '-82.5068427',
            display_name: '4312 Cheval Blvd, Cheval, Hillsborough County, Florida, 33558, United States',
            address: { state: 'Florida', country_code: 'us' }
          }
        ]);
        advance();

        expect(out.error).toBeUndefined();
        expect(out.value).not.toBeNull();
        const loc = out.value as LocationResult;
        expect(typeof loc.lat).toBe('number');
        expect(typeof loc.lng).toBe('number');
        expect(Number.isFinite(loc.lat)).toBe(true);
        expect(Number.isFinite(loc.lng)).toBe(true);
        expect(loc.lat).toBeGreaterThan(27);
        expect(loc.lat).toBeLessThan(29);
        expect(loc.lng).toBeGreaterThan(-83.5);
        expect(loc.lng).toBeLessThan(-81.5);
        expect(typeof loc.address).toBe('string');
        expect(loc.address.length).toBeGreaterThan(0);
      }));
    });

    it('coordenadas inválidas en payload devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush([
        { lat: 'not_a_number', lon: '-82.459', display_name: 'Bad', address: { state: 'Florida', country_code: 'us' } }
      ]);
      advance();
      expect(out.value).toBeNull();
    }));

    it('resultado fuera de Florida devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress('Manhattan, NY'));
      expectOneSearch(http).flush([
        {
          lat: '40.7831',
          lon: '-73.9712',
          display_name: 'Manhattan, NYC, NY, USA',
          address: { state: 'New York', country_code: 'us' }
        }
      ]);
      advance();
      expect(out.value).toBeNull();
    }));

    it('resultado fuera de USA devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress('Toronto'));
      expectOneSearch(http).flush([
        {
          lat: '43.6532',
          lon: '-79.3832',
          display_name: 'Toronto, Canada',
          address: { state: 'Ontario', country_code: 'ca' }
        }
      ]);
      advance();
      expect(out.value).toBeNull();
    }));

    it('lat/lon numéricos inválidos devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush([
        { lat: null as unknown as string, lon: null as unknown as string, display_name: 'Bad', address: { state: 'Florida', country_code: 'us' } }
      ]);
      advance();
      expect(out.value).toBeNull();
    }));

    it.each([429, 403, 500, 502, 503, 504])('HTTP %s devuelve null', fakeAsync((status: number) => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush('error', { status, statusText: 'X' });
      advance();
      expect(out.value).toBeNull();
    }));

    it('timeout >5s devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http);
      tick(5001);
      flush();
      advance();
      expect(out.value).toBeNull();
      expect(out.error).toBeUndefined();
    }));

    it('dirección demasiado corta devuelve null', fakeAsync(() => {
      const { out: s1 } = subscribeSync<LocationResult | null>(service.geocodeAddress(''));
      advance();
      expect(s1.value).toBeNull();

      const { out: s2 } = subscribeSync<LocationResult | null>(service.geocodeAddress('1234'));
      advance();
      expect(s2.value).toBeNull();

      http.expectNone(`${NOMINATIM_BASE}/search`);
    }));

    it('http no disponible devuelve null', fakeAsync(() => {
      const svc = new GeolocationService();
      const { out } = subscribeSync<LocationResult | null>(svc.geocodeAddress(TAMPA_ADDR));
      advance();
      expect(out.value).toBeNull();
    }));
  });

  describe('reverseGeocode', () => {
    const LAT = 27.949;
    const LNG = -82.459;

    it('coordenadas válidas devuelve dirección', fakeAsync(() => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(LAT, LNG));
      const req = expectOneReverse(http);
      expect(req.request.params.get('lat')).toBe(String(LAT));
      expect(req.request.params.get('lon')).toBe(String(LNG));
      req.flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(typeof out.value).toBe('string');
      expect((out.value as string).length).toBeGreaterThan(0);
    }));

    it('coordenadas inválidas devuelve null', fakeAsync(() => {
      const cases: Array<[number, number]> = [[NaN, LNG], [LAT, Infinity], [91, LNG], [LAT, 181]];
      const results = cases.map((c) => subscribeSync<string | null>(service.reverseGeocode(c[0], c[1])));
      advance();
      for (const r of results) {
        expect(r.out.value).toBeNull();
      }
      http.expectNone(`${NOMINATIM_BASE}/reverse`);
    }));

    it('respuesta vacía/inválida devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(LAT, LNG));
      expectOneReverse(http).flush({ display_name: null, error: null });
      advance();
      expect(out.value).toBeNull();
    }));

    it('respuesta con error nominatim devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(LAT, LNG));
      expectOneReverse(http).flush({ error: 'Unable to geocode' });
      advance();
      expect(out.value).toBeNull();
    }));

    it('HTTP error devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(LAT, LNG));
      expectOneReverse(http).flush('x', { status: 500, statusText: 'E' });
      advance();
      expect(out.value).toBeNull();
    }));

    it('timeout devuelve null', fakeAsync(() => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(LAT, LNG));
      expectOneReverse(http);
      tick(5001);
      flush();
      advance();
      expect(out.value).toBeNull();
    }));
  });

  describe('caché geocodeAddress', () => {
    it('primera petición realiza HTTP, segunda sirve de caché', fakeAsync(() => {
      const { out: r1 } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();
      const saved = r1.value;

      const { out: r2 } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      advance();
      http.expectNone(`${NOMINATIM_BASE}/search`);
      expect(r2.value).toEqual(saved);
    }));

    it('diferencias de mayúsculas y espacios usan misma caché', fakeAsync(() => {
      const { out: r1 } = subscribeSync<LocationResult | null>(service.geocodeAddress('601  N  Ashley DR,  Tampa '));
      expectOneSearch(http).flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();

      const { out: r2 } = subscribeSync<LocationResult | null>(service.geocodeAddress('601 n ashley dr, tampa'));
      advance();
      http.expectNone(`${NOMINATIM_BASE}/search`);
      expect(r2.value).toEqual(r1.value);
    }));

    it('respuesta null no se almacena en caché', fakeAsync(() => {
      const { out: r1 } = subscribeSync<LocationResult | null>(service.geocodeAddress('123 Foo'));

      const r1Req0 = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
        && r.params.get('q') === '123 Foo, FL, USA');
      r1Req0.flush([]);
      advance();
      flush();

      const r1ReqsAfter = http.match((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET');
      const r1Req1 = r1ReqsAfter[r1ReqsAfter.length - 1];
      expect(r1Req1.request.params.get('format')).toBe('jsonv2');
      expect(r1Req1.request.params.get('q')).toBe('123 Foo, FL, USA');
      r1Req1.flush([]);
      advance();
      expect(r1.value).toBeNull();

      const { out: r2 } = subscribeSync<LocationResult | null>(service.geocodeAddress('123 Foo'));
      const r2Req0 = http.expectOne((r) => r.url === `${NOMINATIM_BASE}/search` && r.method === 'GET'
        && r.params.get('q') === '123 Foo, FL, USA');
      r2Req0.flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(r2.value).not.toBeNull();
    }));

    it('entrada expirada vuelve a realizar HTTP', fakeAsync(() => {
      const { out: r1 } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();

      tick(5 * 60 * 1000 + 1);
      advance();

      const { out: r2 } = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      expectOneSearch(http).flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(r2.value).not.toBeNull();
    }));
  });

  describe('caché reverseGeocode', () => {
    it('misma coordenada normalizada usa caché', fakeAsync(() => {
      const { out: r1 } = subscribeSync<string | null>(service.reverseGeocode(27.94901, -82.45902));
      expectOneReverse(http).flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();

      const { out: r2 } = subscribeSync<string | null>(service.reverseGeocode(27.949011, -82.459022));
      advance();
      http.expectNone(`${NOMINATIM_BASE}/reverse`);
      expect(r2.value).toEqual(r1.value);
    }));

    it('pequeñas diferencias usan misma clave bucket', fakeAsync(() => {
      const { out: r1 } = subscribeSync<string | null>(service.reverseGeocode(27.123451, -82.123451));
      expectOneReverse(http).flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();

      const { out: r2 } = subscribeSync<string | null>(service.reverseGeocode(27.123454, -82.123454));
      advance();
      http.expectNone(`${NOMINATIM_BASE}/reverse`);
      expect(r2.value).toEqual(r1.value);
    }));

    it('resultado null no se almacena', fakeAsync(() => {
      const { out: r1 } = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      expectOneReverse(http).flush({ error: 'x' });
      advance();
      expect(r1.value).toBeNull();

      const { out: r2 } = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      expectOneReverse(http).flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(r2.value).not.toBeNull();
    }));

    it('entrada expirada vuelve a realizar HTTP', fakeAsync(() => {
      const { out: r1 } = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      expectOneReverse(http).flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(r1.value).not.toBeNull();

      tick(5 * 60 * 1000 + 1);
      advance();

      const { out: r2 } = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      expectOneReverse(http).flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(r2.value).not.toBeNull();
    }));
  });

  describe('deduplicación concurrente', () => {
    it('dos geocodeAddress simultáneos generan una sola petición HTTP', fakeAsync(() => {
      const s1 = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      const s2 = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      advance();
      const req = expectOneSearch(http);
      req.flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(s1.out.value).not.toBeNull();
      expect(s2.out.value).toEqual(s1.out.value);
      s1.sub.unsubscribe();
      s2.sub.unsubscribe();
    }));

    it('ambas suscripciones reciben mismo resultado', fakeAsync(() => {
      const s1 = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      const s2 = subscribeSync<LocationResult | null>(service.geocodeAddress(TAMPA_ADDR));
      advance();
      const req = expectOneSearch(http);
      req.flush(TAMPA_SEARCH_PAYLOAD);
      advance();
      expect(s1.out.value).toEqual(s2.out.value);
      expect(s1.out.value).not.toBeNull();
    }));

    it('dos reverseGeocode simultáneos generan una sola petición HTTP', fakeAsync(() => {
      const s1 = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      const s2 = subscribeSync<string | null>(service.reverseGeocode(27, -82));
      advance();
      const req = expectOneReverse(http);
      req.flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(s1.out.value).toEqual(s2.out.value);
      expect(s1.out.value).not.toBeNull();
    }));
  });

  describe('validación de coordenadas', () => {
    const validCases: Array<[number, number]> = [
      [0, 0],
      [90, 180],
      [-90, -180],
      [27.95, -82.45]
    ];

    const invalidLatCases: Array<[number, number]> = [
      [90.0001, 0],
      [-90.0001, 0],
      [NaN, 0],
      [Infinity, 0],
      [-Infinity, 0]
    ];

    const invalidLngCases: Array<[number, number]> = [
      [0, 180.0001],
      [0, -180.0001],
      [0, NaN],
      [0, Infinity]
    ];

    it.each(validCases)('acepta válidas lat=%s lng=%s', fakeAsync((lat: number, lng: number) => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(lat, lng));
      const req = expectOneReverse(http);
      req.flush(TAMPA_REVERSE_PAYLOAD);
      advance();
      expect(out.value).not.toBeNull();
    }));

    it.each(invalidLatCases)('rechaza lat inválida lat=%s', fakeAsync((lat: number, lng: number) => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(lat, lng));
      advance();
      expect(out.value).toBeNull();
    }));

    it.each(invalidLngCases)('rechaza lng inválida lng=%s', fakeAsync((lat: number, lng: number) => {
      const { out } = subscribeSync<string | null>(service.reverseGeocode(lat, lng));
      advance();
      expect(out.value).toBeNull();
    }));
  });
});
