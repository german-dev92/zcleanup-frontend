/* tslint:disable */
/* eslint-disable */
import { AppliedDiscountDto } from './applied-discount-dto';
import { PricePreviewBreakdownDto } from './price-preview-breakdown-dto';
import { PricePreviewFeesDto } from './price-preview-fees-dto';
export interface PricePreviewResponseDto {
  additionalBedroomsFee: number;
  appliedDiscounts: Array<AppliedDiscountDto>;
  assignedDistanceKm: null | {
};
  assignedZone: null | {
};
  baseServicePrice: number;
  breakdown: PricePreviewBreakdownDto;
  coverageStatus: 'inside' | 'borderline' | 'outside';
  discountAmount: number;
  discountApplied: boolean;
  discountEligible: boolean;
  discountPercent: number;
  discountRequested: boolean;
  discountedEstimatedPrice: number;
  distanceFee: number;
  distanceSurcharge: boolean;
  estimatedPrice: number;
  extrasTotal: number;
  fees: PricePreviewFeesDto;
  finalPrice: number;
  finalPricePreview: number;
  isBorderline: boolean;
  petsFee: number;
}
