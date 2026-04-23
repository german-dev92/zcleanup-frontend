import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SecurityUiState =
  | { kind: 'none' }
  | { kind: 'session_expired'; message: string }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string };

@Injectable({
  providedIn: 'root'
})
export class SecurityStateService {
  private readonly stateSubject = new BehaviorSubject<SecurityUiState>({ kind: 'none' });
  readonly state$ = this.stateSubject.asObservable();

  clear(): void {
    this.stateSubject.next({ kind: 'none' });
  }

  setSessionExpired(message: string = 'Session expired. Please sign in again.'): void {
    this.stateSubject.next({ kind: 'session_expired', message });
  }

  setUnauthorized(message: string = 'Unauthorized. Please sign in.'): void {
    this.stateSubject.next({ kind: 'unauthorized', message });
  }

  setForbidden(message: string = 'Not authorized to perform this action.'): void {
    this.stateSubject.next({ kind: 'forbidden', message });
  }

  setError(message: string = 'Something went wrong. Please try again.'): void {
    this.stateSubject.next({ kind: 'error', message });
  }
}
