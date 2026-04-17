export interface BookingRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  cleaningType: string;
  desiredDate: string;
  desiredTime: string;
  petsAtHome: boolean;
  useOwnProducts: boolean;
  applyFirstDiscount: boolean;
  frequency: string;
  extras: string[];
  dynamicFields: BookingDynamicFields;
  estimatedPrice: number | 'custom';
  finalPricePreview: number;
}

export type BookingDynamicFields = {
  windowsQuantity?: number;
  laundryLoads?: number;

  stdPackage?: string;
  extraBedrooms?: number;

  aptPackage?: string;
  aptExtraBedrooms?: number;

  deepPackage?: string;
  deepExtraBedrooms?: number;

  bedrooms?: number;
  bathrooms?: number;

  moveMode?: 'move_out' | 'move_in' | 'both';
  moPackage?: string;
  miPackage?: string;
  moveOutExtraBedrooms?: number;
  moveInExtraBedrooms?: number;
  moveOutBedrooms?: number;
  moveOutBathrooms?: number;
  moveInBedrooms?: number;
  moveInBathrooms?: number;

  hours?: number;
  cleaners?: number;

  units?: number;
};

export interface BookingResponse {
  success: boolean;
  message: string;
  bookingId?: string;
  discountApplied?: boolean;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

export interface DiscountCheckResponse {
  email: string;
  canUseDiscount: boolean;
}
