import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SecurityStateService } from '../services/security-state.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * @class SecurityInterceptor
 * @description Interceptor HTTP encargado de auditar las respuestas del servidor para detectar fallos de seguridad o sesión.
 * - Detecta errores 401 (No autorizado) para forzar el cierre de sesión si existe un token expirado.
 * - Maneja errores 403 (Prohibido) actualizando el estado de seguridad global.
 * - Captura errores de red (0) y errores de servidor (500+) para mostrar mensajes amigables al usuario.
 */
@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  /** Bandera para evitar múltiples redirecciones de logout simultáneas */
  private forcingLogout = false;

  constructor(
    private readonly securityState: SecurityStateService,
    private readonly auth: AuthService
  ) {}

  /**
   * Identifica si la solicitud actual es de autenticación (login/registro).
   * Estas solicitudes se excluyen de la lógica de forzar logout por 401.
   * @param req Solicitud HTTP.
   * @returns Verdadero si es una ruta de auth.
   */
  private isLoginOrRegisterRequest(req: HttpRequest<unknown>): boolean {
    const url = String(req?.url ?? '').toLowerCase();
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    );
  }

  /**
   * Intercepta todas las solicitudes HTTP salientes y sus respuestas.
   * Implementa lógica de recuperación ante errores de autenticación y conectividad.
   */
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        const httpErr = err instanceof HttpErrorResponse ? err : null;
        const status = httpErr?.status;
        const isLoginOrRegister = this.isLoginOrRegisterRequest(req);
        const hasToken = !!this.auth.getToken();

        // 🚨 CASO CRÍTICO: Token expirado o inválido detectado por el backend
        if (status === 401 && hasToken && !isLoginOrRegister && !this.forcingLogout) {
          this.forcingLogout = true;
          if (!environment.production) {
            console.warn('[AUTH] 401 detected → forcing logout');
          }
          this.securityState.setSessionExpired();
          this.auth.logout();
        } else if (status === 403) {
          // Acceso denegado a un recurso específico
          this.securityState.setForbidden();
        } else if (status === 0) {
          // Error de red (CORS o servidor caído)
          this.securityState.setError('Network error. Please check your connection and try again.');
        } else if (typeof status === 'number' && status >= 500) {
          // Error interno del servidor
          this.securityState.setError('Service temporarily unavailable. Please try again.');
        }

        return throwError(() => err);
      })
    );
  }
}
