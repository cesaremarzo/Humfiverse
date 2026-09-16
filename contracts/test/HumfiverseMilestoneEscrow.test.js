const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseMilestoneEscrow", function () {
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

  const GOAL = ethers.parseUnits("1", 6); // $1 funding goal (USDC, 6 decimals)
  const ARTIST_BPS = 2_000; // 20% "funding goal reached"
  const STUDIO_BPS = 4_000; // 40% "studio booked" — paid to the studio, not the artist
  const MIX_BPS = 3_000; // 30% "mix & master delivered"
  const RELEASE_BPS = 1_000; // 10% "release confirmed"

  // Shared token id every test campaign releases from — a low price and
  // huge supply so any contribution amount used across these tests (from
  // 0.1 ETH up to several GOALs) always has plenty of pool left, since
  // these tests are about escrow/campaign behavior, not pool-sizing edge
  // cases (those are HumfiverseCatalogueToken's own tests).
  const TOKEN_ID = 1;
  const TOKEN_PRICE = ethers.parseUnits("0.001", 6);

  // CancelGround
  const NO_GROUND = 0;
  const UNLAWFUL_CONTENT = 1;
  const DECISION = ethers.id("decision record #1");

  // §2.72: 2% of every contribution, 3% of every released tranche, and
  // tranches sized against the goal less the contribution fee.
  const credited = (value) => value - (value * 200n) / 10_000n;
  const TARGET = (GOAL * 9_800n) / 10_000n;
  const gross = (bps) => (TARGET * BigInt(bps)) / 10_000n;
  // A tranche less the 3% milestone fee — what the artist or studio receives.
  const net = (bps) => gross(bps) - (gross(bps) * 300n) / 10_000n;

  async function deployFixture() {
    const [owner, artist, studioWallet, contributor1, contributor2, other, feeRecipient] = await ethers.getSigners();

    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const TokenFactory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await TokenFactory.deploy(await usdc.getAddress());
    await token.waitForDeployment();
    // §2.79: the campaign's goal is the token's price times its supply, so the
    // shared test token is sized to be worth exactly GOAL.
    await token.mintCatalogue(TOKEN_ID, ["escrow-test-token", "Escrow Test Track", "Test Artist"], GOAL / TOKEN_PRICE, GOAL, artist.address, false);

    const Factory = await ethers.getContractFactory("HumfiverseMilestoneEscrow");
    const escrow = await Factory.deploy(await token.getAddress(), feeRecipient.address);
    await escrow.waitForDeployment();
    await token.setEscrowContract(await escrow.getAddress());
    await fundSigners([await escrow.getAddress()]);

    return { escrow, token, owner, artist, studioWallet, contributor1, contributor2, other, feeRecipient };
  }

  async function campaignFixture() {
    const ctx = await deployFixture();
    const { escrow, artist, studioWallet } = ctx;

    const studioTx = await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
    const studioReceipt = await studioTx.wait();
    const studioId = studioReceipt.logs
      .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "StudioRegistered").args.studioId;

    const tx = await escrow.createCampaign(artist.address, studioId,
      "glass-horizon-test",
      TOKEN_ID,
      ["Funding goal reached", "Studio & collaborators booked", "Mix & master delivered", "Release confirmed on DSPs"],
      [ARTIST_BPS, STUDIO_BPS, MIX_BPS, RELEASE_BPS],
      [0, 1, 0, 0] // Payee.ARTIST = 0, Payee.STUDIO = 1
    );
    const receipt = await tx.wait();
    const campaignId = receipt.logs
      .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "CampaignCreated").args.campaignId;

    return { ...ctx, studioId, campaignId };
  }

  describe("studio registry", function () {
    it("registers a studio and emits an event", async function () {
      const { escrow, studioWallet } = await deployFixture();
      await expect(escrow.registerStudio(studioWallet.address, "Analog Sun Studio")).to.emit(escrow, "StudioRegistered");
      const studio = await escrow.studios(1);
      expect(studio.wallet).to.equal(studioWallet.address);
      expect(studio.active).to.equal(true);
    });

    it("only the owner or operator can register a studio", async function () {
      const { escrow, other, studioWallet } = await deployFixture();
      await expect(escrow.connect(other).registerStudio(studioWallet.address, "x")).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not authorized"
      );
    });

    it("lets the owner deactivate a studio, blocking new campaigns from using it", async function () {
      const { escrow, artist, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
      await escrow.setStudioActive(1, false);
      await expect(
        escrow.createCampaign(artist.address, 1, "asset-a", TOKEN_ID, ["a"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio not active");
    });

    it("lets the owner rename a studio, and every campaign already pointing at it sees the new name", async function () {
      const { escrow, artist, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Wrong Name");
      await escrow.createCampaign(artist.address, 1, "asset-a", TOKEN_ID, ["a"], [10_000], [1]);

      await expect(escrow.renameStudio(1, "Correct Name"))
        .to.emit(escrow, "StudioRenamed")
        .withArgs(1, "Wrong Name", "Correct Name");

      const studio = await escrow.studios(1);
      expect(studio.name).to.equal("Correct Name");
    });

    it("only the owner or operator can rename a studio", async function () {
      const { escrow, other, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
      await expect(escrow.connect(other).renameStudio(1, "x")).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not authorized"
      );
    });

    it("refuses to rename an unregistered studio", async function () {
      const { escrow } = await deployFixture();
      await expect(escrow.renameStudio(99, "x")).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown studio");
    });
  });

  describe("campaign creation", function () {
    it("requires milestone bps to total exactly 10000", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, 0, "asset-b", TOKEN_ID, ["a", "b"], [5_000, 4_000], [0, 0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: bps must total 10000");
    });

    it("requires a studio when a milestone pays the studio", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, 0, "asset-c", TOKEN_ID, ["studio milestone"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio milestone needs a studio");
    });

    it("only the owner or operator can create a campaign", async function () {
      const { escrow, artist, other } = await deployFixture();
      await expect(
        escrow.connect(other).createCampaign(artist.address, 0, "asset-d", TOKEN_ID, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: not authorized");
    });

    it("stores the milestones and they're readable back", async function () {
      const { escrow, campaignId } = await campaignFixture();
      const milestones = await escrow.getMilestones(campaignId);
      expect(milestones.length).to.equal(4);
      expect(milestones[1].name).to.equal("Studio & collaborators booked");
      expect(milestones[1].bps).to.equal(STUDIO_BPS);
      expect(milestones[1].payee).to.equal(1); // STUDIO
    });

    it("requires a non-empty assetId", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, 0, "", TOKEN_ID, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: assetId required");
    });

    it("refuses to create a second campaign for the same assetId", async function () {
      const { escrow, artist } = await campaignFixture();
      await expect(
        escrow.createCampaign(artist.address, 0, "glass-horizon-test", TOKEN_ID, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: asset already has a campaign");
    });

    it("looks up the campaign id straight from the asset id on-chain", async function () {
      const { escrow, campaignId } = await campaignFixture();
      expect(await escrow.campaignIdByAssetId("glass-horizon-test")).to.equal(campaignId);
      const c = await escrow.campaigns(await escrow.campaignIdByAssetId("glass-horizon-test"));
      expect(c.assetId).to.equal("glass-horizon-test");
    });
  });

  describe("contributions", function () {
    it("accumulates contributions and tracks per-contributor amounts", async function () {
      const { escrow, campaignId, contributor1, contributor2 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.3", 6));
      await escrow.connect(contributor2).contribute(campaignId, ethers.parseUnits("0.2", 6));

      const c = await escrow.campaigns(campaignId);
      expect(c.raised).to.equal(credited(ethers.parseUnits("0.3", 6)) + credited(ethers.parseUnits("0.2", 6)));
      expect(await escrow.contributions(campaignId, contributor1.address)).to.equal(credited(ethers.parseUnits("0.3", 6)));
    });

    it("releases matching tokens straight to the contributor in the same transaction, atomically (§2.42)", async function () {
      const { escrow, token, campaignId, contributor1 } = await campaignFixture();
      const value = ethers.parseUnits("0.3", 6); // 300 tokens at TOKEN_PRICE ($0.001)

      await expect(escrow.connect(contributor1).contribute(campaignId, value))
        .to.emit(token, "TokensReleased")
        .withArgs(TOKEN_ID, contributor1.address, 300n);

      expect(await token.balanceOf(contributor1.address, TOKEN_ID)).to.equal(300n);
      expect(await token.releasedOf(TOKEN_ID)).to.equal(300n);
    });

    it("refuses a contribution that does not buy a whole number of tokens (§2.79)", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await expect(escrow.connect(contributor1).contribute(campaignId, TOKEN_PRICE * 3n + 1n))
        .to.be.revertedWith("HumfiverseMilestoneEscrow: amount must buy whole tokens");
    });

    it("refuses to create a campaign on a token that is not for sale", async function () {
      const { escrow, token, artist } = await deployFixture();
      await token.mintCatalogue(2, ["no-price-token", "Unpriced Track", "Test Artist"], 1_000_000, 0, ethers.ZeroAddress, false);
      await expect(escrow.createCampaign(artist.address, 0, "unpriced-asset", 2, ["a"], [10_000], [0]))
        .to.be.revertedWith("HumfiverseMilestoneEscrow: token is not for sale");
    });

    it("refuses a campaign on a token that is on direct sale, where buy() could bypass it (§2.81)", async function () {
      const { escrow, token, artist } = await deployFixture();
      await token.mintCatalogue(4, ["direct-token", "T", "A"], 5, ethers.parseUnits("50", 6), artist.address, true);
      await expect(escrow.createCampaign(artist.address, 0, "direct-asset", 4, ["a"], [10_000], [0]))
        .to.be.revertedWith("HumfiverseMilestoneEscrow: token is on direct sale");
    });

    it("refuses a campaign on a token with tokens already released outside it", async function () {
      const { escrow, token, artist, other } = await deployFixture();
      await token.mintCatalogue(5, ["released-token", "T", "A"], 5, ethers.parseUnits("50", 6), artist.address, false);
      await token.releaseFromPool(other.address, 5, 1);
      await expect(escrow.createCampaign(artist.address, 0, "released-asset", 5, ["a"], [10_000], [0]))
        .to.be.revertedWith("HumfiverseMilestoneEscrow: tokens already sold outside the escrow");
    });

    it("takes its goal from the token — price times supply — rather than a parameter", async function () {
      const { escrow, token, campaignId } = await campaignFixture();
      expect((await escrow.campaigns(campaignId)).fundingGoal).to.equal(await token.fundingOf(TOKEN_ID));
      expect((await escrow.campaigns(campaignId)).fundingGoal).to.equal(GOAL);
    });

    it("cannot raise more than the tokens are worth: a contribution past the supply reverts", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await expect(escrow.connect(contributor1).contribute(campaignId, TOKEN_PRICE)).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");
    });

    it("refuses to create a campaign for a token id that hasn't been minted", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, 0, "asset-unknown-token", 999, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown token id");
    });

    it("refuses a zero-value contribution", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await expect(escrow.connect(contributor1).contribute(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: zero contribution"
      );
    });

    it("refuses contributions to an unknown campaign", async function () {
      const { escrow, contributor1 } = await deployFixture();
      await expect(
        escrow.connect(contributor1).contribute(999, ethers.parseUnits("0.1", 6))
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown campaign");
    });

    it("has no deadline: nothing in a campaign or its creation mentions one", async function () {
      const { escrow } = await deployFixture();
      const create = escrow.interface.getFunction("createCampaign");
      expect(create.inputs.map((i) => i.name)).to.not.include("deadline");
      expect(escrow.interface.getEvent("CampaignCreated").inputs.map((i) => i.name)).to.not.include("deadline");
      expect(escrow.interface.getFunction("campaigns").outputs.map((o) => o.name)).to.not.include("deadline");
    });
  });

  describe("dual-confirmation milestone release (§2.27 — Humfiverse has no say)", function () {
    it("releases the studio-commitment milestone straight to the studio's wallet, never the artist, only once both sides confirm", async function () {
      const { escrow, campaignId, contributor1, studioWallet, artist } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);

      const studioBalBefore = await usdc.balanceOf(studioWallet.address);
      const artistBalBefore = await usdc.balanceOf(artist.address);

      // Artist alone confirming doesn't release it.
      const artistTx = await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      const artistReceipt = await artistTx.wait();
      const artistGasCost = artistReceipt.gasUsed * artistReceipt.gasPrice;
      expect(await usdc.balanceOf(studioWallet.address)).to.equal(studioBalBefore);

      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      await expect(tx)
        .to.emit(escrow, "MilestoneConfirmed")
        .withArgs(campaignId, 1, studioWallet.address, net(STUDIO_BPS));
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const studioBalAfter = await usdc.balanceOf(studioWallet.address);
      const artistBalAfter = await usdc.balanceOf(artist.address);

      // Both studioWallet and artist paid gas for their own confirming calls
      // above — added back to isolate the payout from each one's tx fee.
      expect(studioBalAfter - studioBalBefore).to.equal(net(STUDIO_BPS));
      expect(artistBalAfter).to.equal(artistBalBefore); // untouched by this milestone besides its own gas
    });

    it("pays artist-payee milestones to the artist, still requiring the studio's confirmation too", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);

      const artistBalBefore = await usdc.balanceOf(artist.address);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0); // studio confirms alone — no release yet
      expect(await usdc.balanceOf(artist.address)).to.equal(artistBalBefore);

      const tx = await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0); // "Funding goal reached", ARTIST payee
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const artistBalAfter = await usdc.balanceOf(artist.address);

      expect(artistBalAfter - artistBalBefore).to.equal(net(ARTIST_BPS));
    });

    it("Humfiverse (the owner) has no function that releases a milestone on its own say-so", async function () {
      const { escrow } = await deployFixture();
      expect(escrow.interface.getFunction("confirmMilestone")).to.be.null;
    });

    it("only the campaign's own artist can confirm as artist", async function () {
      const { escrow, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await expect(escrow.connect(other).confirmMilestoneAsArtist(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not this campaign's artist"
      );
    });

    it("only the campaign's own studio can confirm as studio", async function () {
      const { escrow, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await expect(escrow.connect(other).confirmMilestoneAsStudio(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not this campaign's studio"
      );
    });

    it("refuses to release a milestone twice", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0);
      await expect(escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: already released"
      );
    });

    it("does not release a milestone before enough has been raised to cover it, even with both confirmations in", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      // Only 10% raised, but milestone 1 (studio) needs 40%
      await escrow.connect(contributor1).contribute(campaignId, GOAL / 10n);
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      const studioBalBefore = await usdc.balanceOf(studioWallet.address);
      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      // No revert — confirmations are recorded either way — but no payout happens
      // yet, so the studio's balance only moves by its own gas cost.
      expect(await usdc.balanceOf(studioWallet.address)).to.equal(studioBalBefore);
    });

    it("releases automatically on the second confirmation once enough was already raised in the meantime", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL / 10n); // not enough for milestone 1 (40%) yet
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      await escrow.connect(contributor1).contribute(campaignId, GOAL - GOAL / 10n); // now the whole goal
      const studioBalBefore = await usdc.balanceOf(studioWallet.address);
      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      expect(await usdc.balanceOf(studioWallet.address)).to.equal(
        studioBalBefore + net(STUDIO_BPS)
      );
    });
  });

  describe("USDC payments (§2.73)", function () {
    it("pulls the contribution with transferFrom and refuses without enough allowance", async function () {
      const { escrow, token, campaignId, contributor1 } = await campaignFixture();
      expect(await escrow.paymentToken()).to.equal(await token.paymentToken());

      await usdc.connect(contributor1).approve(await escrow.getAddress(), ethers.parseUnits("0.1", 6) - 1n);
      await expect(escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.1", 6)))
        .to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");

      await usdc.connect(contributor1).approve(await escrow.getAddress(), ethers.MaxUint256);
      const before = await usdc.balanceOf(contributor1.address);
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.1", 6));
      expect(before - (await usdc.balanceOf(contributor1.address))).to.equal(ethers.parseUnits("0.1", 6));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(ethers.parseUnits("0.1", 6));
    });
  });

  describe("platform fees (2% of contributions, 3% of released tranches)", function () {
    async function releaseAll(ctx) {
      const { escrow, campaignId, artist, studioWallet } = ctx;
      for (let i = 0; i < 4; i++) {
        await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, i);
        await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, i);
      }
    }

    it("deducts 2% from a contribution, credits the campaign 98%, and still gives tokens for the full amount", async function () {
      const { escrow, token, campaignId, contributor1 } = await campaignFixture();
      const value = ethers.parseUnits("0.5", 6); // 500 tokens at 0.001

      await expect(escrow.connect(contributor1).contribute(campaignId, value))
        .to.emit(escrow, "ContributionFeeRetained")
        .withArgs(campaignId, contributor1.address, value / 50n);

      expect((await escrow.campaigns(campaignId)).raised).to.equal(value - value / 50n);
      expect(await escrow.accruedFees()).to.equal(value / 50n);
      expect(await token.balanceOf(contributor1.address, TOKEN_ID)).to.equal(500n);
    });

    it("sizes tranches against the goal less 2%, so a sold-out campaign can release every milestone", async function () {
      const ctx = await campaignFixture();
      const { escrow, campaignId, contributor1 } = ctx;
      expect(await escrow.fundingTargetOf(campaignId)).to.equal(TARGET);

      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      expect((await escrow.campaigns(campaignId)).raised).to.equal(TARGET);
      await releaseAll(ctx);

      expect((await escrow.campaigns(campaignId)).releasedBps).to.equal(10_000);
      const milestoneFees = (TARGET * 300n) / 10_000n;
      expect(await escrow.totalFeesCollected()).to.equal(GOAL / 50n + milestoneFees);
      expect(await escrow.campaignFeesCollected(campaignId)).to.equal(GOAL / 50n + milestoneFees);
      // The contract now holds the fees and nothing else.
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(GOAL / 50n + milestoneFees);
    });

    it("retains 3% of each tranche and emits it", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);

      const fee = (gross(STUDIO_BPS) * 300n) / 10_000n;
      await expect(escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1))
        .to.emit(escrow, "PlatformFeeRetained")
        .withArgs(campaignId, 1, fee);
      expect(await escrow.accruedFees()).to.equal(GOAL / 50n + fee);
    });

    it("sends accrued fees to the fee recipient on withdrawal, whoever calls it", async function () {
      const ctx = await campaignFixture();
      const { escrow, campaignId, contributor1, other, feeRecipient } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await releaseAll(ctx);
      const total = await escrow.accruedFees();

      const before = await usdc.balanceOf(feeRecipient.address);
      await expect(escrow.connect(other).withdrawFees())
        .to.emit(escrow, "FeesWithdrawn")
        .withArgs(feeRecipient.address, total);

      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(before + total);
      expect(await escrow.accruedFees()).to.equal(0);
      expect(await escrow.totalFeesCollected()).to.equal(total);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
      await expect(escrow.withdrawFees()).to.be.revertedWith("HumfiverseMilestoneEscrow: no fees to withdraw");
    });

    it("only the owner can change the fee recipient", async function () {
      const { escrow, owner, other } = await deployFixture();
      await expect(escrow.connect(other).setFeeRecipient(other.address)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
      await expect(escrow.connect(owner).setFeeRecipient(other.address))
        .to.emit(escrow, "FeeRecipientUpdated");
      expect(await escrow.feeRecipient()).to.equal(other.address);
    });

    it("refunds a partly funded, partly released campaign from what it actually holds, keeping the contribution fee", async function () {
      const { escrow, campaignId, contributor1, contributor2, artist, studioWallet } = await campaignFixture();
      // Half the goal, then the 20% tranche, then cancellation — the case the
      // old refund formula overpaid.
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.3", 6));
      await escrow.connect(contributor2).contribute(campaignId, ethers.parseUnits("0.2", 6));
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0);
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);

      await escrow.connect(contributor1).refund(campaignId, 300);
      await escrow.connect(contributor2).refund(campaignId, 200);

      // Both refunds paid, the last one taking any rounding remainder: the
      // contract holds exactly the fees.
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(await escrow.accruedFees());
      await escrow.withdrawFees();
    });

    it("never pays one campaign's refunds out of another campaign's funds", async function () {
      const ctx = await campaignFixture();
      const { escrow, token, campaignId, contributor1, contributor2, artist, studioWallet } = ctx;
      await token.mintCatalogue(3, ["second-token", "Second", "Artist"], GOAL / TOKEN_PRICE, GOAL, artist.address, false);
      await escrow.createCampaign(artist.address, 0, "second-campaign", 3, ["All"], [10_000], [0]);
      await escrow.connect(contributor2).contribute(2, GOAL);

      await escrow.connect(contributor1).contribute(campaignId, GOAL / 2n);
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0);
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      await escrow.connect(contributor1).refund(campaignId, 500);

      // The second campaign's credited funds are all still here, plus fees.
      const balance = await usdc.balanceOf(await escrow.getAddress());
      expect(balance >= TARGET + (await escrow.accruedFees())).to.equal(true);
    });

    it("never releases more in total than the campaign raised, so one campaign cannot spend another's funds", async function () {
      const ctx = await campaignFixture();
      const { escrow, token, campaignId, contributor1, contributor2, artist, studioWallet } = ctx;

      await token.mintCatalogue(3, ["second-token", "Second", "Artist"], GOAL / TOKEN_PRICE, GOAL, artist.address, false);
      await escrow.createCampaign(artist.address, 0, "second-campaign", 3, ["All"], [10_000], [0]);
      await escrow.connect(contributor2).contribute(2, GOAL);

      // The first raises about half its target.
      await escrow.connect(contributor1).contribute(campaignId, GOAL / 2n);

      // 40% of the target fits.
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      expect((await escrow.getMilestones(campaignId))[1].released).to.equal(true);

      // A further 30% would be 70% of the target against ~50% raised — it must wait.
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 2);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 2);
      expect((await escrow.getMilestones(campaignId))[2].released).to.equal(false);
    });
  });

  describe("cancellation and refunds (phase 2: per token held, burned)", function () {
    async function releaseMilestone(ctx, i) {
      await ctx.escrow.connect(ctx.artist).confirmMilestoneAsArtist(ctx.campaignId, i);
      await ctx.escrow.connect(ctx.studioWallet).confirmMilestoneAsStudio(ctx.campaignId, i);
    }

    it("shares the unreleased remainder over the tokens sold, burning the tokens handed back", async function () {
      const ctx = await campaignFixture();
      const { escrow, token, campaignId, contributor1, contributor2 } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.6", 6)); // 600 tokens
      await escrow.connect(contributor2).contribute(campaignId, ethers.parseUnits("0.4", 6)); // 400 tokens
      await releaseMilestone(ctx, 0); // 20% before things stall

      const pool = TARGET - gross(ARTIST_BPS);
      await expect(escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash))
        .to.emit(escrow, "CampaignCancelled")
        .withArgs(campaignId, NO_GROUND, ethers.ZeroHash, pool, 1000n);
      expect(await escrow.refundQuote(campaignId, 600)).to.equal((pool * 600n) / 1000n);

      const before = await usdc.balanceOf(contributor1.address);
      await expect(escrow.connect(contributor1).refund(campaignId, 600))
        .to.emit(escrow, "Refunded")
        .withArgs(campaignId, contributor1.address, 600n, (pool * 600n) / 1000n);
      expect((await usdc.balanceOf(contributor1.address)) - before).to.equal((pool * 600n) / 1000n);
      expect(await token.balanceOf(contributor1.address, TOKEN_ID)).to.equal(0n);
      expect(await token.burnedOf(TOKEN_ID)).to.equal(600n);
      expect(await token.outstandingSupply(TOKEN_ID)).to.equal(GOAL / TOKEN_PRICE - 600n);
    });

    it("follows the token: a buyer on resale is refunded, and the seller cannot claim for tokens it sold", async function () {
      const { escrow, token, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.1", 6)); // 100 tokens
      await token.connect(contributor1).safeTransferFrom(contributor1.address, other.address, TOKEN_ID, 40, "0x");
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);

      const pool = credited(ethers.parseUnits("0.1", 6));
      const before = await usdc.balanceOf(other.address);
      await escrow.connect(other).refund(campaignId, 40);
      expect((await usdc.balanceOf(other.address)) - before).to.equal((pool * 40n) / 100n);

      await expect(escrow.connect(contributor1).refund(campaignId, 100)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: more tokens than refundable"
      );
      await expect(escrow.connect(other).refund(campaignId, 10)).to.be.revertedWithCustomError(token, "ERC1155InsufficientBalance");
      await escrow.connect(contributor1).refund(campaignId, 60);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(await escrow.accruedFees());
    });

    it("pays every unit back: the last refund takes the rounding remainder", async function () {
      const ctx = await campaignFixture();
      const { escrow, token, campaignId, contributor1, contributor2, other } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, TOKEN_PRICE * 300n);
      await releaseMilestone(ctx, 0);
      // 98,000 units over 300 tokens: a share that does not divide evenly.
      await token.connect(contributor1).safeTransferFrom(contributor1.address, contributor2.address, TOKEN_ID, 7, "0x");
      await token.connect(contributor1).safeTransferFrom(contributor1.address, other.address, TOKEN_ID, 3, "0x");
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      expect(await escrow.refundPoolOf(campaignId)).to.equal(98_000n);

      await escrow.connect(contributor2).refund(campaignId, 5);
      await escrow.connect(other).refund(campaignId, 1);
      await escrow.connect(contributor1).refund(campaignId, 290);
      await escrow.connect(contributor2).refund(campaignId, 2);
      await escrow.connect(other).refund(campaignId, 2);
      expect(await escrow.refundPoolOf(campaignId)).to.equal(0n);
      expect(await escrow.refundTokensOf(campaignId)).to.equal(0n);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(await escrow.accruedFees());
    });

    it("keeps the royalties the burned tokens earned before the refund", async function () {
      const { escrow, token, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, GOAL); // every token
      await usdc.connect(other).approve(await token.getAddress(), ethers.MaxUint256);
      await token.connect(other).depositRoyalties(TOKEN_ID, 1_000n, ethers.ZeroHash);
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      await escrow.connect(contributor1).refund(campaignId, GOAL / TOKEN_PRICE);

      expect(await token.claimableRoyalties(TOKEN_ID, contributor1.address)).to.equal(1_000n);
      await token.claimRoyalties(contributor1.address, [TOKEN_ID]);
      await expect(token.connect(other).depositRoyalties(TOKEN_ID, 1n, ethers.ZeroHash)).to.be.revertedWith(
        "HumfiverseCatalogueToken: no outstanding tokens"
      );
    });

    it("refuses to refund before cancellation, and a zero amount", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, ethers.parseUnits("0.1", 6));
      await expect(escrow.connect(contributor1).refund(campaignId, 100)).to.be.revertedWith("HumfiverseMilestoneEscrow: not cancelled");
      expect(await escrow.refundQuote(campaignId, 100)).to.equal(0n);
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      await expect(escrow.connect(contributor1).refund(campaignId, 0)).to.be.revertedWith("HumfiverseMilestoneEscrow: zero tokens");
    });

    it("only the escrow can burn, and only through refund", async function () {
      const { token, contributor1, owner } = await campaignFixture();
      await expect(token.connect(owner).burnForRefund(contributor1.address, TOKEN_ID, 1)).to.be.revertedWith(
        "HumfiverseCatalogueToken: not authorized"
      );
    });

    it("refuses new contributions and releases once cancelled", async function () {
      const ctx = await campaignFixture();
      const { escrow, campaignId, contributor1, artist } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      await expect(escrow.connect(contributor1).contribute(campaignId, TOKEN_PRICE)).to.be.revertedWith("HumfiverseMilestoneEscrow: not active");
      await expect(escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0)).to.be.revertedWith("HumfiverseMilestoneEscrow: not active");
    });

    it("cannot cancel a fully released campaign without a legal ground (§2.86)", async function () {
      const ctx = await campaignFixture();
      const { escrow, campaignId, contributor1 } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      for (let i = 0; i < 4; i++) await releaseMilestone(ctx, i);
      await expect(escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: fully released, needs a legal ground"
      );
    });

    it("cancels a fully released campaign on a legal ground with its decision hash, with nothing to refund", async function () {
      const ctx = await campaignFixture();
      const { escrow, campaignId, contributor1 } = ctx;
      await escrow.connect(contributor1).contribute(campaignId, GOAL);
      for (let i = 0; i < 4; i++) await releaseMilestone(ctx, i);
      await expect(escrow.cancelCampaign(campaignId, UNLAWFUL_CONTENT, ethers.ZeroHash)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: legal ground needs a decision hash"
      );
      await expect(escrow.cancelCampaign(campaignId, UNLAWFUL_CONTENT, DECISION))
        .to.emit(escrow, "CampaignCancelled")
        .withArgs(campaignId, UNLAWFUL_CONTENT, DECISION, 0n, GOAL / TOKEN_PRICE);
      expect(await escrow.cancelGroundOf(campaignId)).to.equal(UNLAWFUL_CONTENT);
      // Burning tokens for nothing would only destroy their future royalties.
      await expect(escrow.connect(contributor1).refund(campaignId, 10)).to.be.revertedWith("HumfiverseMilestoneEscrow: nothing to refund");
    });

    it("refuses to cancel an unknown campaign or one already cancelled", async function () {
      const { escrow, campaignId } = await campaignFixture();
      await expect(escrow.cancelCampaign(999, NO_GROUND, ethers.ZeroHash)).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown campaign");
      await escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash);
      await expect(escrow.cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash)).to.be.revertedWith("HumfiverseMilestoneEscrow: not active");
    });

    it("only the owner can cancel a campaign — not the operator", async function () {
      const { escrow, campaignId, other } = await campaignFixture();
      await escrow.setOperator(other.address);
      await expect(escrow.connect(other).cancelCampaign(campaignId, NO_GROUND, ethers.ZeroHash)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("roles and artist ≠ studio (phase 2)", function () {
    it("refuses a campaign whose studio wallet is the artist (§2.89)", async function () {
      const { escrow, artist } = await deployFixture();
      await escrow.registerStudio(artist.address, "Self Studio");
      await expect(escrow.createCampaign(artist.address, 1, "asset-self", TOKEN_ID, ["a"], [10_000], [1])).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: studio wallet is the artist"
      );
    });

    it("lets the operator register studios and create campaigns, and nothing that moves money", async function () {
      const { escrow, artist, studioWallet, other } = await deployFixture();
      await expect(escrow.connect(other).registerStudio(studioWallet.address, "S")).to.be.revertedWith("HumfiverseMilestoneEscrow: not authorized");
      await expect(escrow.connect(other).setOperator(other.address)).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

      await expect(escrow.setOperator(other.address)).to.emit(escrow, "OperatorUpdated").withArgs(ethers.ZeroAddress, other.address);
      await escrow.connect(other).registerStudio(studioWallet.address, "S");
      await escrow.connect(other).renameStudio(1, "S2");
      await escrow.connect(other).setStudioActive(1, true);
      await escrow.connect(other).createCampaign(artist.address, 1, "asset-op", TOKEN_ID, ["a"], [10_000], [1]);
      await expect(escrow.connect(other).setFeeRecipient(other.address)).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

      await escrow.setOperator(ethers.ZeroAddress);
      await expect(escrow.connect(other).registerStudio(studioWallet.address, "S")).to.be.revertedWith("HumfiverseMilestoneEscrow: not authorized");
    });
  });
});
