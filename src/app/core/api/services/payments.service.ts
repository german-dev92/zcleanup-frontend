/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { RequestBuilder } from '../request-builder';

import { CreateCheckoutSessionDto } from '../models/create-checkout-session-dto';

@Injectable({ providedIn: 'root' })
export class PaymentsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `paymentsControllerCreateCheckoutSession()` */
  static readonly PaymentsControllerCreateCheckoutSessionPath = '/payments/checkout-session';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `paymentsControllerCreateCheckoutSession()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  paymentsControllerCreateCheckoutSession$Response(
    params: {
      body: CreateCheckoutSessionDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, PaymentsService.PaymentsControllerCreateCheckoutSessionPath, 'post');
    if (params) {
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'text', accept: '*/*', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return (r as HttpResponse<any>).clone({ body: undefined }) as StrictHttpResponse<void>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `paymentsControllerCreateCheckoutSession$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  paymentsControllerCreateCheckoutSession(
    params: {
      body: CreateCheckoutSessionDto
    },
    context?: HttpContext
  ): Observable<void> {
    return this.paymentsControllerCreateCheckoutSession$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
