import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  sendMessage(contactData: any): Observable<any> {
    const directUrl = `${this.apiBaseUrl}/contact`;
    const apiPrefixedUrl = `${this.apiBaseUrl}/api/contact`;

    return this.http.post<any>(directUrl, contactData).pipe(
      catchError((err: any) => {
        if (err?.status === 404) {
          return this.http.post<any>(apiPrefixedUrl, contactData);
        }
        return throwError(() => err);
      })
    );
  }
}
