import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CoverageCity, LocationResult } from '../models/location.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  // Coordinates for the center of covered cities in FL
  private coverageArea: CoverageCity[] = [
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

  constructor() {}

  /**
   * Checks if a given coordinate is within the coverage area.
   * Assigns to the CLOSEST city that covers the point.
   */
  isWithinCoverage(lat: number, lng: number): { 
    status: 'inside' | 'borderline' | 'outside'; 
    city?: string; 
    distance?: number;
    isExtraCharge: boolean;
  } {
    const BORDERLINE_THRESHOLD_KM = 3; // The last 3km of the radius are borderline

    // Find all cities that cover this point
    const coveringCities = this.coverageArea
      .map(city => ({
        city,
        distance: this.calculateDistance(lat, lng, city.lat, city.lng)
      }))
      .filter(item => item.distance <= item.city.radiusKm);

    if (coveringCities.length === 0) {
      return { status: 'outside', isExtraCharge: false };
    }

    // Assign to the NEAREST city center among those that cover the point
    const closestAssignment = coveringCities.reduce((prev, curr) => 
      prev.distance < curr.distance ? prev : curr
    );

    const { city, distance } = closestAssignment;
    const isBorderline = (city.radiusKm - distance) <= BORDERLINE_THRESHOLD_KM;

    return { 
      status: isBorderline ? 'borderline' : 'inside', 
      city: city.name, 
      distance: Math.round(distance * 10) / 10,
      isExtraCharge: isBorderline
    };
  }

  /**
   * Geocodes an address string to coordinates using Google Maps API
   */
  geocodeAddress(address: string): Observable<LocationResult | null> {
    if (!address || address.trim().length < 5) return of(null);
    const googleMaps = (window as any)?.google?.maps;
    if (googleMaps?.Geocoder) {
      return new Observable<LocationResult | null>((subscriber) => {
        const geocoder = new googleMaps.Geocoder();
        const input = `${address}, FL, USA`;
        geocoder.geocode({ address: input }, (results: any[], status: string) => {
          try {
            if (status === 'OK' && Array.isArray(results) && results.length > 0) {
              const result = results[0];
              const comps: any[] = Array.isArray(result?.address_components)
                ? result.address_components
                : [];
              const isInFlorida = comps.some((comp: any) =>
                comp?.short_name === 'FL' || comp?.long_name === 'Florida'
              );
              if (!isInFlorida) {
                subscriber.next(null);
                subscriber.complete();
                return;
              }

              const location = result?.geometry?.location;
              const lat =
                typeof location?.lat === 'function' ? location.lat() : location?.lat;
              const lng =
                typeof location?.lng === 'function' ? location.lng() : location?.lng;

              if (typeof lat !== 'number' || typeof lng !== 'number') {
                subscriber.next(null);
                subscriber.complete();
                return;
              }

              subscriber.next({
                lat,
                lng,
                address: String(result?.formatted_address ?? input),
              });
              subscriber.complete();
              return;
            }

            if (!environment.production && status && status !== 'OK') {
              console.warn('Google Geocoder error:', status);
            }
            subscriber.next(null);
            subscriber.complete();
          } catch (e) {
            subscriber.next(null);
            subscriber.complete();
          }
        });
      });
    }

    return of(null);
  }

  /**
   * Reverse geocodes coordinates to a formatted address
   */
  reverseGeocode(lat: number, lng: number): Observable<string | null> {
    const googleMaps = (window as any)?.google?.maps;
    if (!googleMaps?.Geocoder) return of(null);

    return new Observable<string | null>((subscriber) => {
      const geocoder = new googleMaps.Geocoder();
      const location = { lat, lng };
      geocoder.geocode({ location }, (results: any[], status: string) => {
        try {
          if (status === 'OK' && Array.isArray(results) && results.length > 0) {
            subscriber.next(String(results[0]?.formatted_address ?? ''));
            subscriber.complete();
            return;
          }
          subscriber.next(null);
          subscriber.complete();
        } catch {
          subscriber.next(null);
          subscriber.complete();
        }
      });
    });
  }

  /**
   * Calculates the Haversine distance between two points in Km
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in Km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getCoverageCities(): string[] {
    return this.coverageArea.map(c => c.name);
  }

  getCoverageCitiesDetails(): CoverageCity[] {
    return [...this.coverageArea];
  }
}
