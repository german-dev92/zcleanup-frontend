import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { FooterComponent } from './layout/footer/footer.component';
import { SecurityInterceptor } from './core/interceptors/security.interceptor';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { HttpDebugInterceptor } from './core/interceptors/http-debug.interceptor';
import { environment } from '../environments/environment';
import { ApiModule } from './core/api/api.module';

const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: SecurityInterceptor, multi: true },
  ...(environment.production
    ? []
    : [{ provide: HTTP_INTERCEPTORS, useClass: HttpDebugInterceptor, multi: true }])
];

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FooterComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ApiModule.forRoot({ rootUrl: environment.apiBaseUrl })
  ],
  providers: httpInterceptorProviders,
  bootstrap: [AppComponent]
})
export class AppModule { }
