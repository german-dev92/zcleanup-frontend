import { Injectable } from '@angular/core';

export type Promotion = {
  id: string;
  title: string;
  description: string;
  label?: string;
  discountText: string;
};

@Injectable({
  providedIn: 'root'
})
export class PromotionsService {
  private readonly promotions: Promotion[] = [
    {
      id: 'first-cleaning-15',
      title: '15% Off Your First Cleaning',
      description: 'Enjoy a 15% discount on your first cleaning service with ZCleanUp. Perfect way to experience our quality service.',
      label: 'Limited Time Offer',
      discountText: '15% OFF'
    }
  ];

  getPromotions(): Promotion[] {
    return [...this.promotions];
  }
}
