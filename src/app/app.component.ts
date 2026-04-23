import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { SecurityStateService, SecurityUiState } from './core/services/security-state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'ZCleanUp';
  securityState: SecurityUiState = { kind: 'none' };
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private security: SecurityStateService
  ) {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        window.scrollTo(0, 0);
      });

    this.security.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.securityState = state;
      });
  }

  dismissSecurityBanner(): void {
    this.security.clear();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
