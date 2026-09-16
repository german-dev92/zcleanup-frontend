/* tslint:disable */
/* eslint-disable */
export interface CreateEmployeeDto {
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: 'admin' | 'supervisor' | 'employee';
}
