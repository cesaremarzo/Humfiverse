import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Milestone } from '../core/models';
import { fmtUSD } from '../core/format.util';

@Component({
  selector: 'app-milestone-track',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="milestone-track">
      @for (m of milestones; track m.name) {
        <div class="milestone" [class]="m.status" [style.--p]="m.status === 'active' ? '55%' : null">
          <div class="bar"><span></span></div>
          <div class="milestone-label"><span class="name">{{ m.name }}</span>@if (m.kind === 'advance') {<span class="hint"> · {{ 'milestone.advance' | translate }}</span>}</div>
          <div class="milestone-label">
            <span class="amt">{{ fmt(m.trancheAmount) }} · {{ (m.status === 'done' ? 'milestone.released' : m.status === 'active' ? 'milestone.inProgress' : 'milestone.pending') | translate }}</span>
          </div>
          @if (m.link) {
            <div class="milestone-label"><a [href]="m.link" target="_blank" rel="noopener noreferrer">{{ 'milestone.publishedTrack' | translate }}</a></div>
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTrackComponent {
  @Input({ required: true }) milestones!: Milestone[];
  fmt(n: number): string {
    return fmtUSD(n);
  }
}
