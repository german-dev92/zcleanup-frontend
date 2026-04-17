import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AdminBookingsComponent } from './admin-bookings.component';

const routes: Routes = [
  { path: '', component: AdminBookingsComponent }
];

@NgModule({
  declarations: [AdminBookingsComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class AdminBookingsModule {}

