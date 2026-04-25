export interface BookingRequest {
  name: string;
  email: string;
  phone?: string;
  address: string;
  cleaningType: string;
  desiredDate: string;
  desiredTime: string;
  petsAtHome: boolean;
  useOwnProducts: boolean;
  applyFirstDiscount: boolean;
  distanceSurcharge?: boolean;
  frequency: string;
  extras: string[];
  dynamicFields: BookingDynamicFields;
}

export interface Booking {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
  cleaningType: string;
  desiredDate: string;
  desiredTime: string;
  frequency?: string;
  petsAtHome?: boolean;
  useOwnProducts?: boolean;
  applyFirstDiscount?: boolean;
  extras?: unknown[];
  estimatedPrice?: number;
  finalPricePreview?: number;
  dynamicFields?: BookingDynamicFields;
  status:
    | 'pending'
    | 'confirmed'
    | 'assigned'
    | 'in_progress'
    | 'completed'
    | 'paid'
    | 'cancelled';
  paymentUrl?: string;
  assignedEmployeeId?: string;
  assignedEmployeeEmail?: string;
  assignedSupervisor?: {
    employeeId?: string;
    name?: string;
  };
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  display?: BookingDisplayViewModel;
  payment?: {
    provider?: 'stripe' | 'square';
    status?: 'pending' | 'paid' | 'failed' | 'refunded';
  };
}

export type BookingDynamicFields = {
  distanceSurcharge?: boolean;
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
  additionalBedrooms?: number;

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

  postConstruction?: { hours?: number; cleaners?: number };
  windowCleaning?: { windowCount?: number };
};

export interface BookingResponse {
  success: boolean;
  message: string;
  bookingId?: string;
  discountApplied?: boolean;
  status?: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  data?: {
    _id?: string;
    status?: 'pending' | 'confirmed' | 'paid' | 'cancelled';
    applyFirstDiscount?: boolean;
    finalPricePreview?: number;
    estimatedPrice?: number;
  };
  pricing?: {
    finalPrice?: number;
    estimatedPrice?: number;
    discountApplied?: boolean;
  };
}

export interface DiscountCheckResponse {
  email: string;
  canUseDiscount: boolean;
}

export interface BookingDisplayViewModel {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  service?: {
    code?: string;
    label?: string;
  };
  schedule?: {
    date?: string;
    time?: string;
    frequency?: {
      code?: string;
      label?: string;
    };
  };
  property?: {
    address?: string;
    details?: Array<{ label: string; value: string }>;
  };
  extras?: {
    items?: Array<{ type?: string; label?: string; quantity?: number }>;
    summary?: string;
  };
  notes?: string;
  specialConditions?: string[];
  pricing?: {
    currency?: string;
    items?: Array<{ label: string; amount: number }>;
    total?: number;
  };
}
