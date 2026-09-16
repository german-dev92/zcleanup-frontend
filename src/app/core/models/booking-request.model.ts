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
  commercialStatus?:
    | 'quote_requested'
    | 'under_review'
    | 'quoted_draft'
    | 'quote_sent'
    | 'quote_accepted'
    | 'quote_rejected'
    | 'quote_expired'
    | 'closed_without_sale'
    | 'legacy_direct_booking';
  paymentLifecycleStatus?:
    | 'not_ready'
    | 'invoice_ready'
    | 'checkout_created'
    | 'payment_pending'
    | 'paid'
    | 'payment_failed'
    | 'refunded'
    | 'voided';
  quote?: BookingQuoteViewModel;
  payment?: {
    provider?: 'stripe' | 'square';
    status?: 'pending' | 'paid' | 'failed' | 'refunded';
  };

  firstServiceDiscountRequested?: boolean;
  discountApplied?: boolean;
  discountAmount?: number;
  discountPercent?: number;
  usesOwnCleaningProducts?: boolean;
  cleaningProductNotes?: string;
  petSafetyNotes?: string;

  finalAdminApprovedPrice?: number;
  adminAdjustedAmountUsd?: number;
  priceAdjustmentReason?: string;

  bedrooms?: number;
  bathrooms?: number;
  additionalBedrooms?: number;
  specialServiceId?: string;
  regularCleaningPackageId?: string;
  notes?: string;
  borderlineFee?: number;
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
  address?: string;
  canUseDiscount: boolean;
}

export type AdminQuoteDiscountType =
  | 'none'
  | 'regular_client'
  | 'first_time_customer'
  | 'loyalty_customer';

export const ADMIN_QUOTE_DISCOUNT_OPTIONS: ReadonlyArray<{
  id: AdminQuoteDiscountType;
  percent: number;
  label: string;
}> = [
  { id: 'none', percent: 0, label: 'None — 0%' },
  {
    id: 'regular_client',
    percent: 10,
    label: 'Regular Client Discount — 10%',
  },
  {
    id: 'first_time_customer',
    percent: 15,
    label: 'First-Time Customer Discount — 15%',
  },
  {
    id: 'loyalty_customer',
    percent: 20,
    label: 'Loyalty Customer Discount — 20%',
  },
] as const;

export interface BookingQuoteManualAdjustmentViewModel {
  type?: 'fixed' | 'percent';
  label?: string;
  amount?: number;
  reason?: string;
}

export interface BookingQuoteViewModel {
  version?: number;
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  baseCalculatedPrice?: number;
  finalQuotedPrice?: number;
  manualAdjustments?: BookingQuoteManualAdjustmentViewModel[];
  discountType?: AdminQuoteDiscountType;
  discountPercent?: number;
  discountAmount?: number;
  discountReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  expiresAt?: string;
  customerMessage?: string;
  internalNotes?: string;
}

export interface AdminQuoteDraftManualAdjustmentInput {
  type: 'fixed' | 'percent';
  label: string;
  amount: number;
  reason?: string;
}

export interface AdminQuoteDraftInput {
  baseCalculatedPrice?: number;
  finalQuotedPrice?: number;
  manualAdjustments?: AdminQuoteDraftManualAdjustmentInput[];
  discountType?: AdminQuoteDiscountType;
  discountReason?: string;
  expiresAt?: string;
  customerMessage?: string;
  internalNotes?: string;
}

export interface AdminRejectQuoteInput {
  internalNotes?: string;
  rejectionReason?: string;
}

export interface BookingPricingSummary {
  percent: number;
  amount: number;
  estimatedPrice?: number;
  finalPricePreview?: number;
}

export interface AdminBookingMutationResponse {
  success: boolean;
  message: string;
  data: Booking;
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

export interface AdminCancelBookingInput {
  internalNotes?: string;
  cancellationReason?: string;
}

export interface AdminConfirmAndSendPaymentResponse {
  success: boolean;
  message: string;
  data?: Booking;
  wasAlreadyIssued: boolean;
  stripeSessionId?: string | null;
  customerEmailSent: boolean;
}

export interface AdminDeletePermanentReAuth {
  email: string;
  password: string;
}

export interface AdminDeletePermanentResponse {
  success: boolean;
  message: string;
  deletedId: string;
  deletedPayments: number;
  verifiedBy: string;
}
