import { Component, OnInit } from '@angular/core';
import { Promotion, PromotionsService } from '../../core/services/promotions.service';

@Component({
  selector: 'app-promotions',
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.scss']
})
export class PromotionsComponent implements OnInit {
  promotions: Promotion[] = [];

  constructor(private promotionsService: PromotionsService) {}

  ngOnInit(): void {
    this.promotions = this.promotionsService.getPromotions();
  }
}
