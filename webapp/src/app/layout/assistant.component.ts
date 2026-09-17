import { AfterViewChecked, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { AssistantService } from '../core/assistant.service';
import { assistantTopic } from '../core/assistant-kb';

/** The guide widget (§2.100): the round button bottom-right and the panel
 * it opens. Everything it knows lives in AssistantService — this file is
 * the surface, and deliberately holds no platform facts of its own. */
@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [TranslatePipe, IconComponent, RouterLink],
  templateUrl: './assistant.component.html'
})
export class AssistantComponent implements AfterViewChecked {
  draft = signal('');
  @ViewChild('log') private log?: ElementRef<HTMLDivElement>;
  @ViewChild('field') private field?: ElementRef<HTMLInputElement>;
  private lastCount = 0;

  constructor(public assistant: AssistantService) {}

  /** Keeps the newest message in view, and only scrolls when one arrives —
   * scrolling on every change detection would fight the visitor scrolling up
   * to re-read an answer. */
  ngAfterViewChecked(): void {
    // The typing indicator counts too, so the wait is visible and the answer
    // that replaces it doesn't land below the fold.
    const count = this.assistant.messages().length + (this.assistant.busy() ? 1 : 0);
    if (count === this.lastCount) return;
    this.lastCount = count;
    const el = this.log?.nativeElement;
    // A frame later: the bubble's own height isn't settled at this point, and
    // scrolling to a stale scrollHeight leaves the last answer half hidden
    // behind the input.
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }

  topicIcon(id: string): string {
    return assistantTopic(id)?.icon ?? 'info';
  }

  toggle(): void {
    this.assistant.toggle();
    if (this.assistant.open()) setTimeout(() => this.field?.nativeElement?.focus(), 120);
  }

  submit(): void {
    const text = this.draft();
    if (!text.trim() || this.assistant.busy()) return;
    this.draft.set('');
    void this.assistant.send(text);
  }

  chip(id: string): void {
    this.assistant.askTopic(id);
  }
}
