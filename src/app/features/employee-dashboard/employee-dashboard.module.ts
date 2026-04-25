import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { EmployeeDashboardComponent } from './employee-dashboard.component';

const routes: Routes = [{ path: '', component: EmployeeDashboardComponent }];

@NgModule({
  declarations: [EmployeeDashboardComponent],
  imports: [CommonModule, SharedModule, RouterModule.forChild(routes)]
})
export class EmployeeDashboardModule {}

