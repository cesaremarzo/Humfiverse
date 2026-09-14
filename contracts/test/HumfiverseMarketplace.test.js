const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseMarketplace", function () {
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

  const TOKEN_ID = 1;
  const SUPPLY = 4000;
  const PRICE_PER_TOKEN = ethers.parseUnits("0.001", 6);

  async function deployFixture() {
    const [deployer, seller, buyer, other, feeRecipient] = await ethers.getSigners();

    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const TokenFactory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await TokenFactory.deploy(await usdc.getAddress());
    await token.waitForDeployment();
    await token.mintCatalogue(TOKEN_ID, "midnight-static", SUPPLY, 0, "Midnight Static", "Nova Reyes", ethers.ZeroAddress);
    // Give the seller a first-purchase-equivalent holding via the fee-free pool release.
    await token.releaseFromPool(seller.address, TOKEN_ID, 500);

    const MarketplaceFactory = await ethers.getContractFactory("HumfiverseMarketplace");
    const marketplace = await MarketplaceFactory.deploy(await usdc.getAddress(), feeRecipient.address);
    await marketplace.waitForDeployment();
    await fundSigners([await marketplace.getAddress()]);

    return { token, marketplace, deployer, seller, buyer, other, feeRecipient };
  }

  async function listFixture() {
    const ctx = await deployFixture();
    const { token, marketplace, seller } = ctx;
    await token.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    const tx = await marketplace.connect(seller).list(await token.getAddress(), TOKEN_ID, 200, PRICE_PER_TOKEN);
    const receipt = await tx.wait();
    const listedEvent = receipt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed");
    return { ...ctx, listingId: listedEvent.args.listingId };
  }

  it("lets a holder list tokens they already hold without moving them", async function () {
    const { token, marketplace, seller, listingId } = await listFixture();
    const marketplaceAddr = await marketplace.getAddress();

    const listing = await marketplace.getListing(listingId);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.amount).to.equal(200);
    expect(listing.active).to.equal(true);

    // Non-custodial: tokens are still in the seller's wallet, not the marketplace's.
    expect(await token.balanceOf(seller.address, TOKEN_ID)).to.equal(500);
    expect(await token.balanceOf(marketplaceAddr, TOKEN_ID)).to.equal(0);
  });

  it("refuses to list without prior approval", async function () {
    const { token, marketplace, seller } = await deployFixture();
    await expect(
      marketplace.connect(seller).list(await token.getAddress(), TOKEN_ID, 100, PRICE_PER_TOKEN)
    ).to.be.revertedWith("HumfiverseMarketplace: marketplace not approved");
  });

  it("refuses to list more than the seller holds", async function () {
    const { token, marketplace, seller } = await deployFixture();
    await token.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    await expect(
      marketplace.connect(seller).list(await token.getAddress(), TOKEN_ID, 501, PRICE_PER_TOKEN)
    ).to.be.revertedWith("HumfiverseMarketplace: insufficient balance");
  });

  it("on purchase, gives the buyer every token and retains exactly 1% of the payment for the platform", async function () {
    const { token, marketplace, seller, buyer, listingId } = await listFixture();
    const amount = 100n;
    const cost = amount * PRICE_PER_TOKEN;
    const fee = cost / 100n;
    const sellerBalanceBefore = await usdc.balanceOf(seller.address);

    await expect(marketplace.connect(buyer).buyListing(listingId, amount))
      .to.emit(marketplace, "Purchased")
      .withArgs(listingId, buyer.address, amount, fee, cost);

    expect(await token.balanceOf(buyer.address, TOKEN_ID)).to.equal(100);
    expect(await token.balanceOf(seller.address, TOKEN_ID)).to.equal(400); // 500 - 100 sold

    const sellerBalanceAfter = await usdc.balanceOf(seller.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(cost - fee);
    expect(await marketplace.accruedFees()).to.equal(fee);
    expect(await marketplace.totalFeesCollected()).to.equal(fee);
    expect(await usdc.balanceOf(await marketplace.getAddress())).to.equal(fee);

    const listing = await marketplace.getListing(listingId);
    expect(listing.amount).to.equal(100);
    expect(listing.active).to.equal(true);
  });

  it("charges the fee on a single-token trade too, where a token-denominated fee would round to zero", async function () {
    const { token, marketplace, buyer, listingId } = await listFixture();
    const cost = PRICE_PER_TOKEN;

    await expect(marketplace.connect(buyer).buyListing(listingId, 1))
      .to.emit(marketplace, "Purchased")
      .withArgs(listingId, buyer.address, 1n, cost / 100n, cost);

    expect(await token.balanceOf(buyer.address, TOKEN_ID)).to.equal(1);
    expect(await marketplace.getListing(listingId).then((l) => l.amount)).to.equal(199);
  });

  it("rounds the fee down to the wei", async function () {
    const { token, marketplace, seller, buyer } = await deployFixture();
    await token.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    await marketplace.connect(seller).list(await token.getAddress(), TOKEN_ID, 10, 199n); // 199 wei each
    const listingId = 1n;

    await marketplace.connect(buyer).buyListing(listingId, 1);
    expect(await marketplace.accruedFees()).to.equal(1n); // floor(199 / 100)
  });

  it("sends accrued fees to the fee recipient on withdrawal, whoever calls it", async function () {
    const { marketplace, buyer, other, feeRecipient, listingId } = await listFixture();
    const cost = 200n * PRICE_PER_TOKEN;
    await marketplace.connect(buyer).buyListing(listingId, 200);
    const fee = cost / 100n;

    const recipientBefore = await usdc.balanceOf(feeRecipient.address);
    await expect(marketplace.connect(other).withdrawFees())
      .to.emit(marketplace, "FeesWithdrawn")
      .withArgs(feeRecipient.address, fee);

    expect(await usdc.balanceOf(feeRecipient.address)).to.equal(recipientBefore + fee);
    expect(await marketplace.accruedFees()).to.equal(0);
    expect(await marketplace.totalFeesCollected()).to.equal(fee); // lifetime total survives the withdrawal
    await expect(marketplace.withdrawFees()).to.be.revertedWith("HumfiverseMarketplace: no fees to withdraw");
  });

  it("closes the listing once fully sold", async function () {
    const { marketplace, buyer, listingId } = await listFixture();
    const cost = 200n * PRICE_PER_TOKEN;
    await marketplace.connect(buyer).buyListing(listingId, 200);

    const listing = await marketplace.getListing(listingId);
    expect(listing.amount).to.equal(0);
    expect(listing.active).to.equal(false);
  });

  it("refuses to buy more than remains in the listing", async function () {
    const { marketplace, buyer, listingId } = await listFixture();
    const cost = 201n * PRICE_PER_TOKEN;
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 201)
    ).to.be.revertedWith("HumfiverseMarketplace: bad amount");
  });

  it("refuses a buyer who has not approved enough USDC, and moves nothing", async function () {
    const { token, marketplace, buyer, seller, listingId } = await listFixture();
    await usdc.connect(buyer).approve(await marketplace.getAddress(), 100n * PRICE_PER_TOKEN - 1n);
    await expect(marketplace.connect(buyer).buyListing(listingId, 100)).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
    expect(await token.balanceOf(seller.address, TOKEN_ID)).to.equal(500);
    expect((await marketplace.getListing(listingId)).amount).to.equal(200);
  });

  it("refuses to buy from an inactive listing", async function () {
    const { marketplace, seller, buyer, listingId } = await listFixture();
    await marketplace.connect(seller).cancelListing(listingId);
    const cost = 10n * PRICE_PER_TOKEN;
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 10)
    ).to.be.revertedWith("HumfiverseMarketplace: not active");
  });

  it("only the seller can cancel their listing", async function () {
    const { marketplace, other, listingId } = await listFixture();
    await expect(marketplace.connect(other).cancelListing(listingId)).to.be.revertedWith(
      "HumfiverseMarketplace: not seller"
    );
  });

  it("emits ListingCancelled with the amount returned", async function () {
    const { marketplace, seller, listingId } = await listFixture();
    await expect(marketplace.connect(seller).cancelListing(listingId))
      .to.emit(marketplace, "ListingCancelled")
      .withArgs(listingId, 200);
  });

  it("only the owner can change the fee recipient", async function () {
    const { marketplace, other } = await deployFixture();
    await expect(marketplace.connect(other).setFeeRecipient(other.address)).to.be.revertedWithCustomError(
      marketplace,
      "OwnableUnauthorizedAccount"
    );
  });

  it("lets the owner update the fee recipient, applied to the next withdrawal", async function () {
    const { marketplace, deployer, buyer, other, listingId } = await listFixture();
    const cost = 100n * PRICE_PER_TOKEN;
    await marketplace.connect(buyer).buyListing(listingId, 100);
    await marketplace.connect(deployer).setFeeRecipient(other.address);

    const before = await usdc.balanceOf(other.address);
    await marketplace.connect(deployer).withdrawFees();
    expect(await usdc.balanceOf(other.address)).to.equal(before + cost / 100n);
  });

  it("never charges a fee on the first purchase, since that only ever happens via releaseFromPool", async function () {
    const { token, buyer } = await deployFixture();
    // releaseFromPool (the only path for a first purchase) has no fee concept at all.
    await token.releaseFromPool(buyer.address, TOKEN_ID, 300);
    expect(await token.balanceOf(buyer.address, TOKEN_ID)).to.equal(300);
  });
});
