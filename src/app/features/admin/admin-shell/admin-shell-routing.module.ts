import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { EmployeeManagementComponent } from './employee-management/employee-management.component';
import { ArchiveComponent } from './archive/archive.component';
import { ManualBookingComponent } from './manual-booking/manual-booking.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: 'bookings',
        loadChildren: () =>
          import('../bookings/admin-bookings.module').then((m) => m.AdminBookingsModule)
      },
      {
        path: 'employees',
        component: EmployeeManagementComponent
      },
      {
        path: 'archive',
        component: ArchiveComponent
      },
      {
        path: 'manual-booking',
        component: ManualBookingComponent,
        children: [
          {
            path: '',
            loadChildren: () =>
              import('../../booking/booking.module').then((m) => m.BookingModule),
            data: { isAdminManualBooking: true }
          }
        ]
      },
      { path: '', redirectTo: 'bookings', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminShellRoutingModule {}

