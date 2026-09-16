/* tslint:disable */
/* eslint-disable */
export interface BookingSummaryDto {
  '_id': string;
  address?: string;
  applyFirstDiscount?: boolean;
  assignedAt?: string;
  assignedEmployeeEmail?: string;
  assignedEmployeeId?: string;
  assignedZone?: string;
  cleaningType?: string;
  completedAt?: string;
  desiredDate?: string;
  desiredTime?: string;
  distanceKm?: number;
  distanceSurcharge?: boolean;
  email?: string;
  estimatedPrice?: number;
  extras?: Array<{
}>;
  finalPricePreview?: number;
  frequency?: string;
  isBorderline?: boolean;
  lat?: number;
  lng?: number;
  name?: string;
  paymentUrl?: string;
  petsAtHome?: boolean;
  phone?: string;
  startedAt?: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'paid' | 'cancelled';
  useOwnProducts?: boolean;
}
