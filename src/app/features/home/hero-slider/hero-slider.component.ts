import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';

export type HeroSlide = {
  src: string;
  alt: string;
};

@Component({
  selector: 'app-hero-slider',
  templateUrl: './hero-slider.component.html',
  styleUrls: ['./hero-slider.component.scss']
})
export class HeroSliderComponent implements OnInit, OnDestroy {
  @Input() slides: HeroSlide[] = [];
  @Input() autoCycle = true;
  @Input() intervalMs = 6000;

  currentIndex = 0;
  private intervalId: any;

  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    if (this.autoCycle) {
      this.startAuto();
    }
  }

  ngOnDestroy(): void {
    this.stopAuto();
  }

  startAuto(): void {
    this.stopAuto();
    this.intervalId = setInterval(() => this.next(), this.intervalMs);
  }

  stopAuto(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  next(): void {
    if (!this.slides.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }

  prev(): void {
    if (!this.slides.length) return;
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
  }

  goTo(index: number): void {
    if (!this.slides.length) return;
    this.currentIndex = Math.max(0, Math.min(index, this.slides.length - 1));
    if (this.autoCycle) {
      this.startAuto();
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const threshold = 50;
    const delta = this.touchStartX - this.touchEndX;
    if (Math.abs(delta) < threshold) return;
    if (delta > 0) {
      this.next();
    } else {
      this.prev();
    }
  }
}
