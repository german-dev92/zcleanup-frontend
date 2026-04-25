import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnDestroy {
  isMenuOpen = false;
  isAdminRoute = false;
  private destroy$ = new Subject<void>();

  constructor(private router: Router) {
    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
        if (this.isAdminRoute) this.closeMenu();
      });
  }

  toggleMenu() {
    if (this.isAdminRoute) return;
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
