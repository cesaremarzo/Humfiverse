import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { contactHref } from '../core/contact';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="footer">
      <span>{{ 'footer.tagline' | translate: { year } }}</span>
      <a routerLink="/studio">{{ 'footer.studioLink' | translate }}</a>
      <a [href]="contactHref()">{{ 'footer.contact' | translate }}</a>
      <span>{{ 'footer.disclaimer' | translate }}</span>
    </footer>
  `
})
export class FooterComponent {
  year = new Date().getFullYear();
  contactHref = contactHref;
}
