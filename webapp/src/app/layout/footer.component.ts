import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <footer class="footer">
      <span>{{ 'footer.tagline' | translate: { year } }}</span>
      <span>{{ 'footer.disclaimer' | translate }}</span>
    </footer>
  `
})
export class FooterComponent {
  year = new Date().getFullYear();
}
