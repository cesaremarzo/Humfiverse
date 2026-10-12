/* The fee rates the site states must be the contracts' (§2.101, §2.72,
   §2.59): 6% on a direct catalogue sale, 2% on a campaign contribution, 1% on
   resale and on royalty deposits — and the dollar figures computed the way the
   contracts round them. Run with `npm test`. */

import { usdToUsdc, usdcToUsd } from './usdc.util';
import { PRIMARY_FEE_BPS, CONTRIBUTION_FEE_BPS, ROYALTY_FEE_BPS, primaryFeeUsd, contributionFeeUsd, royaltyFeeUsd } from './primary-fee.util';
import { PLATFORM_FEE_BPS, platformFeeUsdc, platformFeeUsd } from './marketplace-fee.util';

describe('USDC units', () => {
  it('converts dollars to base units by the cent, and back', () => {
    expect(usdToUsdc(1)).toBe(1_000_000n);
    expect(usdToUsdc(0.1 + 0.2)).toBe(300_000n); // no float drift
    expect(usdcToUsd(1_234_567n)).toBe(1.234567);
    expect(usdcToUsd('980000')).toBe(0.98);
  });
});

describe('fee rates match the contracts', () => {
  it('6% direct sale, 2% contribution, 1% royalty deposit, 1% resale', () => {
    expect(PRIMARY_FEE_BPS).toBe(600);
    expect(CONTRIBUTION_FEE_BPS).toBe(200);
    expect(ROYALTY_FEE_BPS).toBe(100);
    expect(PLATFORM_FEE_BPS).toBe(100);
  });
});

describe('fee amounts round down to the cent', () => {
  it('on round amounts', () => {
    expect(primaryFeeUsd(100)).toBe(6);
    expect(contributionFeeUsd(100)).toBe(2);
    expect(royaltyFeeUsd(100)).toBe(1);
    expect(platformFeeUsd(100)).toBe(1);
  });

  it('never in the platform’s favour on odd amounts', () => {
    expect(primaryFeeUsd(0.99)).toBe(0.05); // 5.94 cents -> 5
    expect(contributionFeeUsd(1.49)).toBe(0.02); // 2.98 cents -> 2
    expect(platformFeeUsd(0.99)).toBe(0); // 0.99 cents -> 0
  });

  it('the resale fee in base units is the contract’s integer division', () => {
    expect(platformFeeUsdc(1_200_000n)).toBe(12_000n);
    expect(platformFeeUsdc(99n)).toBe(0n);
  });
});
