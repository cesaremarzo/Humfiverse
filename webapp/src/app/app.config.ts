import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';

/**
 * A version tag for the translation files, so a deploy is never read with
 * the previous deploy's strings.
 *
 * GitHub Pages serves `assets/i18n/*.json` with `max-age=600` under a fixed
 * name, while the JavaScript bundle's name changes on every build. For up to
 * ten minutes after a deploy a visitor could therefore run new code against
 * cached old translations, and every new key rendered as its raw name —
 * reported as `wizMilestones.payeeStudio` on screen (§2.75). The bundle's own
 * hash changes exactly when the strings might have, so it is the tag. In the
 * dev server, and during prerendering where there is no document, a
 * timestamp stands in.
 */
function buildTag(): string {
  if (typeof document === 'undefined') return 'prerender';
  const main = Array.from(document.scripts).map((s) => s.src).find((src) => /\/main-[A-Za-z0-9]+\.js/.test(src));
  return main?.match(/\/main-([A-Za-z0-9]+)\.js/)?.[1] ?? String(Date.now());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    provideTranslateService({
      lang: 'en',
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: `.json?v=${buildTag()}` })
    })
  ]
};
