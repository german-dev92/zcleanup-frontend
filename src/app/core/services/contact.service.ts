import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiUrl = '/api/contact';

  constructor(private http: HttpClient) { }

  sendMessage(contactData: any): Observable<any> {
    const successResponse = {
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    };

    // return this.http.post(this.apiUrl, contactData);
    return of(successResponse).pipe(delay(1000));
  }
}
