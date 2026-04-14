import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PromotionsComponent } from './promotions.component';

const routes: Routes = [
  { path: '', component: PromotionsComponent }
];

@NgModule({
  declarations: [
    PromotionsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class PromotionsModule { }
