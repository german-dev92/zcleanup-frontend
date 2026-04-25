import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if ((window as any)?.google?.maps) return Promise.resolve();
  if (!apiKey) return Promise.resolve();

  const existing = document.getElementById('google-maps-js');
  if (existing) {
    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        if ((window as any)?.google?.maps) {
          window.clearInterval(timer);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(timer);
        resolve();
      }, 5000);
    });
  }

  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.id = 'google-maps-js';
    s.src =
      'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(String(apiKey)) +
      '&loading=async';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

const apiKey =
  (window as any).__ZC_GOOGLE_MAPS_API_KEY__ || environment.googleMapsApiKey;

loadGoogleMapsApi(String(apiKey ?? ''))
  .finally(() => platformBrowserDynamic().bootstrapModule(AppModule))
  .catch(err => console.error(err));
