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

import { CreateEmployeeDto } from '../models/create-employee-dto';
import { UpdateEmployeeDto } from '../models/update-employee-dto';
import { UpdateEmployeeRoleDto } from '../models/update-employee-role-dto';

@Injectable({ providedIn: 'root' })
export class EmployeesService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `employeesControllerGetAll()` */
  static readonly EmployeesControllerGetAllPath = '/employees';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `employeesControllerGetAll()` instead.
   *
   * This method doesn't expect any request body.
   */
  employeesControllerGetAll$Response(
    params?: {
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, EmployeesService.EmployeesControllerGetAllPath, 'get');
    if (params) {
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
   * To access the full response (for headers, for example), `employeesControllerGetAll$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  employeesControllerGetAll(
    params?: {
    },
    context?: HttpContext
  ): Observable<void> {
    return this.employeesControllerGetAll$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `employeesControllerCreate()` */
  static readonly EmployeesControllerCreatePath = '/employees';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `employeesControllerCreate()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerCreate$Response(
    params: {
      body: CreateEmployeeDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, EmployeesService.EmployeesControllerCreatePath, 'post');
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
   * To access the full response (for headers, for example), `employeesControllerCreate$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerCreate(
    params: {
      body: CreateEmployeeDto
    },
    context?: HttpContext
  ): Observable<void> {
    return this.employeesControllerCreate$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `employeesControllerDelete()` */
  static readonly EmployeesControllerDeletePath = '/employees/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `employeesControllerDelete()` instead.
   *
   * This method doesn't expect any request body.
   */
  employeesControllerDelete$Response(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, EmployeesService.EmployeesControllerDeletePath, 'delete');
    if (params) {
      rb.path('id', params.id, {});
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
   * To access the full response (for headers, for example), `employeesControllerDelete$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  employeesControllerDelete(
    params: {
      id: string;
    },
    context?: HttpContext
  ): Observable<void> {
    return this.employeesControllerDelete$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `employeesControllerUpdate()` */
  static readonly EmployeesControllerUpdatePath = '/employees/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `employeesControllerUpdate()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerUpdate$Response(
    params: {
      id: string;
      body: UpdateEmployeeDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, EmployeesService.EmployeesControllerUpdatePath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
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
   * To access the full response (for headers, for example), `employeesControllerUpdate$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerUpdate(
    params: {
      id: string;
      body: UpdateEmployeeDto
    },
    context?: HttpContext
  ): Observable<void> {
    return this.employeesControllerUpdate$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `employeesControllerUpdateRole()` */
  static readonly EmployeesControllerUpdateRolePath = '/employees/{id}/role';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `employeesControllerUpdateRole()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerUpdateRole$Response(
    params: {
      id: string;
      body: UpdateEmployeeRoleDto
    },
    context?: HttpContext
  ): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(this.rootUrl, EmployeesService.EmployeesControllerUpdateRolePath, 'patch');
    if (params) {
      rb.path('id', params.id, {});
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
   * To access the full response (for headers, for example), `employeesControllerUpdateRole$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  employeesControllerUpdateRole(
    params: {
      id: string;
      body: UpdateEmployeeRoleDto
    },
    context?: HttpContext
  ): Observable<void> {
    return this.employeesControllerUpdateRole$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
