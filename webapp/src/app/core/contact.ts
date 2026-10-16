/** The one public contact address (Cloudflare Email Routing → the founders'
 * inboxes). The site has no contact form on purpose: a mailto link stores
 * nothing on our backend. */
export const CONTACT_EMAIL = 'hello@humfiverse.com';

/** A mailto: link to CONTACT_EMAIL, with an optional (already translated) subject. */
export function contactHref(subject?: string): string {
  return `mailto:${CONTACT_EMAIL}` + (subject ? `?subject=${encodeURIComponent(subject)}` : '');
}
