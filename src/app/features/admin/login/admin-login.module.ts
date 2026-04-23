import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { AdminLoginComponent } from './admin-login.component';

const routes: Routes = [{ path: '', component: AdminLoginComponent }];

@NgModule({
  declarations: [AdminLoginComponent],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class AdminLoginModule {}

