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

import { CheckDiscountDto } from '../models/check-discount-dto';
import { CheckDiscountResponseDto } from '../models/check-discount-response-dto';

@Injectable({ providedIn: 'root' })
export class DiscountsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `discountsControllerCheckDiscount()` */
  static readonly DiscountsControllerCheckDiscountPath = '/discounts/check';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `discountsControllerCheckDiscount()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  discountsControllerCheckDiscount$Response(
    params: {
      body: CheckDiscountDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<CheckDiscountResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, DiscountsService.DiscountsControllerCheckDiscountPath, 'post');
    if (params) {
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<CheckDiscountResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `discountsControllerCheckDiscount$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  discountsControllerCheckDiscount(
    params: {
      body: CheckDiscountDto
    },
    context?: HttpContext
  ): Observable<CheckDiscountResponseDto> {
    return this.discountsControllerCheckDiscount$Response(params, context).pipe(
      map((r: StrictHttpResponse<CheckDiscountResponseDto>): CheckDiscountResponseDto => r.body)
    );
  }

}
