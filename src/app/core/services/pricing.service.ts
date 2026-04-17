import { Injectable } from '@angular/core';
import { CleaningService } from '../models/service.model';

export type PackageOption = { id: string; bedrooms: number; bathrooms: number; price: number };

export const STANDARD_PACKAGES: PackageOption[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, price: 120 },
  { id: '2-1', bedrooms: 2, bathrooms: 1, price: 140 },
  { id: '2-2', bedrooms: 2, bathrooms: 2, price: 160 },
  { id: '3-2', bedrooms: 3, bathrooms: 2, price: 180 },
  { id: '4-2', bedrooms: 4, bathrooms: 2, price: 210 },
  { id: '4-3', bedrooms: 4, bathrooms: 3, price: 250 }
];

export const APARTMENT_PACKAGES: PackageOption[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, price: 110 },
  { id: '2-1', bedrooms: 2, bathrooms: 1, price: 130 },
  { id: '2-2', bedrooms: 2, bathrooms: 2, price: 140 },
  { id: '3-2', bedrooms: 3, bathrooms: 2, price: 170 },
  { id: '4-2', bedrooms: 4, bathrooms: 2, price: 190 }
];

export const DEEP_PACKAGES: PackageOption[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, price: 180 },
  { id: '2-2', bedrooms: 2, bathrooms: 2, price: 240 },
  { id: '3-2', bedrooms: 3, bathrooms: 2, price: 280 },
  { id: '4-3', bedrooms: 4, bathrooms: 3, price: 360 }
];

export const MOVE_OUT_PACKAGES: PackageOption[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, price: 185 },
  { id: '2-2', bedrooms: 2, bathrooms: 2, price: 250 },
  { id: '3-2', bedrooms: 3, bathrooms: 2, price: 290 },
  { id: '4-3', bedrooms: 4, bathrooms: 3, price: 365 }
];

export const MOVE_IN_PACKAGES: PackageOption[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, price: 120 },
  { id: '2-1', bedrooms: 2, bathrooms: 1, price: 130 },
  { id: '2-2', bedrooms: 2, bathrooms: 2, price: 130 },
  { id: '3-2', bedrooms: 3, bathrooms: 2, price: 150 },
  { id: '4-2', bedrooms: 4, bathrooms: 2, price: 170 },
  { id: '4-3', bedrooms: 4, bathrooms: 3, price: 170 }
];

export type ExtraId =
  | 'fridge'
  | 'oven'
  | 'cabinets'
  | 'windows_exterior'
  | 'heavy_buildup'
  | 'same_day'
  | 'garage'
  | 'laundry'
  | 'organize_clothes';

export type ExtraCatalogItem = {
  id: ExtraId;
  label: string;
  fixedPrice?: number;
  unitPrice?: number;
  quantityControl?: 'windowsQuantity' | 'laundryLoads';
  maxQuantity?: number;
};

export const EXTRAS_CATALOG: ExtraCatalogItem[] = [
  { id: 'fridge', label: 'Inside Fridge', fixedPrice: 30 },
  { id: 'oven', label: 'Inside Oven', fixedPrice: 30 },
  { id: 'cabinets', label: 'Inside Cabinets/Drawers', fixedPrice: 35 },
  { id: 'windows_exterior', label: 'Outside Windows', unitPrice: 8, quantityControl: 'windowsQuantity' },
  { id: 'heavy_buildup', label: 'Heavy Buildup', fixedPrice: 25 },
  { id: 'same_day', label: 'Same Day', fixedPrice: 20 },
  { id: 'garage', label: 'Garage', fixedPrice: 30 },
  { id: 'laundry', label: 'Laundry', unitPrice: 15, quantityControl: 'laundryLoads', maxQuantity: 2 },
  { id: 'organize_clothes', label: 'Organize Clothes', fixedPrice: 30 }
];

export const EXTRA_ALIASES: Record<string, ExtraId> = {
  windows_ext: 'windows_exterior',
  windowsExterior: 'windows_exterior',
  baseboards: 'heavy_buildup'
};

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  constructor() {}

  calculateBreakdown(service: CleaningService, formValue: any, isExtraCharge: boolean = false): {
    basePrice: number;
    extrasPrice: number;
    borderlineFee: number;
    discount: number;
    finalPrice: number;
  } | 'custom' {
    const base = this.calculateBase(service, formValue);
    if (base === 'custom') {
      return 'custom';
    }

    const extras = this.calculateExtras(formValue, service);
    const borderlineFee = isExtraCharge ? 20 : 0;
    const preDiscount = base + extras + borderlineFee;
    const applyDiscount = formValue?.applyDiscount === true;
    const rawDiscount = applyDiscount ? preDiscount * 0.15 : 0;
    const discount = Number(rawDiscount.toFixed(2));
    const finalPrice = Math.max(0, Math.round(preDiscount - discount));

    return {
      basePrice: base,
      extrasPrice: extras,
      borderlineFee,
      discount,
      finalPrice
    };
  }

  calculatePrice(service: CleaningService, formValue: any, isExtraCharge: boolean = false): number | 'custom' {
    // Dispatch to pricing rules based on service
    const breakdown = this.calculateBreakdown(service, formValue, isExtraCharge);
    if (breakdown === 'custom') return 'custom';
    return breakdown.finalPrice;
  }

  private calculateBase(service: CleaningService, fv: any): number | 'custom' {
    const slug = service.slug;
    const b = Number(fv?.bedrooms) || 0;
    const bath = Number(fv?.bathrooms) || 0;

    if (slug === 'standard-cleaning') {
      const base = this.lookupTablePrice(
        this.toTableEntries(STANDARD_PACKAGES),
        ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.stdPackage, b, bath, 1, 1)
      );

      const extraBedrooms = this.clampInt(fv?.extraBedrooms, 0, 10);
      return base + extraBedrooms * 30;
    }

    if (slug === 'apartment-cleaning') {
      const base = this.lookupTablePrice(
        this.toTableEntries(APARTMENT_PACKAGES),
        ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.aptPackage, b, bath, 1, 1)
      );

      const extraBedrooms = this.clampInt(fv?.aptExtraBedrooms, 0, 10);
      return base + extraBedrooms * 20;
    }

    if (slug === 'deep-cleaning') {
      const base = this.lookupTablePrice(
        this.toTableEntries(DEEP_PACKAGES),
        ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.deepPackage, b, bath, 1, 1)
      );

      const extraBedrooms = this.clampInt(fv?.deepExtraBedrooms, 0, 10);
      return base + extraBedrooms * 40;
    }

    if (slug === 'move-in-move-out') {
      // Support three modes via dynamic fields if present; default to Move-Out
      const mode = String(fv?.moveMode || 'move_out');

      const moveOutBase = (() => {
        const fallbackBedrooms = Number(fv?.moveOutBedrooms ?? b) || 0;
        const fallbackBathrooms = Number(fv?.moveOutBathrooms ?? bath) || 0;
        const base = this.lookupTablePrice(
          this.toTableEntries(MOVE_OUT_PACKAGES),
          ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.moPackage, fallbackBedrooms, fallbackBathrooms, 1, 1)
        );

        const extraBedrooms = this.clampInt(fv?.moveOutExtraBedrooms, 0, 10);
        return base + extraBedrooms * 40;
      })();

      const moveInBase = (() => {
        const fallbackBedrooms = Number(fv?.moveInBedrooms ?? b) || 0;
        const fallbackBathrooms = Number(fv?.moveInBathrooms ?? bath) || 0;
        const base = this.lookupTablePrice(
          this.toTableEntries(MOVE_IN_PACKAGES),
          ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.miPackage, fallbackBedrooms, fallbackBathrooms, 1, 1)
        );

        const extraBedrooms = this.clampInt(fv?.moveInExtraBedrooms, 0, 10);
        return base + extraBedrooms * 30;
      })();

      if (mode === 'both') return moveInBase + moveOutBase;
      if (mode === 'move_in') return moveInBase;
      return moveOutBase; // default move_out
    }

    if (slug === 'post-construction-cleaning') {
      const hours = Number(fv?.hours);
      const cleaners = Number(fv?.cleaners);
      if (Number.isFinite(hours) && Number.isFinite(cleaners) && hours >= 1 && cleaners >= 1) {
        const extraHours = Math.max(0, Math.trunc(hours) - 1);
        const extraCleaners = Math.max(0, Math.trunc(cleaners) - 1);
        return 60 + extraHours * 40 + extraCleaners * 20;
      }
      return 'custom';
    }

    if (slug === 'window-cleaning') {
      const windows = Number(fv?.units) || 0;
      return windows * 8;
    }

    // Fallback: if service type marked custom and not matched above
    if (service.type === 'custom') return 'custom';
    return 0;
  }

  private calculateExtras(fv: any, service: CleaningService): number {
    const picked: string[] = Array.isArray(fv?.extras) ? fv.extras : [];
    if (picked.length === 0) return 0;

    const windowsQty = this.clampInt(fv?.windowsQuantity ?? fv?.units ?? 1, 1, 5000);
    const laundryLoads = this.clampInt(fv?.laundryLoads ?? 1, 1, 2);

    let total = 0;
    for (const raw of picked) {
      const name = (EXTRA_ALIASES[raw] ?? raw) as string;
      if (name === 'windows_exterior') {
        total += 8 * windowsQty;
        continue;
      }
      if (name === 'laundry') {
        total += 15 * laundryLoads;
        continue;
      }

      const catalogItem = EXTRAS_CATALOG.find(e => e.id === name);
      if (catalogItem && typeof catalogItem.fixedPrice === 'number') {
        total += catalogItem.fixedPrice;
        continue;
      }

      const extra = service.extras?.find(e => e.name === raw || e.name === name);
      if (extra) total += (extra.priceMin ?? 0);
    }
    return total;
  }

  private toTableEntries(packages: PackageOption[]): Array<{ key: [number, number], value: number }> {
    return packages.map(p => ({ key: [p.bedrooms, p.bathrooms], value: p.price }));
  }

  private lookupTablePrice(entries: Array<{ key: [number, number], value: number }>, bedrooms: number, bathrooms: number): number {
    for (const e of entries) {
      if (e.key[0] === bedrooms && e.key[1] === bathrooms) return e.value;
    }
    // If no exact match, choose closest by simple heuristic:
    // find same bedrooms with nearest bathrooms, else fall back to minimal entry and scale
    const sameBedrooms = entries.filter(e => e.key[0] === bedrooms);
    if (sameBedrooms.length) {
      let best = sameBedrooms[0];
      let delta = Math.abs(sameBedrooms[0].key[1] - bathrooms);
      for (const e of sameBedrooms) {
        const d = Math.abs(e.key[1] - bathrooms);
        if (d < delta) { best = e; delta = d; }
      }
      return best.value;
    }
    // Scale proportionally by bedrooms if possible
    const min = entries.reduce((a,b)=> a.value < b.value ? a : b);
    if (bedrooms > min.key[0]) {
      const step = 25; // generic step when outside table
      return min.value + (bedrooms - min.key[0]) * step;
    }
    return min.value;
  }

  private clampInt(value: unknown, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.trunc(n)));
  }

  private getBedroomsBathroomsFromPackageOrFallback(
    packageId: unknown,
    fallbackBedrooms: number,
    fallbackBathrooms: number,
    defaultBedrooms: number,
    defaultBathrooms: number
  ): [number, number] {
    const parsed = this.parsePackageId(packageId);
    if (parsed) return [parsed.bedrooms, parsed.bathrooms];
    const fb = Number.isFinite(fallbackBedrooms) && fallbackBedrooms > 0 ? Math.trunc(fallbackBedrooms) : defaultBedrooms;
    const fba = Number.isFinite(fallbackBathrooms) && fallbackBathrooms > 0 ? Math.trunc(fallbackBathrooms) : defaultBathrooms;
    return [fb, fba];
  }

  private parsePackageId(packageId: unknown): { bedrooms: number; bathrooms: number } | null {
    const value = String(packageId ?? '').trim();
    const match = /^(\d+)-(\d+)$/.exec(value);
    if (!match) return null;
    const bedrooms = Number(match[1]);
    const bathrooms = Number(match[2]);
    if (!Number.isFinite(bedrooms) || !Number.isFinite(bathrooms)) return null;
    if (bedrooms <= 0 || bathrooms <= 0) return null;
    return { bedrooms, bathrooms };
  }
}
