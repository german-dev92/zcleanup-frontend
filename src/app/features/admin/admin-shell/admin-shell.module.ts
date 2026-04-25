import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../../shared/shared.module';
import { AdminShellRoutingModule } from './admin-shell-routing.module';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { EmployeeManagementComponent } from './employee-management/employee-management.component';
import { ArchiveComponent } from './archive/archive.component';
import { ManualBookingComponent } from './manual-booking/manual-booking.component';

@NgModule({
  declarations: [AdminLayoutComponent, EmployeeManagementComponent, ArchiveComponent, ManualBookingComponent],
  imports: [CommonModule, RouterModule, SharedModule, AdminShellRoutingModule]
})
export class AdminShellModule {}

