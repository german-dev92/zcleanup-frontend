import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ServiceDataService } from '../../core/services/service-data.service';
import { CleaningService } from '../../core/models/service.model';

@Component({
  selector: 'app-service-detail',
  templateUrl: './service-detail.component.html',
  styleUrls: ['./service-detail.component.scss']
})
export class ServiceDetailComponent implements OnInit {
  service?: CleaningService;
  globalNotIncluded: string[] = [];
  landingAddOns: string[] = [];
  commonAddOns: string[] = [];
  commonStandardExclusions: string[] = [];
  commonImportantNote = '';
  isExclusionsModalOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private serviceData: ServiceDataService,
    private titleService: Title,
    private metaService: Meta
  ) {
    this.globalNotIncluded = this.serviceData.getGlobalNotIncluded();
    const common = this.serviceData.getCommonAddOnsAndStandardExclusions();
    this.commonAddOns = common.availableAddOns;
    this.commonStandardExclusions = common.standardExclusions;
    this.commonImportantNote = common.importantNote;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.service = this.serviceData.getServiceBySlug(slug);
        if (this.service) {
          this.landingAddOns = this.serviceData.getLandingChecklistAddOns(this.service.slug);
          this.updateSEO(this.service);
          this.setStructuredData(this.service);
        } else {
          this.router.navigate(['/services']);
        }
      }
    });
  }

  updateSEO(service: CleaningService): void {
    this.titleService.setTitle(service.metaTitle || `${service.title} | ZCleanUp`);
    this.metaService.updateTag({ name: 'description', content: service.metaDescription || service.description });
  }

  setStructuredData(service: CleaningService): void {
    // Remove existing scripts to prevent duplicates
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => {
      if (script.textContent?.includes(service.title)) {
        script.remove();
      }
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": service.title,
      "description": service.description,
      "provider": {
        "@type": "LocalBusiness",
        "name": "ZCleanUp",
        "image": "assets/images/logos/ZcleanUP.png",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "123 Shine St",
          "addressLocality": "Clean City",
          "addressRegion": "NY",
          "postalCode": "12345",
          "addressCountry": "US"
        }
      },
      "areaServed": "Clean City Area"
    };
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  openExclusionsModal(): void {
    this.isExclusionsModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeExclusionsModal(): void {
    this.isExclusionsModalOpen = false;
    document.body.style.overflow = 'auto';
  }

  bookNow(): void {
    if (this.service) {
      this.router.navigate(['/book-service'], { queryParams: { service: this.service.slug, serviceName: this.service.title }, fragment: 'booking-form' });
    }
  }
}
