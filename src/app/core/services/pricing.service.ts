import { Injectable } from '@angular/core';
import { CleaningService } from '../models/service.model';
import { Extra } from '../models/extra.model';

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
      const base = this.lookupTablePrice([
        { key: [1,1], value: 120 },
        { key: [2,1], value: 140 },
        { key: [2,2], value: 160 },
        { key: [3,2], value: 180 },
        { key: [4,2], value: 210 },
        { key: [4,3], value: 250 },
      ], ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.stdPackage, b, bath, 1, 1));

      const extraBedrooms = this.clampInt(fv?.extraBedrooms, 0, 10);
      return base + extraBedrooms * 30;
    }

    if (slug === 'apartment-cleaning') {
      const base = this.lookupTablePrice([
        { key: [1,1], value: 110 },
        { key: [2,1], value: 130 },
        { key: [2,2], value: 140 },
        { key: [3,2], value: 170 },
        { key: [4,2], value: 190 },
      ], ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.aptPackage, b, bath, 1, 1));

      const extraBedrooms = this.clampInt(fv?.aptExtraBedrooms, 0, 10);
      return base + extraBedrooms * 20;
    }

    if (slug === 'deep-cleaning') {
      const base = this.lookupTablePrice([
        { key: [1,1], value: 180 },
        { key: [2,2], value: 240 },
        { key: [3,2], value: 280 },
        { key: [4,3], value: 360 },
      ], ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.deepPackage, b, bath, 1, 1));

      const extraBedrooms = this.clampInt(fv?.deepExtraBedrooms, 0, 10);
      return base + extraBedrooms * 40;
    }

    if (slug === 'move-in-move-out') {
      // Support three modes via dynamic fields if present; default to Move-Out
      const mode = String(fv?.moveMode || 'move_out');

      const moveOutBase = (() => {
        const fallbackBedrooms = Number(fv?.moveOutBedrooms ?? b) || 0;
        const fallbackBathrooms = Number(fv?.moveOutBathrooms ?? bath) || 0;
        const base = this.lookupTablePrice([
          { key: [1,1], value: 185 },
          { key: [2,2], value: 250 },
          { key: [3,2], value: 290 },
          { key: [4,3], value: 365 },
        ], ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.moPackage, fallbackBedrooms, fallbackBathrooms, 1, 1));

        const extraBedrooms = this.clampInt(fv?.moveOutExtraBedrooms, 0, 10);
        return base + extraBedrooms * 40;
      })();

      const moveInBase = (() => {
        const fallbackBedrooms = Number(fv?.moveInBedrooms ?? b) || 0;
        const fallbackBathrooms = Number(fv?.moveInBathrooms ?? bath) || 0;
        const base = this.lookupTablePrice([
          { key: [1,1], value: 120 },
          { key: [2,1], value: 130 },
          { key: [2,2], value: 130 },
          { key: [3,2], value: 150 },
          { key: [4,2], value: 170 },
          { key: [4,3], value: 170 },
        ], ...this.getBedroomsBathroomsFromPackageOrFallback(fv?.miPackage, fallbackBedrooms, fallbackBathrooms, 1, 1));

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

    // Quantity helpers (best-effort, optional)
    const windowsQty = this.clampInt(fv?.windowsQuantity ?? fv?.units ?? 1, 1, 5000);
    const laundryLoads = this.clampInt(fv?.laundryLoads ?? 1, 1, 2);

    const priceMap: Record<string, number> = {
      fridge: 30,
      oven: 30,
      cabinets: 35,
      heavy_buildup: 25,
      same_day: 20,
      garage: 30,
      organize_clothes: 30,
    };

    // Map common legacy names to new ones
    const alias: Record<string, string> = {
      windows_ext: 'windows_exterior',
      windowsExterior: 'windows_exterior',
      baseboards: 'heavy_buildup',
    };

    let total = 0;
    for (const raw of picked) {
      const name = alias[raw] ?? raw;
      if (name === 'windows_exterior') {
        total += 8 * windowsQty;
        continue;
      }
      if (name === 'laundry') {
        total += 15 * laundryLoads;
        continue;
      }
      const val = priceMap[name];
      if (typeof val === 'number') total += val;
      else {
        // Fallback to existing service extras map if defined
        const extra = service.extras?.find(e => e.name === raw || e.name === name);
        if (extra) total += (extra.priceMin ?? 0);
      }
    }
    return total;
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
