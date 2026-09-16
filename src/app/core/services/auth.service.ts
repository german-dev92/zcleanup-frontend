import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AuthRole = 'admin' | 'supervisor' | 'user' | 'employee';

export type AuthUser = {
  email?: string;
  role?: AuthRole;
  exp?: number;
};

/**
 * @class AuthService
 * @description Servicio centralizado para la gestión de la autenticación en el frontend.
 * Maneja el almacenamiento de tokens JWT en localStorage, la decodificación de payloads de usuario,
 * y proporciona observables para reaccionar a cambios en el estado de autenticación.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  /** Clave utilizada para almacenar el token en el almacenamiento local */
  private readonly storageKey = 'zcleanup_auth_token';
  
  /** Sujeto que emite el token actual */
  private readonly tokenSubject = new BehaviorSubject<string | null>(this.readStoredToken());
  /** Observable público del token */
  readonly token$ = this.tokenSubject.asObservable();

  /** Sujeto que emite el usuario decodificado actual */
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.decodeUser(this.tokenSubject.value));
  /** Observable público del usuario */
  readonly user$ = this.userSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    const token = this.tokenSubject.value;
    if (token && !this.decodeUser(token)) {
      this.clear();
    }
  }

  /**
   * Realiza la solicitud de inicio de sesión al servidor.
   * Si es exitoso, almacena el token y actualiza el estado.
   * @param email Email del usuario.
   * @param password Contraseña del usuario.
   * @returns Observable que se completa tras el login exitoso.
   */
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

  /**
   * Devuelve el token JWT almacenado actualmente.
   * @returns Token JWT o null si no existe.
   */
  getToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Devuelve el objeto de usuario decodificado actualmente.
   * @returns Usuario autenticado o null si no hay sesión.
   */
  getUser(): AuthUser | null {
    return this.userSubject.value;
  }

  /**
   * Almacena un nuevo token y actualiza los sujetos reactivos.
   * @param token Token JWT a almacenar.
   * @throws Error si el token es inválido o no se puede decodificar.
   */
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

  /**
   * Limpia todos los datos de sesión de los almacenamientos y sujetos.
   */
  clear(): void {
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  /**
   * Cierra la sesión del usuario y lo redirige a la página de login.
   */
  logout(): void {
    this.clear();
    void this.router.navigateByUrl('/admin/login', { replaceUrl: true });
  }

  /**
   * Verifica si existe un token válido y no expirado.
   * @returns Verdadero si la sesión es válida.
   */
  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !!this.decodeUser(token);
  }

  /**
   * Verifica si el usuario actual tiene rol de administrador.
   */
  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  }

  /**
   * Verifica si el usuario actual tiene rol de supervisor.
   */
  isSupervisor(): boolean {
    const user = this.getUser();
    return user?.role === 'supervisor';
  }

  /**
   * Verifica si el usuario actual es administrador o supervisor.
   */
  isAdminOrSupervisor(): boolean {
    const user = this.getUser();
    return user?.role === 'admin' || user?.role === 'supervisor';
  }

  /**
   * Verifica si el usuario actual tiene rol de empleado.
   */
  isEmployee(): boolean {
    const user = this.getUser();
    return user?.role === 'employee';
  }

  /**
   * Intenta leer el token desde localStorage.
   * @returns Token encontrado o null.
   */
  private readStoredToken(): string | null {
    const raw = localStorage.getItem(this.storageKey);
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token ? token : null;
  }

  /**
   * Decodifica un token JWT y valida su contenido y expiración.
   * @param token Token JWT en formato string.
   * @returns Objeto de usuario decodificado o null si el token es inválido o expiró.
   */
  private decodeUser(token: string | null): AuthUser | null {
    const raw = String(token ?? '').trim();
    if (!raw) return null;

    const parts = raw.split('.');
    if (parts.length !== 3) return null;

    const payload = this.base64UrlDecodeJson(parts[1]);
    if (!payload || typeof payload !== 'object') return null;

    const role = (payload as any).role;
    if (
      role !== 'admin' &&
      role !== 'supervisor' &&
      role !== 'user' &&
      role !== 'employee'
    ) {
      return null;
    }

    const exp = (payload as any).exp;
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      const now = Math.floor(Date.now() / 1000);
      if (exp <= now) return null;
    }

    const emailValue = (payload as any).email;
    const email = typeof emailValue === 'string' ? emailValue.toLowerCase().trim() : undefined;
    return { email, role, exp: typeof exp === 'number' ? exp : undefined };
  }

  /**
   * Utilidad para decodificar base64url a JSON.
   * @param value Cadena base64url.
   * @returns Objeto JSON parseado o null si falla.
   */
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
