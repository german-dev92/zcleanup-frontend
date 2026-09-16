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

import { AssignBookingDto } from '../models/assign-booking-dto';
import { BookingMutationResponseDto } from '../models/booking-mutation-response-dto';
import { BookingSummaryDto } from '../models/booking-summary-dto';
import { CreateBookingDto } from '../models/create-booking-dto';
import { CreateBookingResponseDto } from '../models/create-booking-response-dto';
import { PricePreviewDto } from '../models/price-preview-dto';
import { PricePreviewResponseDto } from '../models/price-preview-response-dto';
import { UpdateBookingStatusDto } from '../models/update-booking-status-dto';

@Injectable({ providedIn: 'root' })
export class BookingService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `bookingControllerGetBookings()` */
  static readonly BookingControllerGetBookingsPath = '/booking';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerGetBookings()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetBookings$Response(
    params?: {
      status?: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'paid';
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<Array<BookingSummaryDto>>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerGetBookingsPath, 'get');
    if (params) {
      rb.query('status', params.status, {});
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<BookingSummaryDto>>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerGetBookings$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetBookings(
    params?: {
      status?: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'paid';
    },
    context?: HttpContext
  ): Observable<Array<BookingSummaryDto>> {
    return this.bookingControllerGetBookings$Response(params, context).pipe(
      map((r: StrictHttpResponse<Array<BookingSummaryDto>>): Array<BookingSummaryDto> => r.body)
    );
  }

  /** Path part for operation `bookingControllerCreateBooking()` */
  static readonly BookingControllerCreateBookingPath = '/booking';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerCreateBooking()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerCreateBooking$Response(
    params: {
      body: CreateBookingDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<CreateBookingResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerCreateBookingPath, 'post');
    if (params) {
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<CreateBookingResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerCreateBooking$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerCreateBooking(
    params: {
      body: CreateBookingDto
    },
    context?: HttpContext
  ): Observable<CreateBookingResponseDto> {
    return this.bookingControllerCreateBooking$Response(params, context).pipe(
      map((r: StrictHttpResponse<CreateBookingResponseDto>): CreateBookingResponseDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerGetAssignedBookings()` */
  static readonly BookingControllerGetAssignedBookingsPath = '/booking/assigned';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerGetAssignedBookings()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetAssignedBookings$Response(
    params?: {
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<Array<BookingSummaryDto>>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerGetAssignedBookingsPath, 'get');
    if (params) {
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<BookingSummaryDto>>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerGetAssignedBookings$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetAssignedBookings(
    params?: {
    },
    context?: HttpContext
  ): Observable<Array<BookingSummaryDto>> {
    return this.bookingControllerGetAssignedBookings$Response(params, context).pipe(
      map((r: StrictHttpResponse<Array<BookingSummaryDto>>): Array<BookingSummaryDto> => r.body)
    );
  }

  /** Path part for operation `bookingControllerGetById()` */
  static readonly BookingControllerGetByIdPath = '/booking/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerGetById()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetById$Response(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<BookingSummaryDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerGetByIdPath, 'get');
    if (params) {
      rb.path('id', params.id, {});
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<BookingSummaryDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerGetById$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerGetById(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<BookingSummaryDto> {
    return this.bookingControllerGetById$Response(params, context).pipe(
      map((r: StrictHttpResponse<BookingSummaryDto>): BookingSummaryDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerPricePreview()` */
  static readonly BookingControllerPricePreviewPath = '/booking/price-preview';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerPricePreview()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerPricePreview$Response(
    params: {
      body: PricePreviewDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<PricePreviewResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerPricePreviewPath, 'post');
    if (params) {
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<PricePreviewResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerPricePreview$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerPricePreview(
    params: {
      body: PricePreviewDto
    },
    context?: HttpContext
  ): Observable<PricePreviewResponseDto> {
    return this.bookingControllerPricePreview$Response(params, context).pipe(
      map((r: StrictHttpResponse<PricePreviewResponseDto>): PricePreviewResponseDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerUpdateBookingStatus()` */
  static readonly BookingControllerUpdateBookingStatusPath = '/booking/{id}/status';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerUpdateBookingStatus()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerUpdateBookingStatus$Response(
    params: {
      id: string;
      body: UpdateBookingStatusDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<BookingMutationResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerUpdateBookingStatusPath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<BookingMutationResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerUpdateBookingStatus$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerUpdateBookingStatus(
    params: {
      id: string;
      body: UpdateBookingStatusDto
    },
    context?: HttpContext
  ): Observable<BookingMutationResponseDto> {
    return this.bookingControllerUpdateBookingStatus$Response(params, context).pipe(
      map((r: StrictHttpResponse<BookingMutationResponseDto>): BookingMutationResponseDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerAssignBooking()` */
  static readonly BookingControllerAssignBookingPath = '/booking/{id}/assign';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerAssignBooking()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerAssignBooking$Response(
    params: {
      id: string;
      body: AssignBookingDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<BookingMutationResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerAssignBookingPath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
      rb.body(params.body, 'application/json');
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<BookingMutationResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerAssignBooking$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  bookingControllerAssignBooking(
    params: {
      id: string;
      body: AssignBookingDto
    },
    context?: HttpContext
  ): Observable<BookingMutationResponseDto> {
    return this.bookingControllerAssignBooking$Response(params, context).pipe(
      map((r: StrictHttpResponse<BookingMutationResponseDto>): BookingMutationResponseDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerStartBooking()` */
  static readonly BookingControllerStartBookingPath = '/booking/{id}/start';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerStartBooking()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerStartBooking$Response(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<BookingMutationResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerStartBookingPath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<BookingMutationResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerStartBooking$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerStartBooking(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<BookingMutationResponseDto> {
    return this.bookingControllerStartBooking$Response(params, context).pipe(
      map((r: StrictHttpResponse<BookingMutationResponseDto>): BookingMutationResponseDto => r.body)
    );
  }

  /** Path part for operation `bookingControllerCompleteBooking()` */
  static readonly BookingControllerCompleteBookingPath = '/booking/{id}/complete';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `bookingControllerCompleteBooking()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerCompleteBooking$Response(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<BookingMutationResponseDto>> {
    const rb = new RequestBuilder(this.rootUrl, BookingService.BookingControllerCompleteBookingPath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
    }

    return this.http.request(
      rb.build({ responseType: 'json', accept: 'application/json', context })
    ).pipe(
      filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
      map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<BookingMutationResponseDto>;
      })
    );
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `bookingControllerCompleteBooking$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  bookingControllerCompleteBooking(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<BookingMutationResponseDto> {
    return this.bookingControllerCompleteBooking$Response(params, context).pipe(
      map((r: StrictHttpResponse<BookingMutationResponseDto>): BookingMutationResponseDto => r.body)
    );
  }

}
