/** The platform's own wallets, by the names the team uses for them — see
 * the "Wallet names" table in CLAUDE.md, which this must match. Display
 * only: permissions always come from the contracts themselves (owner(),
 * feeRecipient()), never from this list. */
const KNOWN_WALLETS: Record<string, string> = {
  '0xba2ad0ca063092e350f1427dd86f7e9c8730245d': 'Owner',
  '0x591596df3c82603d18d6960aed57609e837e3b77': 'Founder',
  // The Founder key until 13 Oct 2026, rotated after it was exposed; still
  // the signer of older mints and campaigns shown on the site.
  '0x142f945e13f59fde3583bea8f78528a44317bfc6': 'Founder (old key)',
  '0xd156bdd971c9034a2c78496889e258c4601b7524': 'Fees'
};

export function knownWalletName(address: string | null | undefined): string | null {
  return address ? (KNOWN_WALLETS[address.toLowerCase()] ?? null) : null;
}
