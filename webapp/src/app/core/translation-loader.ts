import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, from } from 'rxjs';

/**
 * Loads `assets/i18n/<lang>.json`, always checking with the server first.
 *
 * GitHub Pages serves these files with `max-age=600` under a fixed name, so
 * the default loader let a browser keep strings for ten minutes after a
 * deploy. New code then met old translations and every new key rendered as
 * its raw name (§2.75). Tagging the URL with the bundle hash fixed that only
 * when code changed too; a deploy that edits nothing but copy keeps the same
 * hash, and was cached just the same.
 *
 * `cache: 'no-cache'` makes the browser revalidate on every load: an
 * unchanged file comes back as a bodiless 304 against its ETag, a changed one
 * is fetched in full. Correct after any deploy, and cheap when nothing moved.
 *
 * A failed load resolves to no strings rather than an error, matching the
 * default loader — the app falls back to the English file.
 */
export class RevalidatingTranslationLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return from(
      fetch(`./assets/i18n/${lang}.json`, { cache: 'no-cache' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .catch((err) => {
          console.warn(`Could not load translations for "${lang}".`, err);
          return {};
        })
    );
  }
}
