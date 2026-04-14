import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CoverageCity, LocationResult } from '../models/location.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  private readonly GOOGLE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
  private readonly API_KEY = environment.googleMapsApiKey;

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

  constructor(private http: HttpClient) {}

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

    // Filter to ensure we are searching in Florida
    const encodedAddress = encodeURIComponent(`${address}, FL, USA`);
    const url = `${this.GOOGLE_API_URL}?address=${encodedAddress}&key=${this.API_KEY}`;

    return this.http.get<any>(url).pipe(
      map(response => {
        if (response.status === 'OK' && response.results && response.results.length > 0) {
          const result = response.results[0];
          
          // Verify it's actually in Florida to avoid false positives from other states
          const isInFlorida = result.address_components.some((comp: any) => 
            comp.short_name === 'FL' || comp.long_name === 'Florida'
          );

          if (!isInFlorida) {
            console.warn('Address found but not in Florida:', result.formatted_address);
            return null;
          }

          const location = result.geometry.location;
          return {
            lat: location.lat,
            lng: location.lng,
            address: result.formatted_address
          };
        }
        
        if (response.status === 'ZERO_RESULTS') {
          console.warn('No results found for address:', address);
        } else if (response.status !== 'OK') {
          console.error('Google Maps API error:', response.status, response.error_message);
        }
        
        return null;
      }),
      catchError(error => {
        console.error('Geocoding HTTP error:', error);
        return of(null);
      })
    );
  }

  /**
   * Reverse geocodes coordinates to a formatted address
   */
  reverseGeocode(lat: number, lng: number): Observable<string | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.API_KEY}`;
    
    return this.http.get<any>(url).pipe(
      map(response => {
        if (response.status === 'OK' && response.results && response.results.length > 0) {
          return response.results[0].formatted_address;
        }
        return null;
      }),
      catchError(() => of(null))
    );
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
