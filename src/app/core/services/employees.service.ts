import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';

export type Employee = {
  id: string;
  email: string;
  isActive: boolean;
  name?: string;
  phone?: string;
  role?: string;
};

@Injectable({
  providedIn: 'root'
})
export class EmployeesService {
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listEmployees(): Observable<Employee[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/employees`).pipe(
      map((items) => {
        const raw = Array.isArray(items) ? items : [];
        return raw.map((e) => {
          const id = String(e?._id ?? e?.id ?? '').trim();
          const email = String(e?.userId?.email ?? e?.email ?? '').trim();
          const isActive = Boolean(e?.isActive ?? e?.userId?.active ?? false);
          const roleValue = String(e?.role ?? e?.userId?.role ?? '').trim();
          const name =
            typeof e?.name === 'string'
              ? e.name
              : typeof e?.userId?.name === 'string'
                ? e.userId.name
                : typeof e?.userId?.username === 'string'
                  ? e.userId.username
                  : undefined;
          const phone = typeof e?.phone === 'string' ? e.phone : undefined;
          const role = roleValue ? roleValue : undefined;
          return { id, email, isActive, name, phone, role };
        });
      })
    );
  }

  createEmployee(
    name: string,
    email: string,
    password: string,
    phone?: string,
    role?: string
  ): Observable<Employee> {
    const body = {
      email: String(email ?? '').trim(),
      password: String(password ?? ''),
      name: String(name ?? '').trim()
    };
    const phoneValue = String(phone ?? '').trim();
    const roleValue = String(role ?? '').trim();
    if (phoneValue) {
      (body as any).phone = phoneValue;
    }
    if (roleValue) {
      (body as any).role = roleValue;
    }

    return this.http.post<any>(`${this.apiBaseUrl}/employees`, body).pipe(
      map((e) => {
        const id = String(e?._id ?? e?.id ?? '').trim();
        const mappedEmail = String(e?.userId?.email ?? e?.email ?? '').trim();
        const isActive = Boolean(e?.isActive ?? e?.userId?.active ?? false);
        const mappedRoleValue = String(e?.role ?? e?.userId?.role ?? '').trim();
        const mappedName =
          typeof e?.name === 'string'
            ? e.name
            : typeof e?.userId?.name === 'string'
              ? e.userId.name
              : typeof e?.userId?.username === 'string'
                ? e.userId.username
                : undefined;
        const mappedPhone = typeof e?.phone === 'string' ? e.phone : undefined;
        const mappedRole = mappedRoleValue ? mappedRoleValue : undefined;
        return { id, email: mappedEmail, isActive, name: mappedName, phone: mappedPhone, role: mappedRole };
      })
    );
  }

  setEmployeeActive(id: string, isActive: boolean): Observable<Employee> {
    const employeeId = encodeURIComponent(String(id ?? '').trim());
    const body = { isActive: Boolean(isActive) };

    return this.http.patch<any>(`${this.apiBaseUrl}/employees/${employeeId}`, body).pipe(
      map((e) => {
        const mappedId = String(e?._id ?? e?.id ?? '').trim();
        const mappedEmail = String(e?.userId?.email ?? e?.email ?? '').trim();
        const mappedIsActive = Boolean(e?.isActive ?? e?.userId?.active ?? false);
        const mappedRoleValue = String(e?.role ?? e?.userId?.role ?? '').trim();
        const mappedName =
          typeof e?.name === 'string'
            ? e.name
            : typeof e?.userId?.name === 'string'
              ? e.userId.name
              : typeof e?.userId?.username === 'string'
                ? e.userId.username
                : undefined;
        const mappedPhone = typeof e?.phone === 'string' ? e.phone : undefined;
        const mappedRole = mappedRoleValue ? mappedRoleValue : undefined;
        return {
          id: mappedId,
          email: mappedEmail,
          isActive: mappedIsActive,
          name: mappedName,
          phone: mappedPhone,
          role: mappedRole
        };
      })
    );
  }

  updateEmployee(
    id: string,
    updates: { name?: string; phone?: string; role?: string }
  ): Observable<Employee> {
    const employeeId = encodeURIComponent(String(id ?? '').trim());
    const body: any = {};
    const name = String(updates?.name ?? '').trim();
    const phone = String(updates?.phone ?? '').trim();
    const role = String(updates?.role ?? '').trim();
    if (name) body.name = name;
    if (phone) body.phone = phone;
    if (role) body.role = role;

    return this.http.patch<any>(`${this.apiBaseUrl}/employees/${employeeId}`, body).pipe(
      map((e) => {
        const mappedId = String(e?._id ?? e?.id ?? '').trim();
        const mappedEmail = String(e?.userId?.email ?? e?.email ?? '').trim();
        const mappedIsActive = Boolean(e?.isActive ?? e?.userId?.active ?? false);
        const mappedRoleValue = String(e?.role ?? e?.userId?.role ?? '').trim();
        const mappedName =
          typeof e?.name === 'string'
            ? e.name
            : typeof e?.userId?.name === 'string'
              ? e.userId.name
              : typeof e?.userId?.username === 'string'
                ? e.userId.username
                : undefined;
        const mappedPhone = typeof e?.phone === 'string' ? e.phone : undefined;
        const mappedRole = mappedRoleValue ? mappedRoleValue : undefined;
        return {
          id: mappedId,
          email: mappedEmail,
          isActive: mappedIsActive,
          name: mappedName,
          phone: mappedPhone,
          role: mappedRole
        };
      })
    );
  }

  deleteEmployee(id: string): Observable<void> {
    const employeeId = encodeURIComponent(String(id ?? '').trim());
    return this.http.delete<void>(`${this.apiBaseUrl}/employees/${employeeId}`);
  }
}
