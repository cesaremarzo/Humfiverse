const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseMilestoneEscrow", function () {
  const GOAL = ethers.parseEther("1"); // 1 ETH funding goal
  const ARTIST_BPS = 2_000; // 20% "funding goal reached"
  const STUDIO_BPS = 4_000; // 40% "studio booked" — paid to the studio, not the artist
  const MIX_BPS = 3_000; // 30% "mix & master delivered"
  const RELEASE_BPS = 1_000; // 10% "release confirmed"

  async function deployFixture() {
    const [owner, artist, studioWallet, contributor1, contributor2, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HumfiverseMilestoneEscrow");
    const escrow = await Factory.deploy();
    await escrow.waitForDeployment();
    return { escrow, owner, artist, studioWallet, contributor1, contributor2, other };
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
        escrow.createCampaign(artist.address, GOAL, 1, 0, "asset-a", ["a"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio not active");
    });
  });

  describe("campaign creation", function () {
    it("requires milestone bps to total exactly 10000", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "asset-b", ["a", "b"], [5_000, 4_000], [0, 0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: bps must total 10000");
    });

    it("requires a studio when a milestone pays the studio", async function () {
      const { escrow, artist } = await deployFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "asset-c", ["studio milestone"], [10_000], [1])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: studio milestone needs a studio");
    });

    it("only the owner can create a campaign", async function () {
      const { escrow, artist, other } = await deployFixture();
      await expect(
        escrow.connect(other).createCampaign(artist.address, GOAL, 0, 0, "asset-d", ["a"], [10_000], [0])
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
        escrow.createCampaign(artist.address, GOAL, 0, 0, "", ["a"], [10_000], [0])
      ).to.be.revertedWith("HumfiverseMilestoneEscrow: assetId required");
    });

    it("refuses to create a second campaign for the same assetId", async function () {
      const { escrow, artist } = await campaignFixture();
      await expect(
        escrow.createCampaign(artist.address, GOAL, 0, 0, "glass-horizon-test", ["a"], [10_000], [0])
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
        "asset-past-deadline",
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

  describe("confirmMilestone", function () {
    it("pays the studio-commitment milestone straight to the studio's wallet, never the artist", async function () {
      const { escrow, campaignId, contributor1, studioWallet, artist } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });

      const studioBalBefore = await ethers.provider.getBalance(studioWallet.address);
      const artistBalBefore = await ethers.provider.getBalance(artist.address);

      await expect(escrow.confirmMilestone(campaignId, 1))
        .to.emit(escrow, "MilestoneConfirmed")
        .withArgs(campaignId, 1, studioWallet.address, (GOAL * BigInt(STUDIO_BPS)) / 10_000n);

      const studioBalAfter = await ethers.provider.getBalance(studioWallet.address);
      const artistBalAfter = await ethers.provider.getBalance(artist.address);

      expect(studioBalAfter - studioBalBefore).to.equal((GOAL * BigInt(STUDIO_BPS)) / 10_000n);
      expect(artistBalAfter).to.equal(artistBalBefore); // untouched by this milestone
    });

    it("pays artist-payee milestones to the artist", async function () {
      const { escrow, campaignId, contributor1, artist } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });

      const artistBalBefore = await ethers.provider.getBalance(artist.address);
      await escrow.confirmMilestone(campaignId, 0); // "Funding goal reached", ARTIST
      const artistBalAfter = await ethers.provider.getBalance(artist.address);

      expect(artistBalAfter - artistBalBefore).to.equal((GOAL * BigInt(ARTIST_BPS)) / 10_000n);
    });

    it("only the owner (Humfiverse) can confirm a milestone", async function () {
      const { escrow, campaignId, contributor1, other } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });
      await expect(escrow.connect(other).confirmMilestone(campaignId, 0)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });

    it("refuses to release a milestone twice", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL });
      await escrow.confirmMilestone(campaignId, 0);
      await expect(escrow.confirmMilestone(campaignId, 0)).to.be.revertedWith("HumfiverseMilestoneEscrow: already released");
    });

    it("refuses to release a milestone before enough has been raised to cover it", async function () {
      const { escrow, campaignId, contributor1 } = await campaignFixture();
      // Only 10% raised, but milestone 1 (studio) needs 40%
      await escrow.connect(contributor1).contribute(campaignId, { value: GOAL / 10n });
      await expect(escrow.confirmMilestone(campaignId, 1)).to.be.revertedWith(
        "HumfiverseMilestoneEscrow: not enough raised for this tranche"
      );
    });
  });

  describe("cancellation and refunds", function () {
    it("lets contributors claim a pro-rata refund of the unreleased remainder after cancellation", async function () {
      const { escrow, campaignId, contributor1, contributor2 } = await campaignFixture();
      await escrow.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("0.6") });
      await escrow.connect(contributor2).contribute(campaignId, { value: ethers.parseEther("0.4") });

      // Release the first milestone (20%) before things stall.
      await escrow.confirmMilestone(campaignId, 0);
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
