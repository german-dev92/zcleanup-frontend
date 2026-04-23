import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SecurityStateService } from '../services/security-state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly securityState: SecurityStateService
  ) {}

  canActivate(): boolean | UrlTree {
    const token = this.auth.getToken();
    if (!token || !this.auth.hasValidToken()) {
      this.securityState.setUnauthorized('Please sign in to access the admin panel.');
      return this.router.createUrlTree(['/admin/login'], {
        queryParams: { returnUrl: this.router.url }
      });
    }

    if (!this.auth.isAdmin()) {
      this.securityState.setForbidden('Not authorized.');
      return this.router.createUrlTree(['/']);
    }

    return true;
  }
}
