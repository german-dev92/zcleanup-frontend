import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  values = [
    { title: 'Reliability', description: 'We show up on time and deliver consistent results every time.' },
    { title: 'Quality', description: 'We use the best products and techniques to ensure a deep clean.' },
    { title: 'Trust', description: 'Your home is in safe hands with our background-checked professionals.' }
  ];

  whyChooseUs = [
    { title: 'Fully Insured', description: 'Your home is protected with a fully insured cleaning service.' },
    { title: 'Trusted & Reliable', description: 'We show up on time and deliver consistent, high-quality results.' },
    { title: 'Attention to Detail', description: 'We focus on the small details that make a big difference.' },
    { title: 'Flexible Scheduling', description: 'Book at your convenience with flexible time slots.' },
    { title: 'Satisfaction Guaranteed', description: 'We’re not happy until you are.' }
  ];

  cleaningProcess = [
    { step: 1, title: 'Book Your Service', description: 'Choose your cleaning service and schedule online.' },
    { step: 2, title: 'We Assess Your Needs', description: 'We review your home details and any special requests.' },
    { step: 3, title: 'Professional Cleaning', description: 'Our trained team delivers high-quality cleaning.' },
    { step: 4, title: 'Final Quality Check', description: 'We ensure everything meets our standards before finishing.' }
  ];
}
