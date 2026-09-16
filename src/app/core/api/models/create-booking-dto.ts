/* tslint:disable */
/* eslint-disable */
export interface CreateBookingDto {
  additionalBedrooms?: number;
  address?: string;
  applyFirstDiscount?: boolean;
  assignedZone?: string;
  bathrooms?: number;
  bedrooms?: number;
  cleaningType: string;
  desiredDate: string;
  desiredTime: string;
  distanceKm?: number;
  distanceSurcharge?: boolean;
  dynamicFields?: {
};
  email: string;
  estimatedPrice?: number;
  extras?: Array<{
}>;
  finalPricePreview?: number;
  frequency?: string;
  isBorderline?: boolean;
  lat?: number;
  lng?: number;
  moveMode?: string;
  name: string;
  petsAtHome?: boolean;
  phone?: string;
  postConstruction?: {
};
  serviceType?: string;
  useOwnProducts?: boolean;
  windowCleaning?: {
};
}
