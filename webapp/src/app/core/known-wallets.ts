/** The platform's own wallets, by the names the team uses for them — see
 * the "Wallet names" table in CLAUDE.md, which this must match. Display
 * only: permissions always come from the contracts themselves (owner(),
 * feeRecipient()), never from this list. */
const KNOWN_WALLETS: Record<string, string> = {
  '0x142f945e13f59fde3583bea8f78528a44317bfc6': 'Founder',
  '0xd156bdd971c9034a2c78496889e258c4601b7524': 'Fees'
};

export function knownWalletName(address: string | null | undefined): string | null {
  return address ? (KNOWN_WALLETS[address.toLowerCase()] ?? null) : null;
}
