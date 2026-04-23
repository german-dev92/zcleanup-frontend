import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AuthRole = 'admin' | 'user';

export type AuthUser = {
  email?: string;
  role?: AuthRole;
  exp?: number;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'zcleanup_auth_token';
  private readonly tokenSubject = new BehaviorSubject<string | null>(this.readStoredToken());
  readonly token$ = this.tokenSubject.asObservable();

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.decodeUser(this.tokenSubject.value));
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    const token = this.tokenSubject.value;
    if (token && !this.decodeUser(token)) {
      this.clear();
    }
  }

  login(email: string, password: string): Observable<void> {
    const payload = {
      email: String(email ?? '').trim(),
      password: String(password ?? '')
    };

    return this.http
      .post<{ token?: string; accessToken?: string; jwt?: string }>(`${environment.apiBaseUrl}/auth/login`, payload)
      .pipe(
        map((res) => {
          const token = String(res?.token ?? res?.accessToken ?? res?.jwt ?? '').trim();
          if (!token) {
            throw new Error('Missing token');
          }
          this.setToken(token);
        }),
        catchError((err: unknown) => throwError(() => err))
      );
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getUser(): AuthUser | null {
    return this.userSubject.value;
  }

  setToken(token: string): void {
    const value = String(token ?? '').trim();
    const user = this.decodeUser(value);
    if (!user) {
      throw new Error('Invalid token');
    }
    localStorage.setItem(this.storageKey, value);
    this.tokenSubject.next(value);
    this.userSubject.next(user);
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  logout(): void {
    this.clear();
  }

  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !!this.decodeUser(token);
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  }

  private readStoredToken(): string | null {
    const raw = localStorage.getItem(this.storageKey);
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token ? token : null;
  }

  private decodeUser(token: string | null): AuthUser | null {
    const raw = String(token ?? '').trim();
    if (!raw) return null;

    const parts = raw.split('.');
    if (parts.length !== 3) return null;

    const payload = this.base64UrlDecodeJson(parts[1]);
    if (!payload || typeof payload !== 'object') return null;

    const role = (payload as any).role;
    if (role !== 'admin' && role !== 'user') return null;

    const exp = (payload as any).exp;
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      const now = Math.floor(Date.now() / 1000);
      if (exp <= now) return null;
    }

    const emailValue = (payload as any).email;
    const email = typeof emailValue === 'string' ? emailValue.toLowerCase().trim() : undefined;
    return { email, role, exp: typeof exp === 'number' ? exp : undefined };
  }

  private base64UrlDecodeJson(value: string): unknown | null {
    try {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4));
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
