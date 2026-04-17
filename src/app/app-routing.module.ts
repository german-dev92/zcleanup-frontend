import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'about',
    loadChildren: () => import('./features/about/about.module').then(m => m.AboutModule)
  },
  {
    path: 'services',
    loadChildren: () => import('./features/services/services.module').then(m => m.ServicesModule)
  },
  {
    path: 'contact',
    loadChildren: () => import('./features/contact/contact.module').then(m => m.ContactModule)
  },
  {
    path: 'book-service',
    loadChildren: () => import('./features/booking/booking.module').then(m => m.BookingModule)
  },
  {
    path: 'promotions',
    loadChildren: () => import('./features/promotions/promotions.module').then(m => m.PromotionsModule)
  },
  {
    path: 'admin/bookings',
    loadChildren: () => import('./features/admin/bookings/admin-bookings.module').then(m => m.AdminBookingsModule)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
