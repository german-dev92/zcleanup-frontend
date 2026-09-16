/* tslint:disable */
/* eslint-disable */
import { BookingPricingSummaryDto } from './booking-pricing-summary-dto';
import { BookingSummaryDto } from './booking-summary-dto';
export interface CreateBookingResponseDto {
  data: BookingSummaryDto;
  discountApplied: boolean;
  message: string;
  pricing: BookingPricingSummaryDto;
  success: boolean;
}
