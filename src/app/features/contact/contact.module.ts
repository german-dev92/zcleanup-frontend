import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { ContactComponent } from './contact.component';
import { GoogleMapsModule } from '@angular/google-maps';

const routes: Routes = [
  { path: '', component: ContactComponent }
];

@NgModule({
  declarations: [
    ContactComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    GoogleMapsModule,
    RouterModule.forChild(routes)
  ]
})
export class ContactModule { }
