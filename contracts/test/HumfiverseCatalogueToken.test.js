const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseCatalogueToken", function () {
  let usdc;

  // §2.73: payments are in USDC. Every signer gets plenty of MockUSDC and
  // approves the contracts up front, so each test reads like the ETH version
  // did; the allowance tests revoke it deliberately.
  async function fundSigners(spenders) {
    for (const s of await ethers.getSigners()) {
      await usdc.mint(s.address, ethers.parseUnits("1000000000", 6));
      for (const spender of spenders) await usdc.connect(s).approve(spender, ethers.MaxUint256);
    }
  }

  const MIDNIGHT_STATIC_ID = 1;
  const MIDNIGHT_STATIC_SUPPLY = 4000;
  const PRICE_PER_TOKEN = ethers.parseUnits("0.0025", 6);

  async function deployFixture() {
    const [owner, buyer, other] = await ethers.getSigners();
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const Factory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await Factory.deploy(await usdc.getAddress());
    await token.waitForDeployment();
    await fundSigners([await token.getAddress()]);
    return { token, owner, buyer, other };
  }

  it("mints the full catalogue supply into the contract's own pool, at the given price", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);

    expect(await token.totalSupplyOf(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
    expect(await token.catalogueSlug(MIDNIGHT_STATIC_ID)).to.equal("midnight-static");
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
    expect(await token.pricePerToken(MIDNIGHT_STATIC_ID)).to.equal(PRICE_PER_TOKEN);
    expect(await token.trackTitle(MIDNIGHT_STATIC_ID)).to.equal("Test Track");
    expect(await token.artistName(MIDNIGHT_STATIC_ID)).to.equal("Test Artist");
  });

  it("emits CatalogueMinted on mint", async function () {
    const { token } = await deployFixture();
    await expect(token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true))
      .to.emit(token, "CatalogueMinted")
      .withArgs(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
  });

  it("refuses to mint the same token id twice", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
    await expect(
      token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], 100, BigInt(100) * PRICE_PER_TOKEN, ethers.ZeroAddress, true)
    ).to.be.revertedWith("HumfiverseCatalogueToken: already minted");
  });

  it("only the owner or operator can mint", async function () {
    const { token, other } = await deployFixture();
    await expect(
      token.connect(other).mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true)
    ).to.be.revertedWith("HumfiverseCatalogueToken: not authorized");
  });

  it("releases tokens from the pool to a buyer and tracks released/pool balances", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);

    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40))
      .to.emit(token, "TokensReleased")
      .withArgs(MIDNIGHT_STATIC_ID, buyer.address, 40);

    expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY - 40);
  });

  it("refuses to release more than the remaining supply", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], 100, BigInt(100) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
    await token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 60);

    await expect(
      token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 41)
    ).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");

    // exactly the remainder still works
    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40)).to.not.be.reverted;
  });

  it("only the owner or the linked escrow contract can release from the pool", async function () {
    const { token, buyer, other } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
    await expect(
      token.connect(other).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 10)
    ).to.be.revertedWith("HumfiverseCatalogueToken: not authorized");
  });

  it("lets the owner authorize an escrow contract, which can then release from the pool too", async function () {
    const { token, owner, buyer, other } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);

    await expect(token.connect(other).setEscrowContract(other.address)).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount"
    );

    await expect(token.setEscrowContract(other.address)).to.emit(token, "EscrowContractUpdated").withArgs(ethers.ZeroAddress, other.address);
    await expect(token.connect(other).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 10)).to.not.be.reverted;
    expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(10);

    // the owner itself is unaffected by whatever the escrow address is set to
    await expect(token.connect(owner).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 5)).to.not.be.reverted;
  });

  it("supports minting and releasing multiple independent catalogues", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(1, ["midnight-static", "Test Track", "Test Artist"], 4000, BigInt(4000) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
    await token.mintCatalogue(2, ["ember-choir", "Ember Choir", "Sasha Wren"], 2500, BigInt(2500) * ethers.parseUnits("0.004", 6), ethers.ZeroAddress, true);

    await token.releaseFromPool(buyer.address, 1, 40);
    await token.releaseFromPool(buyer.address, 2, 12);

    expect(await token.balanceOf(buyer.address, 1)).to.equal(40);
    expect(await token.balanceOf(buyer.address, 2)).to.equal(12);
    expect(await token.poolBalance(1)).to.equal(3960);
    expect(await token.poolBalance(2)).to.equal(2488);
  });

  describe("buy() — public, paid first-purchase path", function () {
    it("lets anyone buy at the fixed price, paying the payout recipient the price less the 6% fee", async function () {
      const { token, owner, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      const cost = 10n * PRICE_PER_TOKEN;
      const ownerBalanceBefore = await usdc.balanceOf(owner.address);

      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 10))
        .to.emit(token, "TokensPurchased")
        .withArgs(MIDNIGHT_STATIC_ID, buyer.address, 10, cost);

      expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(10);
      expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(10);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBalanceBefore + cost - (cost * 600n) / 10_000n);
    });

    it("refuses to buy a catalogue with no price set", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, 0, ethers.ZeroAddress, true);
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1)
      ).to.be.revertedWith("HumfiverseCatalogueToken: not for sale");
    });

    it("refuses a buyer who has not approved enough USDC, and releases nothing", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      await usdc.connect(buyer).approve(await token.getAddress(), 5n * PRICE_PER_TOKEN - 1n);
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 5)).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
      expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(0);
      expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(0);
    });

    it("prices are whole USDC base units, so a price in cents is exact", async function () {
      const { token, owner, buyer } = await deployFixture();
      const price = ethers.parseUnits("15.37", 6); // $15.37
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * price, ethers.ZeroAddress, true);
      const before = await usdc.balanceOf(owner.address);
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 3); // $46.11, fee 6% = $2.7666
      expect(await token.accruedFees()).to.equal(2_766_600n);
      expect(await usdc.balanceOf(owner.address)).to.equal(before + 46_110_000n - 2_766_600n);
    });

    it("refuses to buy more than remains in the pool", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], 10, BigInt(10) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      const cost = 11n * PRICE_PER_TOKEN;
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 11)
      ).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");
    });

    it("shares the same pool/released accounting as releaseFromPool", async function () {
      const { token, buyer, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], 100, BigInt(100) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      await token.releaseFromPool(other.address, MIDNIGHT_STATIC_ID, 60);
      const cost = 40n * PRICE_PER_TOKEN;
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 41)).to.be.revertedWith(
        "HumfiverseCatalogueToken: exceeds supply"
      );
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 40);
      expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(0);
    });
  });

  describe("admin: price and payout recipient", function () {
    it("derives one price for every token from the funding asked for and the supply (§2.79)", async function () {
      const { token, buyer, owner } = await deployFixture();
      // $50 across 5 tokens is $10 each, exactly.
      await expect(token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "T", "A"], 5, ethers.parseUnits("50", 6), ethers.ZeroAddress, true))
        .to.emit(token, "CatalogueFunding")
        .withArgs(MIDNIGHT_STATIC_ID, ethers.parseUnits("50", 6), ethers.parseUnits("10", 6), ethers.parseUnits("50", 6), ethers.ZeroAddress, true);
      expect(await token.pricePerToken(MIDNIGHT_STATIC_ID)).to.equal(ethers.parseUnits("10", 6));
      expect(await token.fundingOf(MIDNIGHT_STATIC_ID)).to.equal(ethers.parseUnits("50", 6));
      // Selling every token raises exactly the funding.
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 5);
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1)).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");
      void owner;
    });

    it("rounds the price down to the base unit when funding does not divide, and reports the effective raise", async function () {
      const { token } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "T", "A"], 3, ethers.parseUnits("50", 6), ethers.ZeroAddress, true);
      expect(await token.pricePerToken(MIDNIGHT_STATIC_ID)).to.equal(16_666_666n);
      expect(await token.fundingOf(MIDNIGHT_STATIC_ID)).to.equal(49_999_998n);
    });

    it("refuses a funding amount too small to give each token a price", async function () {
      const { token } = await deployFixture();
      await expect(token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "T", "A"], 1000, 999, ethers.ZeroAddress, true))
        .to.be.revertedWith("HumfiverseCatalogueToken: funding too small for this supply");
    });

    it("refuses buy() on a token minted for escrow-only sale (§2.81)", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "T", "A"], 5, ethers.parseUnits("50", 6), ethers.ZeroAddress, false);
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1)).to.be.revertedWith("HumfiverseCatalogueToken: sold only through its escrow campaign");
      expect(await token.directSaleOf(MIDNIGHT_STATIC_ID)).to.equal(false);
    });

    it("has no function to change a price after mint", async function () {
      const { token } = await deployFixture();
      expect(token.interface.getFunction("setPrice")).to.be.null;
    });

    it("pays a token's proceeds to its own payout wallet, not the contract-wide recipient", async function () {
      const { token, owner, buyer, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "T", "A"], 10, ethers.parseUnits("100", 6), other.address, true);
      const ownerBefore = await usdc.balanceOf(owner.address);
      const artistBefore = await usdc.balanceOf(other.address);
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 2); // $20, fee 6% = $1.20
      expect(await usdc.balanceOf(other.address)).to.equal(artistBefore + ethers.parseUnits("18.8", 6));
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore);
    });

    it("lets the owner link a minted token to its uploaded track's IPFS URI", async function () {
      const { token } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      const uri = "ipfs://QmTestAudioCid";
      await expect(token.setTrackAudioUri(MIDNIGHT_STATIC_ID, uri)).to.emit(token, "TrackAudioUriUpdated").withArgs(MIDNIGHT_STATIC_ID, uri);
      expect(await token.trackAudioUri(MIDNIGHT_STATIC_ID)).to.equal(uri);
    });

    it("only the owner or operator can set the track audio URI", async function () {
      const { token, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      await expect(token.connect(other).setTrackAudioUri(MIDNIGHT_STATIC_ID, "ipfs://x")).to.be.revertedWith(
        "HumfiverseCatalogueToken: not authorized"
      );
    });

    it("refuses to link audio to a token id that hasn't been minted", async function () {
      const { token } = await deployFixture();
      await expect(token.setTrackAudioUri(999, "ipfs://x")).to.be.revertedWith("HumfiverseCatalogueToken: unknown token id");
    });

    it("lets the owner redirect payout proceeds", async function () {
      const { token, owner, buyer, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, ["midnight-static", "Test Track", "Test Artist"], MIDNIGHT_STATIC_SUPPLY, BigInt(MIDNIGHT_STATIC_SUPPLY) * PRICE_PER_TOKEN, ethers.ZeroAddress, true);
      await token.setPayoutRecipient(other.address);
      const otherBalanceBefore = await usdc.balanceOf(other.address);

      const cost = 3n * PRICE_PER_TOKEN;
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 3);

      expect(await usdc.balanceOf(other.address)).to.equal(otherBalanceBefore + cost - (cost * 600n) / 10_000n);
    });

    it("only the owner can set the payout recipient", async function () {
      const { token, other } = await deployFixture();
      await expect(token.connect(other).setPayoutRecipient(other.address)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("lets the owner repoint the metadata URI, and every wallet substitutes {id} into it", async function () {
      const { token } = await deployFixture();
      await token.setURI("https://example.org/meta/{id}.json");
      expect(await token.uri(MIDNIGHT_STATIC_ID)).to.equal("https://example.org/meta/{id}.json");
    });

    it("only the owner can set the metadata URI", async function () {
      const { token, other } = await deployFixture();
      await expect(token.connect(other).setURI("https://example.org/meta/{id}.json")).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("primary purchase fee (§2.72)", function () {
    const PRICE = ethers.parseUnits("0.001", 6);

    it("is 6%, not the escrow's 2%: a direct sale is charged once, an escrow campaign again on each tranche (§2.101)", async function () {
      const { token } = await deployFixture();
      expect(await token.PRIMARY_FEE_BPS()).to.equal(600);
    });

    it("deducts 6% from a buy(): the buyer gets every token, the payout recipient 94%, the fee accrues", async function () {
      const { token, owner, buyer } = await deployFixture();
      await token.mintCatalogue(7, ["fee-track", "Fee Track", "Artist"], 1000, BigInt(1000) * PRICE, ethers.ZeroAddress, true);
      const cost = PRICE * 100n;
      const fee = (cost * 600n) / 10_000n;
      const payoutBefore = await usdc.balanceOf(owner.address);

      await expect(token.connect(buyer).buy(7, 100))
        .to.emit(token, "PrimaryFeeRetained")
        .withArgs(7, buyer.address, fee);

      expect(await token.balanceOf(buyer.address, 7)).to.equal(100);
      expect(await usdc.balanceOf(owner.address)).to.equal(payoutBefore + cost - fee);
      expect(await token.accruedFees()).to.equal(fee);
      expect(await token.totalFeesCollected()).to.equal(fee);
    });

    it("charges nothing on releaseFromPool, which takes no payment", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(8, ["free-release", "T", "A"], 1000, BigInt(1000) * PRICE, ethers.ZeroAddress, true);
      await token.releaseFromPool(buyer.address, 8, 10);
      expect(await token.accruedFees()).to.equal(0);
    });

    it("sends accrued fees to the fee recipient on withdrawal, whoever calls it, and only the owner can change it", async function () {
      const { token, owner, buyer, other } = await deployFixture();
      await token.mintCatalogue(9, ["withdraw-track", "T", "A"], 1000, BigInt(1000) * PRICE, ethers.ZeroAddress, true);
      await token.connect(buyer).buy(9, 50);
      const fee = (PRICE * 50n * 600n) / 10_000n;

      await expect(token.connect(other).setFeeRecipient(other.address)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      await token.connect(owner).setFeeRecipient(other.address);

      const before = await usdc.balanceOf(other.address);
      await expect(token.connect(buyer).withdrawFees()).to.emit(token, "FeesWithdrawn").withArgs(other.address, fee);
      expect(await usdc.balanceOf(other.address)).to.equal(before + fee);
      expect(await token.accruedFees()).to.equal(0);
      await expect(token.withdrawFees()).to.be.revertedWith("HumfiverseCatalogueToken: no fees to withdraw");
    });
  });

  describe("royalty distribution (§2.92)", function () {
    const ID = 7;
    const SUPPLY = 1000;

    async function royaltyFixture() {
      const ctx = await deployFixture();
      const [, , , artist, alice, bob, admin] = await ethers.getSigners();
      await ctx.token.mintCatalogue(ID, ["royalty-track", "Royalty Track", "Artist"], SUPPLY, ethers.parseUnits("1000", 6), artist.address, true);
      return { ...ctx, artist, alice, bob, admin };
    }

    it("shares a deposit equally over every token, the unsold pool's share going to the payout wallet", async function () {
      const { token, artist, alice, bob, admin } = await royaltyFixture();
      await token.connect(alice).buy(ID, 600);
      await token.connect(bob).buy(ID, 150); // 250 stay in the pool

      const ref = ethers.id("statement 2026-Q3");
      // 10,000 deposited, 1% kept: 9,900 shared over 1,000 tokens.
      await expect(token.connect(admin).depositRoyalties(ID, 10_000n, ref))
        .to.emit(token, "RoyaltiesDeposited")
        .withArgs(ID, admin.address, 9_900n, ref)
        .and.to.emit(token, "RoyaltyFeeRetained")
        .withArgs(ID, admin.address, 100n);

      expect(await token.claimableRoyalties(ID, alice.address)).to.equal(5_940n);
      expect(await token.claimableRoyalties(ID, bob.address)).to.equal(1_485n);
      expect(await token.claimableRoyalties(ID, await token.getAddress())).to.equal(2_475n);
      expect(await token.totalRoyaltiesDistributed(ID)).to.equal(9_900n);

      const before = await usdc.balanceOf(artist.address);
      await expect(token.connect(bob).claimPoolRoyalties(ID))
        .to.emit(token, "RoyaltiesClaimed")
        .withArgs(ID, await token.getAddress(), artist.address, 2_475n);
      expect((await usdc.balanceOf(artist.address)) - before).to.equal(2_475n);
    });

    it("charges the 1% on the whole deposit, the pool's share included (§2.101)", async function () {
      const { token, artist, alice, admin } = await royaltyFixture();
      await token.connect(alice).buy(ID, 100); // 900 of 1,000 stay unsold
      const feesBefore = await token.accruedFees();

      await token.connect(admin).depositRoyalties(ID, 50_000n, ethers.ZeroHash);

      // 500 on the whole deposit, not only on the 10% that is in other hands.
      expect((await token.accruedFees()) - feesBefore).to.equal(500n);
      expect(await token.claimableRoyalties(ID, alice.address)).to.equal(4_950n);
      const before = await usdc.balanceOf(artist.address);
      await token.claimPoolRoyalties(ID);
      expect((await usdc.balanceOf(artist.address)) - before).to.equal(44_550n);
    });

    it("shares a deposit too small to round up a fee whole", async function () {
      const { token, alice, admin } = await royaltyFixture();
      await token.connect(alice).buy(ID, 1000);
      const feesBefore = await token.accruedFees();
      await token.connect(admin).depositRoyalties(ID, 99n, ethers.ZeroHash);
      expect((await token.accruedFees()) - feesBefore).to.equal(0n);
      expect(await token.totalRoyaltiesDistributed(ID)).to.equal(99n);
    });

    it("pays the holder whoever calls the claim, and refuses an empty claim", async function () {
      const { token, alice, bob, admin } = await royaltyFixture();
      await token.connect(alice).buy(ID, 100);
      await token.connect(admin).depositRoyalties(ID, 1_000n, ethers.ZeroHash);

      const aliceBefore = await usdc.balanceOf(alice.address);
      const bobBefore = await usdc.balanceOf(bob.address);
      await token.connect(bob).claimRoyalties(alice.address, [ID]);
      expect((await usdc.balanceOf(alice.address)) - aliceBefore).to.equal(99n);
      expect(await usdc.balanceOf(bob.address)).to.equal(bobBefore);

      await expect(token.claimRoyalties(alice.address, [ID])).to.be.revertedWith("HumfiverseCatalogueToken: nothing to claim");
      await expect(token.claimRoyalties(await token.getAddress(), [ID])).to.be.revertedWith("HumfiverseCatalogueToken: bad holder");
    });

    it("follows the token: a seller keeps what it earned before the transfer, the buyer earns only after", async function () {
      const { token, alice, bob, admin } = await royaltyFixture();
      await token.connect(alice).buy(ID, 500);
      await token.connect(admin).depositRoyalties(ID, 1_000n, ethers.ZeroHash); // 990 shared: alice earns 495
      await token.connect(alice).safeTransferFrom(alice.address, bob.address, ID, 500, "0x");
      await token.connect(admin).depositRoyalties(ID, 2_000n, ethers.ZeroHash); // 1,980 shared: bob earns 990

      expect(await token.claimableRoyalties(ID, alice.address)).to.equal(495n);
      expect(await token.claimableRoyalties(ID, bob.address)).to.equal(990n);
    });

    it("keeps every unit: remainders are carried, so what all parties claim equals what was deposited", async function () {
      const { token, alice, bob, admin } = await royaltyFixture();
      const holders = [alice, bob, admin];
      await token.connect(alice).buy(ID, 333);
      await token.connect(bob).buy(ID, 1);
      let distributed = 0n;
      // Uneven deposits interleaved with transfers, including to a new holder.
      const steps = [7n, 1n, 999n, 13n, 2n, 100_003n, 5n];
      for (let i = 0; i < steps.length; i++) {
        await token.connect(admin).depositRoyalties(ID, steps[i], ethers.ZeroHash);
        distributed += steps[i] - (steps[i] * 100n) / 10_000n;
        const from = i % 2 === 0 ? alice : bob;
        const to = holders[(i + 1) % holders.length];
        const bal = await token.balanceOf(from.address, ID);
        if (bal > 1n && from.address !== to.address) {
          await token.connect(from).safeTransferFrom(from.address, to.address, ID, bal / 3n, "0x");
        }
      }
      // Move every token out of the pool so its sub-unit share is swept too.
      await token.releaseFromPool(alice.address, ID, await token.poolBalance(ID));

      let claimed = 0n;
      for (const h of holders) {
        const c = await token.claimableRoyalties(ID, h.address);
        if (c > 0n) await token.claimRoyalties(h.address, [ID]);
        claimed += c;
      }
      const pool = await token.claimableRoyalties(ID, await token.getAddress());
      if (pool > 0n) await token.claimPoolRoyalties(ID);
      claimed += pool;

      expect(claimed <= distributed).to.equal(true);
      // Only sub-unit residues can remain: at most one unit per account.
      expect(distributed - claimed <= BigInt(holders.length + 1)).to.equal(true);
      expect(await token.totalRoyaltiesClaimed(ID)).to.equal(claimed);
      expect(await token.totalRoyaltiesDistributed(ID)).to.equal(distributed);
      expect(await usdc.balanceOf(await token.getAddress())).to.equal(distributed - claimed + (await token.accruedFees()));
    });

    it("keeps royalties apart from fees, and claims several tokens at once", async function () {
      const { token, alice, admin } = await royaltyFixture();
      await token.mintCatalogue(8, ["second", "Second", "Artist"], 10, ethers.parseUnits("10", 6), ethers.ZeroAddress, true);
      await token.connect(alice).buy(ID, 1000);
      await token.connect(alice).buy(8, 10);
      await token.connect(admin).depositRoyalties(ID, 300n, ethers.ZeroHash); // 1% = 3, shares 297
      await token.connect(admin).depositRoyalties(8, 40n, ethers.ZeroHash); // under 100: no fee

      const fees = await token.accruedFees();
      await token.withdrawFees();
      const before = await usdc.balanceOf(alice.address);
      await token.claimRoyalties(alice.address, [ID, 8]);
      expect((await usdc.balanceOf(alice.address)) - before).to.equal(337n);
      expect(fees > 0n).to.equal(true);
      expect(await usdc.balanceOf(await token.getAddress())).to.equal(0n);
    });

    it("refuses a zero deposit and a deposit on a token that does not exist", async function () {
      const { token, admin } = await royaltyFixture();
      await expect(token.connect(admin).depositRoyalties(ID, 0, ethers.ZeroHash)).to.be.revertedWith("HumfiverseCatalogueToken: zero amount");
      await expect(token.connect(admin).depositRoyalties(999, 1, ethers.ZeroHash)).to.be.revertedWith(
        "HumfiverseCatalogueToken: no outstanding tokens"
      );
    });
  });

  describe("operator role (phase 2)", function () {
    it("can mint and link audio, and nothing that moves tokens or money", async function () {
      const { token, other, buyer } = await deployFixture();
      await expect(token.connect(other).setOperator(other.address)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      await expect(token.setOperator(other.address)).to.emit(token, "OperatorUpdated").withArgs(ethers.ZeroAddress, other.address);

      await token.connect(other).mintCatalogue(MIDNIGHT_STATIC_ID, ["m", "T", "A"], 10, ethers.parseUnits("1", 6), ethers.ZeroAddress, true);
      await token.connect(other).setTrackAudioUri(MIDNIGHT_STATIC_ID, "");
      await expect(token.connect(other).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 1)).to.be.revertedWith(
        "HumfiverseCatalogueToken: not authorized"
      );
      await expect(token.connect(other).setFeeRecipient(other.address)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      await expect(token.connect(other).setEscrowContract(other.address)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      await expect(token.connect(other).setPayoutRecipient(other.address)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
