/**
 * @file pricing-catalogs-v2.ts
 * @description Catálogos CENTRALIZADOS V2 (Frontend).
 *
 * MANTENIDO EN PARALELO EXACTO CON:
 *   zcleanup-backend/src/booking/catalogs/pricing-catalogs-v2.ts
 *
 * El frontend usa estos catálogos para:
 *  - Renderizar las opciones válidas al usuario (sin depender de slugs legacy
 *    dispersos en booking.component.ts).
 *  - Aplicar reglas de UI como incompatibilidades, disabled state, máximos.
 *  - Construir el payload del price-preview / booking V2.
 *  - Renderizar el modal ⓘ de Special Services.
 *
 * ADVERTENCIA:
 *  - EL PRECIO QUE MUESTRA EL FRONTEND ES SOLAMENTE UNA PREVIA.
 *  - LA ÚNICA VERDAD DE PRECIOS ESTÁ EN EL BACKEND (BookingService).
 *  - NUNCA agregar lógica de pricing final distinta aquí.
 */

export type PricingModelVersion = 'V1' | 'V2';

// ======================================================================
// 1. REGULAR CLEANING – PAQUETES BASE
// ======================================================================
export interface RegularCleaningPackageV2 {
  id: string;
  bedrooms: number;
  bathrooms: number;
  basePrice: number;
  label: string;
}

export const REGULAR_CLEANING_BASE_PRICES_V2: Record<string, number> = {
  '1/1': 110,
  '2/1': 130,
  '2/2': 130,
  '3/1': 150,
  '3/2': 150,
  '4/2': 180,
  '4/3': 180,
  '5/2': 200,
  '5/3': 210,
};

export const REGULAR_CLEANING_PACKAGES_V2: RegularCleaningPackageV2[] = [
  { id: '1-1', bedrooms: 1, bathrooms: 1, basePrice: 110, label: '1 bed / 1 bath' },
  { id: '2-1', bedrooms: 2, bathrooms: 1, basePrice: 130, label: '2 bed / 1 bath' },
  { id: '2-2', bedrooms: 2, bathrooms: 2, basePrice: 130, label: '2 bed / 2 bath' },
  { id: '3-1', bedrooms: 3, bathrooms: 1, basePrice: 150, label: '3 bed / 1 bath' },
  { id: '3-2', bedrooms: 3, bathrooms: 2, basePrice: 150, label: '3 bed / 2 bath' },
  { id: '4-2', bedrooms: 4, bathrooms: 2, basePrice: 180, label: '4 bed / 2 bath' },
  { id: '4-3', bedrooms: 4, bathrooms: 3, basePrice: 180, label: '4 bed / 3 bath' },
  { id: '5-2', bedrooms: 5, bathrooms: 2, basePrice: 200, label: '5 bed / 2 bath' },
  { id: '5-3', bedrooms: 5, bathrooms: 3, basePrice: 210, label: '5 bed / 3 bath' },
];

export const EXTRA_BEDROOM_PRICE_V2 = 40;

// ======================================================================
// 2. SPECIAL SERVICES (contenido FUNCIONAL DEFINITIVO — modal ⓘ)
// ======================================================================
export type SpecialServiceIdV2 =
  | 'deep_home_cleaning'
  | 'move_in_out'
  | 'post_construction'
  | 'extreme_home_cleaning';

export interface SpecialServiceV2 {
  id: SpecialServiceIdV2;
  label: string;
  shortDescription: string;
  description: string;
  flatFee: number;
  includes: string[];
  doesNotInclude: string[];
  protectionNote?: string;
  incompatibleExtraIds: OptionalExtraIdV2[];
  includedExtraReasons?: Partial<Record<OptionalExtraIdV2, string>>;
}

export const SPECIAL_SERVICES_V2: Record<SpecialServiceIdV2, SpecialServiceV2> = {
  deep_home_cleaning: {
    id: 'deep_home_cleaning',
    label: 'Deep Home Cleaning',
    shortDescription:
      'A more thorough interior home cleaning for homes that need extra attention beyond a regular visit — without being extreme or specialized work.',
    description:
      'A more thorough interior home cleaning for homes that need extra attention beyond a regular visit — without being extreme or specialized work.',
    flatFee: 80,
    includes: [
      'Dusting of accessible surfaces.',
      'Wiping down accessible surfaces and furniture.',
      'Vacuuming carpets and area rugs.',
      'Sweeping and mopping floors.',
      'Cleaning accessible doors and frames.',
      'Wiping light switches and outlet plates.',
      'Exterior wipe-down of appliances.',
      'More detailed bathroom cleaning.',
      'More detailed kitchen cleaning.',
      'Removal of dust and buildup from accessible areas.',
      'Extra attention to corners, baseboards, and commonly overlooked areas.',
    ],
    doesNotInclude: [
      'Inside the oven.',
      'Inside the refrigerator.',
      'Interior of closets.',
      'Organizing clothes or personal belongings.',
      'Window cleaning.',
      'Exterior of the home.',
      'Garage.',
      'Moving heavy furniture.',
      'Post-construction cleaning.',
      'Extreme accumulation of dirt, debris, or trash.',
    ],
    incompatibleExtraIds: ['heavy_furniture_moving'],
  },
  move_in_out: {
    id: 'move_in_out',
    label: 'Move-In / Move-Out Cleaning',
    shortDescription:
      'Already includes closet interiors, inside the oven, and inside the refrigerator. Those extras are NOT available separately with this service.',
    description:
      'Cleaning designed to leave a home move-in ready or refreshed after moving out.',
    flatFee: 75,
    includes: [
      'Dusting of surfaces.',
      'Vacuuming.',
      'Sweeping and mopping.',
      'Bathroom cleaning.',
      'Kitchen cleaning.',
      'Cleaning accessible doors and frames.',
      'Wiping accessible baseboards.',
      'Interior of closets/cabinets.',
      'Inside the oven.',
      'Inside the refrigerator.',
      'General wipe-down of all interior surfaces.',
    ],
    doesNotInclude: [
      'Window cleaning.',
      'Exterior of the home.',
      'Garage.',
      'Post-construction cleaning.',
      'Moving heavy furniture.',
      'Removal of large amounts of trash.',
      'Cleaning personal items left inside the property.',
      'Specialized treatment for permanent stains, mold, heavy grease, etc.',
    ],
    incompatibleExtraIds: ['closet_organization', 'oven', 'refrigerator'],
    includedExtraReasons: {
      closet_organization: 'Closet interiors are already included. Note: organizing clothes/belongings is NOT included.',
      oven: 'Inside the oven is already included with this service.',
      refrigerator: 'Inside the refrigerator is already included with this service.',
    },
  },
  post_construction: {
    id: 'post_construction',
    label: 'Post-Construction Cleaning',
    shortDescription:
      'Heavy post-construction cleanup add-on applied on top of the Regular Cleaning base.',
    description:
      'Interior cleanup after construction, remodeling, or renovation work.',
    flatFee: 200,
    includes: [
      'Removal of construction dust.',
      'Detailed vacuuming of surfaces.',
      'Sweeping and mopping floors.',
      'Wiping accessible surfaces.',
      'Cleaning doors and frames.',
      'Wiping baseboards.',
      'Bathroom cleaning.',
      'Kitchen cleaning.',
      'Dust removal from reasonably accessible hard-to-reach areas.',
      'Removal of light construction debris.',
      'General preparation of the home for occupancy.',
    ],
    doesNotInclude: [
      'Removal of large amounts of construction debris.',
      'Hauling away building materials.',
      'Demolition.',
      'Moving heavy furniture out.',
      'Exterior cleaning.',
      'Exterior windows or high-altitude work.',
      'Professional removal of cured paint, cement, adhesive, or hardened materials.',
      'Mold, asbestos, or other hazardous materials.',
      'Work requiring specialized tools or equipment.',
    ],
    protectionNote:
      'Heavy construction debris or specialized cleaning may require a separate quote.',
    incompatibleExtraIds: [
      'closet_organization',
      'laundry',
      'garage',
      'full_garage',
    ],
  },
  extreme_home_cleaning: {
    id: 'extreme_home_cleaning',
    label: 'Extreme Home Cleaning',
    shortDescription:
      'Intensive whole-home cleaning for properties that need significantly more work than a regular or deep clean. NOT an unlimited service regardless of condition.',
    description:
      'Intensive whole-home cleaning for properties that need significantly more work than a regular or deep clean. NOT an unlimited service regardless of condition.',
    flatFee: 250,
    includes: [
      'Intensive cleaning of surfaces.',
      'Detailed dusting.',
      'Deep vacuuming.',
      'Sweeping and mopping.',
      'Intensive bathroom cleaning.',
      'Intensive kitchen cleaning.',
      'Wiping doors and frames.',
      'Cleaning accessible baseboards.',
      'Removal of significant dust and grime buildup.',
      'Cleaning of commonly hard-to-maintain areas.',
      'Extra attention to caked-on grease and accumulated dirt.',
      'General intensive cleaning of all interior areas.',
    ],
    doesNotInclude: [
      'Windows.',
      'Exterior of the home.',
      'Garage.',
      'Moving heavy furniture.',
      'Large volumes of trash.',
      'Debris removal.',
      'Biohazards.',
      'Severe mold.',
      'Pest infestations.',
      'Hazardous materials.',
      'Specialized cleaning that requires industrial machinery.',
      'Organization services.',
      'Laundry service.',
      'Cleaning personal belongings.',
    ],
    protectionNote:
      'Properties with extreme trash accumulation, hazardous materials, biohazards, severe mold, or conditions requiring specialized equipment may require an additional on-site assessment and a separate quote.',
    incompatibleExtraIds: [
      'closet_organization',
      'laundry',
      'garage',
      'full_garage',
    ],
  },
};

export const SPECIAL_SERVICES_ARRAY_V2: SpecialServiceV2[] =
  Object.values(SPECIAL_SERVICES_V2);

// ======================================================================
// 3. OPTIONAL EXTRAS
// ======================================================================
export type OptionalExtraIdV2 =
  | 'closet_organization'
  | 'oven'
  | 'refrigerator'
  | 'laundry'
  | 'garage'
  | 'full_garage'
  | 'heavy_furniture_moving'
  | 'same_day'
  | 'outside_window';

export interface OptionalExtraV2 {
  id: OptionalExtraIdV2;
  label: string;
  helperLabel?: string;
  unitPrice: number;
  kind: 'bool' | 'qty';
  maxQuantity?: number;
  minQuantity?: number;
  unitLabel?: string;
  infoOnly?: boolean;
  shortDescription: string;
  modal: {
    description: string;
    includes: string[];
    doesNotInclude: string[];
    priceLabel: string;
    termsAndConditions: string;
  };
}

export const OPTIONAL_EXTRAS_V2: Record<OptionalExtraIdV2, OptionalExtraV2> = {
  closet_organization: {
    id: 'closet_organization',
    label: 'Closet / Clothes Organization',
    unitPrice: 25,
    kind: 'bool',
    shortDescription: 'Light organization of clothing and closet areas.',
    modal: {
      description: 'Light organization of clothing and closet areas to create a cleaner and more orderly space.',
      includes: [
        'Folding and arranging clothing that is already clean.',
        'Organizing clothing within existing closet or wardrobe space.',
        'Basic arrangement of shelves, drawers, and hanging items.',
        'Light organization of accessible clothing areas.',
      ],
      doesNotInclude: [
        'Laundry or washing clothes.',
        'Dry cleaning.',
        'Disposal of unwanted belongings.',
        'Moving heavy furniture.',
        'Deep cleaning inside heavily cluttered areas.',
        'Personal item sorting that requires extensive decision-making.',
      ],
      priceLabel: '$25',
      termsAndConditions:
        'This service is intended for light organization only. The customer is responsible for deciding what should be kept, discarded, donated, or relocated. ZCLEANUP does not provide professional organizing, packing, unpacking, or disposal services under this Extra.',
    },
  },
  oven: {
    id: 'oven',
    label: 'Oven',
    unitPrice: 25,
    kind: 'bool',
    shortDescription: 'Detailed cleaning of the interior of the oven.',
    modal: {
      description: 'Detailed cleaning of the interior of the oven.',
      includes: [
        'Interior oven cleaning.',
        'Removal of normal grease and food residue.',
        'Cleaning of accessible oven surfaces.',
        'Cleaning of the oven door interior.',
      ],
      doesNotInclude: [
        'Removal of permanently baked-on material that requires specialized equipment.',
        'Appliance repair.',
        'Removal of damaged or heavily deteriorated surfaces.',
        'Cleaning of inaccessible internal components.',
      ],
      priceLabel: '$25',
      termsAndConditions:
        'The oven must be safely accessible. Extremely heavy buildup, carbonized residue, or conditions requiring specialized treatment may require an additional assessment or quote.',
    },
  },
  refrigerator: {
    id: 'refrigerator',
    label: 'Refrigerator',
    unitPrice: 25,
    kind: 'bool',
    shortDescription: 'Detailed cleaning of the interior of the refrigerator.',
    modal: {
      description: 'Detailed cleaning of the interior of the refrigerator.',
      includes: [
        'Cleaning of accessible interior surfaces.',
        'Cleaning of shelves and drawers.',
        'Removal of normal food residue.',
        'Wiping of refrigerator doors and interior surfaces.',
      ],
      doesNotInclude: [
        'Disposal of spoiled food unless specifically requested and safely accessible.',
        'Appliance repair.',
        'Moving or disconnecting the refrigerator.',
        'Removal of extreme buildup requiring specialized treatment.',
      ],
      priceLabel: '$25',
      termsAndConditions:
        'The refrigerator should be emptied or reasonably cleared before cleaning. ZCLEANUP does not disconnect, repair, or move appliances as part of this Extra.',
    },
  },
  laundry: {
    id: 'laundry',
    label: 'Laundry',
    unitPrice: 15,
    kind: 'qty',
    minQuantity: 1,
    maxQuantity: 2,
    unitLabel: 'loads',
    shortDescription: 'Wash, dry, and fold up to 2 standard loads.',
    modal: {
      description: 'Laundry service for household clothing and linens.',
      includes: [
        'Washing one standard load.',
        'Drying one standard load when appropriate.',
        'Basic handling and folding of clean laundry.',
      ],
      doesNotInclude: [
        'Dry cleaning.',
        'Hand washing of delicate garments.',
        'Stain removal guarantees.',
        'Ironing unless separately offered.',
        'Loads exceeding normal household machine capacity.',
      ],
      priceLabel: '$15 per load',
      termsAndConditions:
        'Maximum 2 loads. The customer is responsible for identifying garments requiring special care. ZCLEANUP is not responsible for damage resulting from incorrect care labels or pre-existing garment damage.',
    },
  },
  garage: {
    id: 'garage',
    label: 'Garage',
    unitPrice: 30,
    kind: 'bool',
    shortDescription: 'Cleaning of a standard garage area.',
    modal: {
      description: 'Cleaning of a standard garage area as an additional service.',
      includes: [
        'Sweeping accessible garage floors.',
        'Light dusting of accessible surfaces.',
        'Removal of normal dirt and dust.',
        'Basic floor cleaning where reasonably accessible.',
      ],
      doesNotInclude: [
        'Heavy debris removal.',
        'Construction debris removal.',
        'Hazardous materials.',
        'Oil spill remediation.',
        'Pest control.',
        'Heavy lifting or moving.',
        'Specialized equipment or pressure washing unless separately quoted.',
      ],
      priceLabel: '$30',
      termsAndConditions:
        'The garage must be reasonably accessible and safe to clean. Large amounts of debris, hazardous materials, or specialized cleaning requirements may require an additional quote.',
    },
  },
  full_garage: {
    id: 'full_garage',
    label: 'Full Garage',
    unitPrice: 70,
    kind: 'bool',
    shortDescription: 'A more extensive garage cleaning service.',
    modal: {
      description:
        'A more extensive garage cleaning service for garages requiring significantly more attention than the standard Garage Extra.',
      includes: [
        'Detailed sweeping.',
        'More thorough floor cleaning.',
        'Dusting of accessible surfaces.',
        'Cleaning of accessible walls and doors.',
        'Removal of normal dust and dirt buildup.',
        'Additional attention to corners and difficult-to-reach accessible areas.',
      ],
      doesNotInclude: [
        'Heavy debris removal.',
        'Construction debris.',
        'Hazardous materials.',
        'Biohazards.',
        'Pest control.',
        'Heavy furniture or equipment moving.',
        'Oil spill remediation.',
        'Specialized pressure washing.',
      ],
      priceLabel: '$70',
      termsAndConditions:
        'The garage must be safe and reasonably accessible. Large quantities of debris, hazardous materials, severe contamination, or specialized cleaning may require an additional assessment and quote.',
    },
  },
  heavy_furniture_moving: {
    id: 'heavy_furniture_moving',
    label: 'Heavy Furniture Moving / Cleaning',
    unitPrice: 25,
    kind: 'qty',
    minQuantity: 1,
    maxQuantity: 2,
    unitLabel: 'items',
    shortDescription: 'Move up to 2 heavy items and clean behind/underneath.',
    modal: {
      description:
        'Additional assistance with moving and cleaning around heavy household furniture or objects that are not included in the standard cleaning service.',
      includes: [
        'Moving up to two heavy household items when reasonably safe.',
        'Cleaning accessible areas around and underneath moved items.',
        'Returning items to their original position when safely possible.',
      ],
      doesNotInclude: [
        'Moving more than two heavy items.',
        'Moving extremely heavy or oversized objects.',
        'Moving pianos, safes, appliances, or hazardous objects unless specifically approved.',
        'Disassembly or reassembly of furniture.',
        'Moving items that require specialized equipment.',
        'Moving items that cannot be safely handled by the cleaning team.',
      ],
      priceLabel: '$25 per item',
      termsAndConditions:
        'Maximum 2 items. Items must be reasonably safe for the cleaning team to move. ZCLEANUP may refuse to move an item if doing so presents a safety risk or requires specialized equipment.',
    },
  },
  same_day: {
    id: 'same_day',
    label: 'Same-Day / Urgent',
    helperLabel: 'Subject to availability',
    unitPrice: 20,
    kind: 'bool',
    shortDescription: 'Priority same-day scheduling (subject to availability).',
    modal: {
      description: 'Priority scheduling for cleaning requests needed on the same day, subject to team availability.',
      includes: [
        'Priority consideration for same-day scheduling.',
        'Coordination with the available cleaning team.',
        'The selected cleaning service and Extras.',
      ],
      doesNotInclude: [
        'Guaranteed availability.',
        'Guaranteed completion time.',
        'After-hours service unless specifically confirmed.',
        'Additional services not selected in the booking.',
      ],
      priceLabel: '$20 (subject to availability)',
      termsAndConditions:
        'Same-Day / Urgent service is not guaranteed until ZCLEANUP confirms availability. The $20 fee applies to priority scheduling and does not guarantee a specific arrival time.',
    },
  },
  outside_window: {
    id: 'outside_window',
    label: 'Outside Window',
    unitPrice: 7,
    kind: 'qty',
    minQuantity: 1,
    unitLabel: 'windows',
    shortDescription: 'Exterior window cleaning for accessible windows.',
    modal: {
      description: 'Exterior window cleaning for accessible windows.',
      includes: [
        'Cleaning of accessible exterior glass surfaces.',
        'Removal of normal dirt and dust.',
        'Basic cleaning of accessible exterior window areas.',
      ],
      doesNotInclude: [
        'Interior window cleaning unless separately selected.',
        'High-rise windows.',
        'Work requiring ladders or specialized height equipment unless specifically approved.',
        'Removal of permanent stains or damaged glass.',
        'Window repair.',
      ],
      priceLabel: '$7 per window',
      termsAndConditions:
        'Maximum accessibility and safety requirements apply. Windows that cannot be safely reached by the cleaning team may not be serviced. High-risk or elevated work may require a separate quote.',
    },
  },
};

export const OPTIONAL_EXTRAS_ARRAY_V2: OptionalExtraV2[] =
  Object.values(OPTIONAL_EXTRAS_V2);

// ======================================================================
// 4. CONSTRAINTS ENTRE EXTRAS
// ======================================================================
export const MUTUALLY_EXCLUSIVE_EXTRA_GROUPS_V2: OptionalExtraIdV2[][] = [
  ['garage', 'full_garage'],
];

export const EXTRA_MAX_QUANTITY_V2: Partial<Record<OptionalExtraIdV2, number>> = {
  laundry: 2,
  heavy_furniture_moving: 2,
};

// ======================================================================
// 5. COMPATIBILITY MATRIX V2
// ======================================================================
export type CompatibilityContextV2 =
  | 'regular_only'
  | SpecialServiceIdV2;

export const COMPATIBILITY_MATRIX_V2: Record<
  OptionalExtraIdV2,
  Record<CompatibilityContextV2, boolean>
> = {
  closet_organization: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: false,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  oven: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: false,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  refrigerator: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: false,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  laundry: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  garage: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  full_garage: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  heavy_furniture_moving: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  same_day: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
  outside_window: {
    regular_only: true,
    deep_home_cleaning: true,
    move_in_out: true,
    post_construction: true,
    extreme_home_cleaning: true,
  },
};

export function isExtraCompatibleV2(
  extraId: OptionalExtraIdV2,
  specialServiceId: SpecialServiceIdV2 | null,
): boolean {
  const context: CompatibilityContextV2 = specialServiceId ?? 'regular_only';
  const matrix = COMPATIBILITY_MATRIX_V2[extraId];
  const matrixValue = matrix ? matrix[context] === true : false;
  if (!matrixValue) return false;
  if (specialServiceId) {
    const ss = SPECIAL_SERVICES_V2[specialServiceId];
    if (ss?.incompatibleExtraIds?.includes(extraId)) return false;
  }
  return true;
}

/**
 * Devuelve el motivo por el que un extra está disabled UI, o {disabled:false} si OK.
 * ORDEN de razones (determinista):
 *  1) "Already included..." (Special Service incluye equivalent)
 *  2) "Not compatible..." (matriz falsa)
 *  3) "Cannot be combined with X..." (mutuamente excluyente seleccionado)
 */
export function isExtraDisabledV2(
  extraId: OptionalExtraIdV2,
  specialServiceId: SpecialServiceIdV2 | null,
  selectedExtras: Set<OptionalExtraIdV2>,
): { disabled: boolean; reason?: string } {
  // 1) Already included by Special Service (custom reason si existe)
  if (specialServiceId) {
    const ss = SPECIAL_SERVICES_V2[specialServiceId];
    if (ss?.incompatibleExtraIds?.includes(extraId)) {
      const custom = ss.includedExtraReasons?.[extraId];
      return {
        disabled: true,
        reason: custom ?? 'Already included with this service.',
      };
    }
  }
  // 2) Matriz incompatibilidad
  if (!isExtraCompatibleV2(extraId, specialServiceId)) {
    return {
      disabled: true,
      reason: 'Not compatible with the selected service.',
    };
  }
  // 3) Mutual Exclusive (Garage↔Full Garage)
  for (const group of MUTUALLY_EXCLUSIVE_EXTRA_GROUPS_V2) {
    const idx = group.indexOf(extraId);
    if (idx >= 0) {
      for (let i = 0; i < group.length; i++) {
        if (i !== idx && selectedExtras.has(group[i])) {
          return {
            disabled: true,
            reason: `Not compatible with ${OPTIONAL_EXTRAS_V2[group[i]].label} (only one can be selected).`,
          };
        }
      }
    }
  }
  return { disabled: false };
}

// ======================================================================
// 6. SERVICE NOTES ($0)
// ======================================================================
export interface ServiceNotesV2 {
  petsAtHome?: boolean;
  petSafetyNotes?: string;
  usesOwnCleaningProducts?: boolean;
  useOwnProducts?: boolean;
  cleaningProductNotes?: string;
  applyFirstDiscount?: boolean;
  firstServiceDiscountRequested?: boolean;
}

export const SERVICE_NOTES_LABELS_V2 = {
  petsAtHome: 'Pets at home',
  petsAtHomeHelper: 'Let us know about any special precautions.',
  petsQuestion: 'Are there any special precautions we should take with your pets?',
  petsQuestionHelper:
    'Please let us know if your pet requires special handling, may be aggressive, or needs extra precautions to prevent them from escaping during the service.',
  petsPlaceholder:
    'Example: Our dog can be nervous around strangers. Please keep the front door closed at all times.',
  petsSafetyTitle: 'Pet Safety Notice',
  petsSafetyText:
    'Please make the necessary arrangements to keep your pets safe and secure during the service. If there is a risk that a pet may escape, become aggressive, or interfere with the cleaning team, the customer is responsible for taking appropriate precautions before and during the service.',

  useOwnProducts: 'Customer uses own cleaning products',
  useOwnProductsHelper: 'Customer prefers the team to use their own cleaning products.',
  productsQuestion: 'Which cleaning products should we use, and where should each product be used?',
  productsQuestionHelper:
    'Please list the products you normally use and specify the area or surface each product is intended for.',
  productsPlaceholder:
    'Example: Product A — kitchen countertops; Product B — bathroom surfaces; Product C — hardwood floors.',

  firstTimeDiscountLabel: 'Is this your first time with us?',
  firstTimeDiscountHelper:
    'If this is your first service with ZCLEANUP, check this box to ask about your 15% first-service discount.',
  firstTimeDiscountInfoText:
    'Note: Checking this box does not automatically apply the discount. The team will review your booking and confirm eligibility before the service.',
  firstTimeDiscountRequestLabel: 'First-Service Discount Requested',
  discountAppliedByAdminLabel: 'Admin Applied Discount',

  petSafetyNotesLabel: 'Pet Safety Notes',
  ownProductsLabel: "Customer's Own Cleaning Products",
  productInstructionsLabel: 'Product Instructions',
} as const;

export const SERVICE_NOTES_FEE_V2 = 0;

// ======================================================================
// 7. BORDERLINE / COVERAGE V2 (UI labels)
// ======================================================================
export type CoverageClassificationV2 = 'INSIDE' | 'BORDERLINE' | 'OUTSIDE';

export const BORDERLINE_MAX_OUTSIDE_KM_V2 = 1;
export const BORDERLINE_FEE_AMOUNT_V2 = 25;
export const INSIDE_COVERAGE_FEE_V2 = 0;

// ======================================================================
// 8. CUSTOM QUOTE / SOLICITUD ESPECIAL – RUTA INDEPENDIENTE
// ======================================================================
export const CUSTOM_QUOTE_ROUTE_PATH = '/custom-quote';
export const CUSTOM_QUOTE_MENU_LABEL = 'Custom Quote / Special Request';
export const CUSTOM_QUOTE_DESCRIPTIONS = [
  'Partial cleaning',
  'Unusual requests',
  'Requests outside the standard service catalog',
  'Partial post-construction work',
  'One-room cleaning',
  'One-bathroom cleaning',
  'Partial kitchen remodeling cleanup',
  'Other requests requiring evaluation',
] as const;

// ======================================================================
// 9. DISPLAY HELPERS
// ======================================================================
export function getDisplaySpecialServiceLabelV2(
  id: SpecialServiceIdV2 | string | null | undefined,
): string {
  if (!id) return '';
  const ss = SPECIAL_SERVICES_V2[id as SpecialServiceIdV2];
  if (ss) return ss.label;
  return id;
}

export function getDisplayExtraLabelV2(
  id: OptionalExtraIdV2 | string | null | undefined,
): string {
  if (!id) return '';
  const ex = OPTIONAL_EXTRAS_V2[id as OptionalExtraIdV2];
  if (ex) return ex.label;
  return id;
}

export function getDisplayRegularPackageLabelV2(bedrooms: number, bathrooms: number): string {
  return `${bedrooms} bed / ${bathrooms} bath`;
}
