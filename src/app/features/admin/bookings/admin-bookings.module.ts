import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AdminBookingsComponent } from './admin-bookings.component';
import { FormsModule } from '@angular/forms';

const routes: Routes = [
  { path: '', component: AdminBookingsComponent }
];

@NgModule({
  declarations: [AdminBookingsComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class AdminBookingsModule {}

