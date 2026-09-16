/* tslint:disable */
/* eslint-disable */
export interface UpdateEmployeeDto {
  isActive?: boolean;
  name?: string;
  phone?: string;
  role?: 'admin' | 'supervisor' | 'employee';
}
