import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { CustomQuoteComponent } from './custom-quote.component';

const routes: Routes = [
  { path: '', component: CustomQuoteComponent }
];

@NgModule({
  declarations: [
    CustomQuoteComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class CustomQuoteModule { }
