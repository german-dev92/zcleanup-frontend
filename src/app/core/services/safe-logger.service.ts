import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SafeLoggerService {
  error(message: string, err?: unknown): void {
    if (!environment.production) {
      console.error(message, err);
    } else {
      console.error(message);
    }
  }

  warn(message: string, detail?: unknown): void {
    if (!environment.production) {
      console.warn(message, detail);
    }
  }
}
