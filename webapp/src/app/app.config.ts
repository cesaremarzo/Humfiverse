import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { RevalidatingTranslationLoader } from './core/translation-loader';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    provideTranslateService({
      lang: 'en',
      fallbackLang: 'en',
      // A factory, not the class: this overload is resolved at runtime and a
      // class passed bare is called without `new`, which blanks the app.
      loader: provideTranslateLoader(() => new RevalidatingTranslationLoader())
    })
  ]
};
