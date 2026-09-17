import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from './api.service';
import { StoreService } from './store.service';
import { ASSISTANT_STARTERS, ASSISTANT_TOPICS, assistantTopic } from './assistant-kb';

/** A run of an answer: plain text, or a link to one of the app's pages. */
export interface AssistantSegment {
  text: string;
  route?: string;
}

export interface AssistantMessage {
  id: number;
  from: 'guide' | 'visitor';
  segments: AssistantSegment[];
  /** Small line under the bubble — where this answer came from, or a warning. */
  note?: string;
  /** Page button under the answer. */
  route?: string;
  routeLabel?: string;
  /** Topic chips offered as the next question. */
  suggestions?: string[];
  tone?: 'normal' | 'warning';
}

/** How the widget can answer right now. `guided` means the written topics
 * only — which is the honest default, and what a deployment with no
 * ANTHROPIC_API_KEY stays on for good (§2.100). */
export type AssistantMode = 'guided' | 'ai';

/* Words too short or too common to tell two topics apart. Only the words a
   visitor would actually type are filtered; the topic keywords themselves
   live in the i18n files, one list per locale. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'how', 'what', 'can', 'does', 'with', 'you', 'are', 'that', 'this', 'from',
  'come', 'cosa', 'che', 'per', 'con', 'una', 'del', 'della', 'sono', 'posso', 'devo', 'quando',
  'los', 'las', 'para', 'como', 'que', 'les', 'des', 'pour', 'comment', 'wie', 'was', 'der', 'die', 'das'
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  readonly open = signal(false);
  readonly messages = signal<AssistantMessage[]>([]);
  readonly busy = signal(false);
  /** Starts guided and only becomes 'ai' once the backend says so: a
   * widget that cannot reach the server must never look like one that can. */
  readonly mode = signal<AssistantMode>('guided');
  readonly starters = ASSISTANT_STARTERS;
  readonly topics = ASSISTANT_TOPICS;

  private nextId = 1;
  private statusChecked = false;
  /** The exchange as the backend sees it: only real questions and answers. */
  private history: { role: 'user' | 'assistant'; content: string }[] = [];

  constructor(
    private api: ApiService,
    private store: StoreService,
    private translate: TranslateService
  ) {}

  toggle(): void {
    this.open() ? this.close() : this.openPanel();
  }

  close(): void {
    this.open.set(false);
  }

  openPanel(): void {
    this.open.set(true);
    if (!this.messages().length) this.greet();
    if (!this.statusChecked) {
      this.statusChecked = true;
      // Failure is not an error to report: guided mode is a full answer set,
      // not a degraded one, so the widget simply stays on it.
      void this.api.getAssistantStatus()
        .then((status) => this.mode.set(status?.available ? 'ai' : 'guided'))
        .catch(() => this.mode.set('guided'));
    }
  }

  /** Clears the conversation, back to the opening message. */
  reset(): void {
    this.history = [];
    this.messages.set([]);
    this.greet();
  }

  private greet(): void {
    this.push({
      from: 'guide',
      segments: [{ text: this.t('assistant.welcome') }],
      suggestions: [...ASSISTANT_STARTERS]
    });
  }

  /** The visitor tapped a topic chip. */
  askTopic(id: string): void {
    const topic = assistantTopic(id);
    if (!topic || this.busy()) return;
    const question = this.t(`assistant.kb.${id}.q`);
    const answer = this.t(`assistant.kb.${id}.a`);
    this.push({ from: 'visitor', segments: [{ text: question }] });
    this.push({
      from: 'guide',
      segments: this.linkify(answer),
      route: topic.route,
      routeLabel: topic.routeLabel,
      suggestions: topic.related
    });
    this.remember('user', question);
    this.remember('assistant', answer);
  }

  /** The visitor typed something. */
  async send(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text || this.busy()) return;
    this.push({ from: 'visitor', segments: [{ text }] });
    this.remember('user', text);

    if (this.mode() !== 'ai') {
      this.answerFromTopics(text);
      return;
    }

    this.busy.set(true);
    try {
      const answer = await this.api.askAssistant({ messages: this.history.slice(-12), locale: this.store.locale() });
      if (!answer?.reply) {
        // A refusal or an empty answer: say so, and fall back to the topics
        // rather than leaving the question hanging.
        this.answerFromTopics(text, this.t('assistant.errorRefused'));
        return;
      }
      this.push({
        from: 'guide',
        segments: this.linkify(answer.reply),
        note: this.t('assistant.aiNote')
      });
      this.remember('assistant', answer.reply);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      const noteKey = status === 429 ? 'assistant.errorRate'
        : status === 503 ? 'assistant.errorUnavailable'
        : status === 0 || status === undefined ? 'assistant.errorOffline'
        : 'assistant.errorUpstream';
      if (status === 503) this.mode.set('guided');
      this.answerFromTopics(text, this.t(noteKey));
    } finally {
      this.busy.set(false);
    }
  }

  /** Guided mode, and the fallback whenever the AI mode cannot answer: match
   * the words against the topic keywords, and say plainly when nothing
   * matches instead of producing something that reads like an answer. */
  private answerFromTopics(text: string, prefixNote?: string): void {
    const ranked = this.rank(text);
    if (!ranked.length) {
      this.push({
        from: 'guide',
        segments: [{ text: this.t('assistant.noMatch') }],
        note: prefixNote,
        suggestions: [...ASSISTANT_STARTERS],
        tone: prefixNote ? 'warning' : 'normal'
      });
      return;
    }
    const best = ranked[0];
    const topic = assistantTopic(best)!;
    this.push({
      from: 'guide',
      segments: this.linkify(this.t(`assistant.kb.${best}.a`)),
      note: prefixNote ?? this.t('assistant.writtenNote'),
      route: topic.route,
      routeLabel: topic.routeLabel,
      suggestions: ranked.slice(1, 4).length ? ranked.slice(1, 4) : topic.related,
      tone: prefixNote ? 'warning' : 'normal'
    });
    this.remember('assistant', this.t(`assistant.kb.${best}.a`));
  }

  /** Topic ids, best first. A topic scores for every keyword of its locale
   * that appears in the question, and once more for a word of its title. */
  private rank(text: string): string[] {
    const query = normalize(text);
    if (!query) return [];
    const words = query.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    const scored = ASSISTANT_TOPICS.map((topic) => {
      const keys = normalize(this.t(`assistant.kb.${topic.id}.keys`)).split(' ').filter(Boolean);
      const title = normalize(this.t(`assistant.kb.${topic.id}.q`)).split(' ').filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      let score = 0;
      for (const key of keys) if (words.includes(key) || (key.length > 4 && query.includes(key))) score += 2;
      for (const word of title) if (words.includes(word)) score += 1;
      return { id: topic.id, score };
    }).filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.id);
  }

  /** Turns the "#/marketplace" references the answers use into real links,
   * without ever putting model output through innerHTML. */
  private linkify(text: string): AssistantSegment[] {
    const segments: AssistantSegment[] = [];
    const pattern = /#\/[a-zA-Z0-9/_-]+/g;
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const at = match.index ?? 0;
      if (at > last) segments.push({ text: text.slice(last, at) });
      const route = match[0].slice(1);
      segments.push({ text: this.routeLabel(route), route });
      last = at + match[0].length;
    }
    if (last < text.length) segments.push({ text: text.slice(last) });
    return segments.length ? segments : [{ text }];
  }

  /** A readable name for a route, so a link reads "Marketplace", not "#/marketplace". */
  private routeLabel(route: string): string {
    const labels: Record<string, string> = {
      '/marketplace': 'nav.marketplace',
      '/portfolio': 'nav.portfolio',
      '/kyc': 'assistant.goVerification',
      '/for-artists': 'assistant.goArtists',
      '/studio': 'footer.studioLink',
      '/artist/onboarding': 'nav.newCampaign',
      '/artist/dashboard': 'nav.myCampaigns',
      '/artist/milestones': 'nav.milestones'
    };
    const key = labels[route];
    return key ? this.t(key) : route;
  }

  private remember(role: 'user' | 'assistant', content: string): void {
    this.history.push({ role, content });
    if (this.history.length > 12) this.history = this.history.slice(-12);
  }

  private push(message: Omit<AssistantMessage, 'id'>): void {
    this.messages.update((list) => [...list, { id: this.nextId++, ...message }]);
  }

  private t(key: string): string {
    const value = this.translate.instant(key);
    return typeof value === 'string' ? value : key;
  }
}
