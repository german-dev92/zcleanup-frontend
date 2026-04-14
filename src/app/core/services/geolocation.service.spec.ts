import { GeolocationService } from './geolocation.service';

describe('GeolocationService', () => {
  it('includes Brandon in coverage cities and assigns Brandon at its center', () => {
    const svc = new GeolocationService({} as any);
    expect(svc.getCoverageCities()).toContain('Brandon');

    const res = svc.isWithinCoverage(27.9378, -82.2859);
    expect(res.status).toBe('inside');
    expect(res.city).toBe('Brandon');
    expect(res.isExtraCharge).toBe(false);
  });
});

