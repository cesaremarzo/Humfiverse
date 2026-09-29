import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { StoreService } from '../../core/store.service';
import { SignedActionService, isSignatureRejection } from '../../core/signed-action.service';
import { TakedownCase, TakedownGround, TakedownSafeTransaction } from '../../core/models';

type Evidence = 'notice' | 'authority_order' | 'court_decision';

/** SHA-256 of a payload as JSON with sorted keys — the same digest the
 * backend recomputes (canonicalDigest in server/lib/signed-action.js). */
async function canonicalDigest(value: unknown): Promise<string> {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  const bytes = new TextEncoder().encode(JSON.stringify(sort(value ?? null)));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return '0x' + Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The takedown procedure (§2.105; legal/08 A-1, A-1-bis), run by a signer
 * of the owner Safe. Every step is signed; the server records it with its
 * outcome. The one thing this page cannot do is cancel on chain — that is
 * the Safe's transaction, which the page prepares and then has the server
 * verify. Internal and English-only, like /admin/escrow. */
@Component({
  selector: 'app-admin-takedown',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-takedown.component.html'
})
export class AdminTakedownComponent {
  readonly grounds: { value: TakedownGround; label: string }[] = [
    { value: 'unlawful_content', label: '(a) Unlawful content' },
    { value: 'third_party_rights', label: '(b) Infringement of third-party rights' },
    { value: 'false_warranties', label: '(c) False or inaccurate artist warranties' }
  ];
  readonly evidenceTypes: { value: Evidence; label: string }[] = [
    { value: 'notice', label: 'Notice from the rights holder' },
    { value: 'authority_order', label: 'Order of an authority' },
    { value: 'court_decision', label: 'Court decision' }
  ];

  cases = signal<TakedownCase[] | null>(null);
  noticeDays = signal<number | null>(null);
  loading = signal(false);
  busy = signal<string | null>(null);
  error = signal<string | null>(null);
  selectedId = signal<string>('');
  safeTx = signal<TakedownSafeTransaction | null>(null);

  // Forms.
  ground: TakedownGround = 'unlawful_content';
  evidenceType: Evidence = 'notice';
  evidenceRef = '';
  reasons = '';
  urgent = false;
  urgentBasis = '';
  replyText = '';
  dismissReason = '';
  decisionText = '';
  txHash = '';

  assets = computed(() => this.store.assets().map((a) => ({ id: a.id, label: a.title ? `${a.title} — ${a.artistName} (${a.id})` : a.id })));
  selectedCase = computed<TakedownCase | null>(() => {
    const id = this.selectedId();
    if (!id || !this.cases()) return null;
    return this.cases()!.find((c) => c.assetId === id) ?? { assetId: id, stage: 'none', events: [] };
  });
  deadlinePassed = computed(() => {
    const c = this.selectedCase();
    return !!c && (c.urgent || (!!c.replyDeadline && Date.now() >= Date.parse(c.replyDeadline)));
  });

  constructor(
    public wallet: WalletService,
    private api: ApiService,
    private store: StoreService,
    private signer: SignedActionService
  ) {}

  async connect(): Promise<void> {
    await this.wallet.connect();
  }

  private async signStep(assetId: string, step: string, body: Record<string, unknown>) {
    return this.signer.sign('takedown', { assetId, step, digest: await canonicalDigest(body) });
  }

  private report(err: unknown): void {
    if (isSignatureRejection(err)) { this.error.set('Signature declined.'); return; }
    const e = err as { error?: { error?: string; detail?: string }; message?: string };
    this.error.set(e?.error?.error ? `${e.error.error}${e.error.detail ? ` — ${e.error.detail}` : ''}` : String(e?.message || err));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const auth = await this.signStep('*', 'view', {});
      const res = await this.api.listTakedownCases(auth);
      this.cases.set(res.cases);
      this.noticeDays.set(res.noticeDays);
      await this.refreshSafeTx();
    } catch (err) {
      this.report(err);
    } finally {
      this.loading.set(false);
    }
  }

  async select(id: string): Promise<void> {
    this.selectedId.set(id);
    this.safeTx.set(null);
    this.error.set(null);
    await this.refreshSafeTx();
  }

  private async refreshSafeTx(): Promise<void> {
    const c = this.selectedCase();
    if (!c?.decision) { this.safeTx.set(null); return; }
    this.safeTx.set((await this.api.getTakedownSafeTransaction(c.assetId!)).safeTransaction);
  }

  /** Runs one signed step and folds its answer into the list. */
  private async run(step: string, body: Record<string, unknown>): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    this.busy.set(step);
    this.error.set(null);
    try {
      const auth = await this.signStep(id, step, body);
      const res = await this.api.takedownStep<TakedownCase | { case: TakedownCase; safeTransaction: TakedownSafeTransaction | null }>(id, step, body, auth);
      const next = 'case' in res ? res.case : res;
      if ('case' in res) this.safeTx.set(res.safeTransaction);
      this.cases.update((list) => [...(list ?? []).filter((c) => c.assetId !== id), { ...next, assetId: id }]);
      await this.store.hydrateFromBackend();
    } catch (err) {
      this.report(err);
    } finally {
      this.busy.set(null);
    }
  }

  sendNotice(): Promise<void> {
    const body: Record<string, unknown> = { ground: this.ground, reasons: this.reasons.trim() };
    if (this.ground === 'third_party_rights') body['evidenceType'] = this.evidenceType;
    if (this.evidenceRef.trim()) body['evidenceRef'] = this.evidenceRef.trim();
    if (this.urgent) { body['urgent'] = true; body['urgentBasis'] = this.urgentBasis.trim(); }
    return this.run('notice', body);
  }
  resendNotice(): Promise<void> { return this.run('notice-email', {}); }
  recordReply(): Promise<void> { return this.run('reply', { text: this.replyText.trim() }).then(() => { this.replyText = ''; }); }
  dismiss(): Promise<void> { return this.run('dismiss', { reason: this.dismissReason.trim() }); }
  decide(): Promise<void> { return this.run('decide', { text: this.decisionText.trim() }); }
  complete(): Promise<void> {
    const c = this.selectedCase();
    const needsTx = !!this.safeTx() || (c?.cancel?.outcome === 'failed');
    return this.run('complete', needsTx || this.txHash.trim() ? { txHash: this.txHash.trim() } : {});
  }

  downloadBatch(): void {
    const tx = this.safeTx();
    if (!tx) return;
    const blob = new Blob([JSON.stringify(tx.batch, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cancel-${this.selectedId()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadDecision(): void {
    const c = this.selectedCase();
    if (!c?.decision) return;
    const blob = new Blob([c.decision.document], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `decision-${this.selectedId()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text).catch(() => undefined);
  }

  groundLabel(g?: string | null): string {
    return this.grounds.find((x) => x.value === g)?.label ?? String(g ?? '');
  }

  json(v: unknown): string {
    return JSON.stringify(v);
  }
}
