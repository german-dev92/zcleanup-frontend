/**
 * @file src/testing/fixtures/booking.fixture.ts
 * @description Datos de ejemplo para usar en los tests del frontend.
 * 
 * ¿Por qué esto es profesional?
 * Evita repetir datos manuales en cada test y asegura consistencia en las pruebas.
 */

export const MOCK_BOOKING_RESPONSE = {
  success: true,
  message: 'Booking saved successfully',
  data: {
    _id: 'booking_123',
    name: 'Test User',
    email: 'test@example.com',
    status: 'pending'
  },
  pricing: {
    finalPrice: 150,
    estimatedPrice: 150,
    discountApplied: false
  }
};

export const MOCK_PRICE_PREVIEW = {
  finalPrice: 150,
  estimatedPrice: 150,
  items: [
    { label: 'Base service', amount: 150 }
  ],
  discountApplied: false,
  coverageStatus: 'inside'
};

export const MOCK_PRICE_PREVIEW_V2: any = {
  finalPrice: 150,
  estimatedPrice: 150,
  items: [{ label: 'Base service', amount: 150 }],
  discountApplied: false,
  coverageClassification: 'INSIDE',
  assignedZone: 'Odessa',
  isBorderline: false,
  distanceSurcharge: false,
  distanceKm: 14.8,
  lat: 28.15,
  lng: -82.56,
  closestZoneName: 'Odessa',
  closestZoneDistanceKm: 14.8,
  v2BorderlineFeeApplicable: false,
  borderlineOutsideThresholdKmV2: 1,
  pricing: {
    baseServicePrice: 150,
    additionalBedroomsFee: 0,
    specialServiceFee: 0,
    extrasTotal: 0,
    petsFee: 0,
    borderlineFee: 0,
    firstTimeDiscountApplied: false,
    firstTimeDiscountAmount: 0,
    finalPriceBeforeDiscount: 150,
    finalPrice: 150,
  },
};

export const MOCK_PRICE_PREVIEW_V2_BORDERLINE: any = {
  finalPrice: 175,
  estimatedPrice: 175,
  items: [{ label: 'Base service', amount: 150 }, { label: 'Borderline surcharge', amount: 25 }],
  discountApplied: false,
  coverageClassification: 'BORDERLINE',
  assignedZone: 'Oldsmar',
  isBorderline: true,
  distanceSurcharge: true,
  distanceKm: 9.4,
  lat: 28.04,
  lng: -82.66,
  closestZoneName: 'Oldsmar',
  closestZoneDistanceKm: 9.4,
  v2BorderlineFeeApplicable: true,
  borderlineOutsideThresholdKmV2: 1,
  pricing: {
    baseServicePrice: 150,
    additionalBedroomsFee: 0,
    specialServiceFee: 0,
    extrasTotal: 0,
    petsFee: 0,
    borderlineFee: 25,
    firstTimeDiscountApplied: false,
    firstTimeDiscountAmount: 0,
    finalPriceBeforeDiscount: 175,
    finalPrice: 175,
  },
};
