import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit {
  isSidebarOpen = false;

  constructor(private readonly auth: AuthService) {}

  ngOnInit(): void {
    this.isSidebarOpen = typeof window !== 'undefined' && window.innerWidth > 900;
  }

  isSupervisor(): boolean {
    return this.auth.isSupervisor();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  onLogout(): void {
    this.closeSidebar();
    const ok = confirm('Are you sure you want to logout?');
    if (!ok) return;
    this.auth.logout();
  }
}
