import { Extra } from './extra.model';

export interface Testimonial {
  name: string;
  text: string;
  rating: number;
  photo?: string;
}

export type ServiceType = 'property' | 'unit' | 'custom';

export interface ServiceSection {
  title: string;
  items: string[];
}

export interface CleaningService {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  type: ServiceType;
  basePrice?: number;
  priceNote?: string;
  pricePerBedroom?: number;
  pricePerBathroom?: number;
  pricePerUnit?: number;
  enabled?: boolean;
  details?: string;
  sections?: ServiceSection[];
  included?: string[];
  notIncluded?: string[];
  duration?: string;
  frequency?: string;
  metaTitle?: string;
  metaDescription?: string;
  testimonials?: Testimonial[];
  extras?: Extra[];
  isRecurring?: boolean;
  businessRule?: string;
}
