import { Component, Input, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { Asset } from '../core/models';
import { StoreService } from '../core/store.service';
import { remainingFor } from '../core/onchain-progress.util';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (isSoldOut) {
      <span class="chip chip-neutral"><app-icon name="checkCircle"></app-icon> {{ 'asset.soldOut' | translate }}</span>
    } @else if (asset.kind === 'preproduction') {
      <span class="chip chip-accent"><app-icon name="sparkles"></app-icon> {{ 'asset.preproduction' | translate }}</span>
    } @else {
      <span class="chip chip-good"><app-icon name="coins"></app-icon> {{ 'asset.funding' | translate }}</span>
    }
  `
})
export class StatusChipComponent {
  private store = inject(StoreService);

  @Input({ required: true }) asset!: Asset;

  /** Optional override for a page holding fresher on-chain state than the
   * store's boot-time maps — asset-detail re-fetches both contracts right
   * after a purchase, so its own reading is newer than the map's. */
  @Input() soldOut: boolean | null = null;

  /** Until this existed the chip only ever tested `asset.status`, and
   * nothing in the app assigns 'sold-out' to that field: every asset is
   * created as 'funding' by the onboarding wizard and stays that way
   * forever. The branch was unreachable, so a fully sold campaign still
   * advertised itself as open — Guns, with a pool balance of zero, showed
   * "Preproduction". The stored flag is kept as one way in, for data that
   * sets it, with the real pool balance as the other. */
  get isSoldOut(): boolean {
    if (this.soldOut !== null) return this.soldOut;
    if (this.asset.status === 'sold-out') return true;
    const onchain = this.store.onchainFor(this.asset.id);
    // Only claim sold out on real chain data. Falling back to the mock
    // counter here would call a brand-new campaign sold out the moment
    // its token total is zero, which the wizard can still produce.
    if (!onchain?.onchain) return false;
    return remainingFor(this.asset, onchain, this.store.escrowFor(this.asset.id)) <= 0;
  }
}
