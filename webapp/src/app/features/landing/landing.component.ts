import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './landing.component.html'
})
export class LandingComponent {
  constructor(
    public store: StoreService,
    private router: Router
  ) {}

  choose(role: 'investor' | 'artist'): void {
    this.store.perspective.set(role);
    this.router.navigateByUrl(role === 'artist' ? '/for-artists' : '/marketplace');
  }
}
