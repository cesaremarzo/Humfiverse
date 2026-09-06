const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseMilestoneEscrow", function () {
  const GOAL = ethers.parseEther("1"); // 1 ETH funding goal
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
  const TOKEN_PRICE = ethers.parseEther("0.001");

  async function deployFixture() {
    const [owner, artist, studioWallet, contributor1, contributor2, other] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await TokenFactory.deploy();
    await token.waitForDeployment();
    await token.mintCatalogue(TOKEN_ID, "escrow-test-token", 1_000_000, TOKEN_PRICE, "Escrow Test Track", "Test Artist");

    const Factory = await ethers.getContractFactory("HumfiverseMilestoneEscrow");
    const escrow = await Factory.deploy(await token.getAddress());
    await escrow.waitForDeployment();
    await token.setEscrowContract(await escrow.getAddress());

    return { escrow, token, owner, artist, studioWallet, contributor1, contributor2, other };
  }

  async function campaignFixture() {
    const ctx = await deployFixture();
    const { escrow, artist, studioWallet } = ctx;

    const studioTx = await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
    const studioReceipt = await studioTx.wait();
    const studioId = studioReceipt.logs
      .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "StudioRegistered").args.studioId;

    const tx = await escrow.createCampaign(
      artist.address,
      GOAL,
      studioId,
      0,
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

    it("only the owner can register a studio", async function () {
      const { escrow, other, studioWallet } = await deployFixture();
      await expect(escrow.connect(other).registerStudio(studioWallet.address, "x")).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });

    it("lets the owner deactivate a studio, blocking new campaigns from using it", async function () {
      const { escrow, artist, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
      await escrow.setStudioActive(1, false);
      await expect(
        escrow.createCampaign(artist.address, GOAL, 1, 0, "asset-a", TOKEN_ID, ["a"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio not active");
    });

    it("lets the owner rename a studio, and every campaign already pointing at it sees the new name", async function () {
      const { escrow, artist, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Wrong Name");
      await escrow.createCampaign(artist.address, GOAL, 1, 0, "asset-a", TOKEN_ID, ["a"], [10_000], [1]);

      await expect(escrow.renameStudio(1, "Correct Name"))
        .to.emit(escrow, "StudioRenamed")
        .withArgs(1, "Wrong Name", "Correct Name");

      const studio = await escrow.studios(1);
      expect(studio.name).to.equal("Correct Name");
    });

    it("only the owner can rename a studio", async function () {
      const { escrow, other, studioWallet } = await deployFixture();
      await escrow.registerStudio(studioWallet.address, "Analog Sun Studio");
      await expect(escrow.connect(other).renameStudio(1, "x")).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
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
        escrow.createCampaign(artist.address, GOAL, 0, 0, "asset-b", TOKEN_ID, ["a", "b"], [5_000, 4_000], [0, 0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: bps must total 10000");
    });

    it("requires a studio when a milestone pays the studio", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "asset-c", TOKEN_ID, ["studio milestone"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio milestone needs a studio");
    });

    it("only the owner can create a campaign", async function () {
      const { escrow, artist, other } = await deployFixture();
      await expect(
        escrow.connect(other).createCampaign(artist.address, GOAL, 0, 0, "asset-d", TOKEN_ID, ["a"], [10_000], [0])
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
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
        escrow.createCampaign(artist.address, GOAL, 0, 0, "", TOKEN_ID, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: assetId required");
    });

    it("refuses to create a second campaign for the same assetId", async function () {
      const { escrow, artist } = await campaignFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "glass-horizon-test", TOKEN_ID, ["a"], [10_000], [0])
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
      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.3") });
      await escrow.connect(contributor2).contribute(campaignId, { value: ethers.parseEther("0.2") });

      const c = await escrow.campaigns(campaignId);
      expect(c.raised).to.equal(ethers.parseEther("0.5"));
      expect(await escrow.contributions(campaignId, contributor1.address)).to.equal(ethers.parseEther("0.3"));
    });

    it("releases matching tokens straight to the contributor in the same transaction, atomically (§2.42)", async function () {
      const { escrow, token, campaignId, contributor1 } = await campaignFixture();
      const value = ethers.parseEther("0.3"); // 300 tokens at TOKEN_PRICE (0.001 ETH)

      await expect(escrow.connect(contributor1).contribute(campaignId, { value }))
        .to.emit(token, "TokensReleased")
        .withArgs(TOKEN_ID, contributor1.address, 300n);

      expect(await token.balanceOf(contributor1.address, TOKEN_ID)).to.equal(300n);
      expect(await token.releasedOf(TOKEN_ID)).to.equal(300n);
    });

    it("floors to whole tokens and still records the full ETH amount when the contribution doesn't divide evenly", async function () {
      const { escrow, token, campaignId, contributor1 } = await campaignFixture();
      const value = TOKEN_PRICE * 3n + 1n; // 3 whole tokens' worth, plus 1 wei of "dust"

      await escrow.connect(contributor1).contribute(campaignId, { value });

      expect(await token.balanceOf(contributor1.address, TOKEN_ID)).to.equal(3n);
      const c = await escrow.campaigns(campaignId);
      expect(c.raised).to.equal(value); // the dust wei is still recorded as raised, just doesn't buy a token
    });

    it("does not release tokens (but still records the contribution) when the token has no price set", async function () {
      const { escrow, token, artist, contributor1 } = await deployFixture();
      await token.mintCatalogue(2, "no-price-token", 1_000_000, 0, "Unpriced Track", "Test Artist");
      const tx = await escrow.createCampaign(artist.address, GOAL, 0, 0, "unpriced-asset", 2, ["a"], [10_000], [0]);
      const receipt = await tx.wait();
      const campaignId = receipt.logs
        .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "CampaignCreated").args.campaignId;

      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.1") });
      expect(await token.balanceOf(contributor1.address, 2)).to.equal(0n);
      expect((await escrow.campaigns(campaignId)).raised).to.equal(ethers.parseEther("0.1"));
    });

    it("refuses to create a campaign for a token id that hasn't been minted", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "asset-unknown-token", 999, ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown token id");
    });

    it("refuses a zero-value contribution", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await expect(escrow.connect(contributor1).contribute(campaignId, { value: 0 })).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: zero contribution"
      );
    });

    it("refuses contributions to an unknown campaign", async function () {
      const { escrow, contributor1 } = await deployFixture();
      await expect(
        escrow.connect(contributor1).contribute(999, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: unknown campaign");
    });

    it("refuses contributions past the deadline", async function () {
      const { escrow, artist, studioId, contributor1 } = await campaignFixture();
      const latestBlock = await ethers.provider.getBlock("latest");
      const tx = await escrow.createCampaign(
        artist.address,
        GOAL,
        studioId,
        latestBlock.timestamp - 1, // already past
        "asset-past-deadline", TOKEN_ID,
        ["a"],
        [10_000],
        [0]
      );
      const receipt = await tx.wait();
      const pastCampaignId = receipt.logs
        .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "CampaignCreated").args.campaignId;

      await expect(
        escrow.connect(contributor1).contribute(pastCampaignId, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: campaign ended");
    });
  });

  describe("dual-confirmation milestone release (§2.27 — Humfiverse has no say)", function () {
    it("releases the studio-commitment milestone straight to the studio's wallet, never the artist, only once both sides confirm", async function () {
      const { escrow, campaignId, contributor1, studioWallet, artist } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });

      const studioBalBefore = await ethers.provider.getBalance(studioWallet.address);
      const artistBalBefore = await ethers.provider.getBalance(artist.address);

      // Artist alone confirming doesn't release it.
      const artistTx = await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      const artistReceipt = await artistTx.wait();
      const artistGasCost = artistReceipt.gasUsed * artistReceipt.gasPrice;
      expect(await ethers.provider.getBalance(studioWallet.address)).to.equal(studioBalBefore);

      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      await expect(tx)
        .to.emit(escrow, "MilestoneConfirmed")
        .withArgs(campaignId, 1, studioWallet.address, (GOAL * BigInt(STUDIO_BPS)) / 10_000n);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const studioBalAfter = await ethers.provider.getBalance(studioWallet.address);
      const artistBalAfter = await ethers.provider.getBalance(artist.address);

      // Both studioWallet and artist paid gas for their own confirming calls
      // above — added back to isolate the payout from each one's tx fee.
      expect(studioBalAfter - studioBalBefore + gasCost).to.equal((GOAL * BigInt(STUDIO_BPS)) / 10_000n);
      expect(artistBalAfter + artistGasCost).to.equal(artistBalBefore); // untouched by this milestone besides its own gas
    });

    it("pays artist-payee milestones to the artist, still requiring the studio's confirmation too", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });

      const artistBalBefore = await ethers.provider.getBalance(artist.address);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0); // studio confirms alone — no release yet
      expect(await ethers.provider.getBalance(artist.address)).to.equal(artistBalBefore);

      const tx = await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0); // "Funding goal reached", ARTIST payee
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const artistBalAfter = await ethers.provider.getBalance(artist.address);

      expect(artistBalAfter - artistBalBefore + gasCost).to.equal((GOAL * BigInt(ARTIST_BPS)) / 10_000n);
    });

    it("Humfiverse (the owner) has no function that releases a milestone on its own say-so", async function () {
      const { escrow } = await deployFixture();
      expect(escrow.interface.getFunction("confirmMilestone")).to.be.null;
    });

    it("only the campaign's own artist can confirm as artist", async function () {
      const { escrow, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });
      await expect(escrow.connect(other).confirmMilestoneAsArtist(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not this campaign's artist"
      );
    });

    it("only the campaign's own studio can confirm as studio", async function () {
      const { escrow, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });
      await expect(escrow.connect(other).confirmMilestoneAsStudio(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not this campaign's studio"
      );
    });

    it("refuses to release a milestone twice", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0);
      await expect(escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: already released"
      );
    });

    it("does not release a milestone before enough has been raised to cover it, even with both confirmations in", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      // Only 10% raised, but milestone 1 (studio) needs 40%
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL / 10n });
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      const studioBalBefore = await ethers.provider.getBalance(studioWallet.address);
      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      // No revert — confirmations are recorded either way — but no payout happens
      // yet, so the studio's balance only moves by its own gas cost.
      expect(await ethers.provider.getBalance(studioWallet.address)).to.equal(studioBalBefore - gasCost);
    });

    it("releases automatically on the second confirmation once enough was already raised in the meantime", async function () {
      const { escrow, campaignId, contributor1, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL / 10n }); // not enough for milestone 1 (40%) yet
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 1);
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL }); // now well past enough
      const studioBalBefore = await ethers.provider.getBalance(studioWallet.address);
      const tx = await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      expect(await ethers.provider.getBalance(studioWallet.address)).to.equal(
        studioBalBefore - gasCost + (GOAL * BigInt(STUDIO_BPS)) / 10_000n
      );
    });
  });

  describe("cancellation and refunds", function () {
    it("lets contributors claim a pro-rata refund of the unreleased remainder after cancellation", async function () {
      const { escrow, campaignId, contributor1, contributor2, artist, studioWallet } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.6") });
      await escrow.connect(contributor2).contribute(campaignId, { value: ethers.parseEther("0.4") });

      // Release the first milestone (20%) before things stall.
      await escrow.connect(artist).confirmMilestoneAsArtist(campaignId, 0);
      await escrow.connect(studioWallet).confirmMilestoneAsStudio(campaignId, 0);
      await escrow.cancelCampaign(campaignId);

      // 80% of the goal is still unreleased — each contributor gets 80% of what they put in back.
      const bal1Before = await ethers.provider.getBalance(contributor1.address);
      const tx = await escrow.connect(contributor1).refund(campaignId);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const bal1After = await ethers.provider.getBalance(contributor1.address);

      const expected = (ethers.parseEther("0.6") * 8_000n) / 10_000n;
      expect(bal1After - bal1Before + gasCost).to.equal(expected);
    });

    it("refuses to refund before cancellation", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.1") });
      await expect(escrow.connect(contributor1).refund(campaignId)).to.be.revertedWith("HumfiverseMilestoneEscrow: not cancelled");
    });

    it("refuses a second refund from the same contributor", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.1") });
      await escrow.cancelCampaign(campaignId);
      await escrow.connect(contributor1).refund(campaignId);
      await expect(escrow.connect(contributor1).refund(campaignId)).to.be.revertedWith("HumfiverseMilestoneEscrow: nothing to refund");
    });

    it("refuses new contributions once cancelled", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.cancelCampaign(campaignId);
      await expect(
        escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: not active");
    });

    it("only the owner can cancel a campaign", async function () {
      const { escrow, campaignId, other } = await campaignFixture();
      await expect(escrow.connect(other).cancelCampaign(campaignId)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
