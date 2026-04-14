import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CleaningService } from '../../core/models/service.model';
import { ServiceDataService } from '../../core/services/service-data.service';

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit {
  selectedService: CleaningService | null = null;
  services: CleaningService[] = [];

  constructor(
    private router: Router,
    private serviceData: ServiceDataService
  ) {}

  ngOnInit(): void {
    this.services = this.serviceData.getServices();
  }

  openServiceModal(service: CleaningService) {
    this.selectedService = service;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.selectedService = null;
    document.body.style.overflow = 'auto';
  }

  goToDetail(service: CleaningService) {
    this.closeModal();
    this.router.navigate(['/services', service.slug]);
  }

  bookService(service: CleaningService) {
    this.closeModal();
    this.router.navigate(['/book-service'], { queryParams: { service: service.slug, serviceName: service.title }, fragment: 'booking-form' });
  }
}
