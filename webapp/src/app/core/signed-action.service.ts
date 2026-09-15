import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { WalletService } from './wallet.service';
import { SignedAction, SignedActionKind } from './models';

/** Signs one write with the connected wallet (§2.89): the server builds the
 * text, the wallet signs it, and the write carries the result back. Throws
 * `no-wallet`, or the wallet's own rejection (code 4001 / ACTION_REJECTED). */
@Injectable({ providedIn: 'root' })
export class SignedActionService {
  constructor(
    private api: ApiService,
    private wallet: WalletService
  ) {}

  async sign(kind: SignedActionKind, fields: Record<string, unknown>): Promise<SignedAction> {
    const address = this.wallet.state().address;
    if (!address) throw new Error('no-wallet');
    const { action, message } = await this.api.prepareSignedAction({ kind, wallet: address, fields });
    return { ...action, signature: await this.wallet.signMessage(message) };
  }
}

/** A declined signature, as opposed to a failure worth reporting as one. */
export function isSignatureRejection(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 4001 || code === 'ACTION_REJECTED';
}
