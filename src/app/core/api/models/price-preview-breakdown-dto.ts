/* tslint:disable */
/* eslint-disable */
import { PricePreviewItemDto } from './price-preview-item-dto';
export interface PricePreviewBreakdownDto {
  additionalBedroomsFee: number;
  baseServicePrice: number;
  discountAmount: number;
  discountPercent: number;
  discountedEstimatedPrice: number;
  distanceFee: number;
  estimatedBase: number;
  extrasTotal: number;
  finalPrice: number;
  items: Array<PricePreviewItemDto>;
  petsFee: number;
}
