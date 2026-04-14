import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceDataService } from '../../core/services/service-data.service';
import { CleaningService } from '../../core/models/service.model';
import { Promotion, PromotionsService } from '../../core/services/promotions.service';
import { HeroSlide } from './hero-slider/hero-slider.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  heroSlides: HeroSlide[] = [
    { 
      src: 'assets/images/underground/Home_Cleaning_port.png',
      alt: 'Professional Home Cleaning Services'
    },
    { 
      src: 'assets/images/underground/Apartment_Cleaning_port.jpg',
      alt: 'Expert Apartment and Condo Cleaning'
    },
    { 
      src: 'assets/images/underground/Post-Construction_Cleaning_port.jpg',
      alt: 'Post-Construction Cleanup Experts'
    },
    { 
      src: 'assets/images/underground/Deep_Cleaning_port.jpg',
      alt: 'Thorough Deep Cleaning for your Space'
    },
    { 
      src: 'assets/images/underground/Window_Cleaning_port.jpg',
      alt: 'Streak-Free Window Cleaning Services'
    }
  ];

  services: CleaningService[] = [];
  promotions: Promotion[] = [];

  constructor(
    private serviceData: ServiceDataService,
    private promotionsService: PromotionsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Show Standard, Deep, Move-In/Out on home page
    const featuredSlugs = ['standard-cleaning', 'deep-cleaning', 'move-in-move-out'];
    this.services = this.serviceData.getEnabledServices()
      .filter(s => featuredSlugs.includes(s.slug))
      .sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug));

    this.promotions = this.promotionsService.getPromotions();
  }

  goToService(service: CleaningService) {
    this.router.navigate(['/services', service.slug]);
  }

  // Placeholder link: replace later with the real Google Business Profile reviews URL.
  googleReviewsUrl = 'https://www.google.com/search?q=ZCleanUp+Tampa';

  openGoogleReviews(): void {
    window.open(this.googleReviewsUrl, '_blank', 'noopener,noreferrer');
  }

  testimonials = [
    {
      name: 'Sarah M.',
      initials: 'SM',
      text: 'Booked a first-time deep clean and the team was on time, respectful, and detailed—especially in the kitchen and bathrooms.',
      rating: 5
    },
    {
      name: 'John D.',
      initials: 'JD',
      text: 'Great communication and the place looked consistently clean after the visit. Easy booking process and fair pricing.',
      rating: 5
    },
    {
      name: 'Emily R.',
      initials: 'ER',
      text: 'We scheduled a move-out clean and they handled the tough spots without drama. Super professional and efficient.',
      rating: 5
    }
  ];
}
