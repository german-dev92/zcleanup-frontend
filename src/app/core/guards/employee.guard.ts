import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SecurityStateService } from '../services/security-state.service';

@Injectable({
  providedIn: 'root'
})
export class EmployeeGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly securityState: SecurityStateService
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const token = this.auth.getToken();
    if (!token || !this.auth.hasValidToken()) {
      this.securityState.setUnauthorized('Please sign in to access your dashboard.');
      return this.router.createUrlTree(['/admin/login'], {
        queryParams: { returnUrl: state.url }
      });
    }

    if (this.auth.isEmployee()) {
      return true;
    }

    if (this.auth.isAdminOrSupervisor()) {
      return this.router.createUrlTree(['/admin/bookings']);
    }

    this.securityState.setForbidden('Not authorized.');
    return this.router.createUrlTree(['/']);
  }
}
