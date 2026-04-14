import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('calculates standard-cleaning additional bedrooms at $30/bedroom without shifting base package', () => {
    const breakdown = service.calculateBreakdown(
      { slug: 'standard-cleaning', type: 'standard' } as any,
      { stdPackage: '2-1', extraBedrooms: 1, bedrooms: 3, bathrooms: 1 },
      false
    ) as any;

    expect(breakdown.basePrice).toBe(170);
  });

  it('calculates deep-cleaning additional bedrooms at $40/bedroom without shifting base package', () => {
    const breakdown = service.calculateBreakdown(
      { slug: 'deep-cleaning', type: 'standard' } as any,
      { deepPackage: '1-1', deepExtraBedrooms: 2, bedrooms: 3, bathrooms: 1 },
      false
    ) as any;

    expect(breakdown.basePrice).toBe(260);
  });

  it('calculates apartment-cleaning additional bedrooms at $20/bedroom based on aptPackage', () => {
    const breakdown = service.calculateBreakdown(
      { slug: 'apartment-cleaning', type: 'standard' } as any,
      { aptPackage: '2-2', aptExtraBedrooms: 2, bedrooms: 4, bathrooms: 2 },
      false
    ) as any;

    expect(breakdown.basePrice).toBe(180);
  });

  it('calculates move-in and move-out additional bedrooms with different rates and no leakage', () => {
    const moveIn = service.calculateBreakdown(
      { slug: 'move-in-move-out', type: 'standard' } as any,
      { moveMode: 'move_in', miPackage: '2-1', moveInExtraBedrooms: 2, moPackage: '4-3', moveOutExtraBedrooms: 10 },
      false
    ) as any;

    expect(moveIn.basePrice).toBe(190);

    const moveOut = service.calculateBreakdown(
      { slug: 'move-in-move-out', type: 'standard' } as any,
      { moveMode: 'move_out', moPackage: '2-2', moveOutExtraBedrooms: 3, miPackage: '4-3', moveInExtraBedrooms: 10 },
      false
    ) as any;

    expect(moveOut.basePrice).toBe(370);
  });

  it('calculates move-in + move-out total when mode is both', () => {
    const both = service.calculateBreakdown(
      { slug: 'move-in-move-out', type: 'standard' } as any,
      {
        moveMode: 'both',
        miPackage: '2-1',
        moveInExtraBedrooms: 1,
        moPackage: '2-2',
        moveOutExtraBedrooms: 2
      },
      false
    ) as any;

    expect(both.basePrice).toBe(130 + 30 + 250 + 80);
  });

  it('calculates post-construction pricing with independent hours and employees', () => {
    const base = service.calculateBreakdown(
      { slug: 'post-construction-cleaning', type: 'standard' } as any,
      { hours: 1, cleaners: 1 },
      false
    ) as any;
    expect(base.basePrice).toBe(60);

    const moreHours = service.calculateBreakdown(
      { slug: 'post-construction-cleaning', type: 'standard' } as any,
      { hours: 3, cleaners: 1 },
      false
    ) as any;
    expect(moreHours.basePrice).toBe(60 + 2 * 40);

    const morePeople = service.calculateBreakdown(
      { slug: 'post-construction-cleaning', type: 'standard' } as any,
      { hours: 1, cleaners: 4 },
      false
    ) as any;
    expect(morePeople.basePrice).toBe(60 + 3 * 20);

    const both = service.calculateBreakdown(
      { slug: 'post-construction-cleaning', type: 'standard' } as any,
      { hours: 2, cleaners: 2 },
      false
    ) as any;
    expect(both.basePrice).toBe(60 + 40 + 20);
  });

  it('calculates add-on quantities for outside windows and laundry', () => {
    const breakdown = service.calculateBreakdown(
      { slug: 'standard-cleaning', type: 'standard' } as any,
      { stdPackage: '1-1', extraBedrooms: 0, extras: ['windows_exterior', 'laundry'], windowsQuantity: 3, laundryLoads: 2 },
      false
    ) as any;

    expect(breakdown.basePrice).toBe(120);
    expect(breakdown.extrasPrice).toBe(3 * 8 + 2 * 15);
  });

  it('uses pricing service as the single source of truth for discount rounding and final price', () => {
    const noDiscount = service.calculateBreakdown(
      { slug: 'standard-cleaning', type: 'standard' } as any,
      { stdPackage: '1-1', extraBedrooms: 0, applyDiscount: false },
      false
    ) as any;
    expect(noDiscount.discount).toBe(0);
    expect(noDiscount.finalPrice).toBe(120);

    const withDiscount = service.calculateBreakdown(
      { slug: 'standard-cleaning', type: 'standard' } as any,
      { stdPackage: '1-1', extraBedrooms: 0, applyDiscount: true },
      false
    ) as any;
    expect(withDiscount.discount).toBe(18);
    expect(withDiscount.finalPrice).toBe(102);
  });
});
