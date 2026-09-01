const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseMarketplace", function () {
  const TOKEN_ID = 1;
  const SUPPLY = 4000;
  const PRICE_PER_TOKEN = ethers.parseEther("0.001");

  async function deployFixture() {
    const [deployer, seller, buyer, other, feeRecipient] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await TokenFactory.deploy();
    await token.waitForDeployment();
    await token.mintCatalogue(TOKEN_ID, "midnight-static", SUPPLY, 0, "Midnight Static", "Nova Reyes");
    // Give the seller a first-purchase-equivalent holding via the fee-free pool release.
    await token.releaseFromPool(seller.address, TOKEN_ID, 500);

    const MarketplaceFactory = await ethers.getContractFactory("HumfiverseMarketplace");
    const marketplace = await MarketplaceFactory.deploy(feeRecipient.address);
    await marketplace.waitForDeployment();

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

  it("on purchase, retains exactly 1% of the traded tokens for the platform and pays the seller in full", async function () {
    const { token, marketplace, seller, buyer, feeRecipient, listingId } = await listFixture();
    const amount = 100n; // 1% of 100 = 1 token fee
    const cost = amount * PRICE_PER_TOKEN;
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

    await expect(marketplace.connect(buyer).buyListing(listingId, amount, { value: cost }))
      .to.emit(marketplace, "Purchased")
      .withArgs(listingId, buyer.address, amount, 1n, cost);

    expect(await token.balanceOf(buyer.address, TOKEN_ID)).to.equal(99);
    expect(await token.balanceOf(feeRecipient.address, TOKEN_ID)).to.equal(1);
    expect(await token.balanceOf(seller.address, TOKEN_ID)).to.equal(400); // 500 - 100 sold

    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(cost); // paid in full, fee is in tokens not proceeds

    const listing = await marketplace.getListing(listingId);
    expect(listing.amount).to.equal(100);
    expect(listing.active).to.equal(true);
  });

  it("rounds the token fee down to 0 for sales under 100 tokens", async function () {
    const { marketplace, buyer, feeRecipient, listingId } = await listFixture();
    const amount = 50n;
    const cost = amount * PRICE_PER_TOKEN;

    await expect(marketplace.connect(buyer).buyListing(listingId, amount, { value: cost }))
      .to.emit(marketplace, "Purchased")
      .withArgs(listingId, buyer.address, amount, 0n, cost);

    expect(await marketplace.getListing(listingId).then((l) => l.amount)).to.equal(150);
  });

  it("closes the listing once fully sold", async function () {
    const { marketplace, buyer, listingId } = await listFixture();
    const cost = 200n * PRICE_PER_TOKEN;
    await marketplace.connect(buyer).buyListing(listingId, 200, { value: cost });

    const listing = await marketplace.getListing(listingId);
    expect(listing.amount).to.equal(0);
    expect(listing.active).to.equal(false);
  });

  it("refuses to buy more than remains in the listing", async function () {
    const { marketplace, buyer, listingId } = await listFixture();
    const cost = 201n * PRICE_PER_TOKEN;
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 201, { value: cost })
    ).to.be.revertedWith("HumfiverseMarketplace: bad amount");
  });

  it("refuses underpayment or overpayment", async function () {
    const { marketplace, buyer, listingId } = await listFixture();
    const correct = 100n * PRICE_PER_TOKEN;
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 100, { value: correct - 1n })
    ).to.be.revertedWith("HumfiverseMarketplace: wrong payment");
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 100, { value: correct + 1n })
    ).to.be.revertedWith("HumfiverseMarketplace: wrong payment");
  });

  it("refuses to buy from an inactive listing", async function () {
    const { marketplace, seller, buyer, listingId } = await listFixture();
    await marketplace.connect(seller).cancelListing(listingId);
    const cost = 10n * PRICE_PER_TOKEN;
    await expect(
      marketplace.connect(buyer).buyListing(listingId, 10, { value: cost })
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

  it("lets the owner update the fee recipient, applied to subsequent purchases", async function () {
    const { token, marketplace, deployer, buyer, other, listingId } = await listFixture();
    await marketplace.connect(deployer).setFeeRecipient(other.address);

    const cost = 100n * PRICE_PER_TOKEN;
    await marketplace.connect(buyer).buyListing(listingId, 100, { value: cost });

    expect(await token.balanceOf(other.address, TOKEN_ID)).to.equal(1);
  });

  it("never charges a fee on the first purchase, since that only ever happens via releaseFromPool", async function () {
    const { token, buyer } = await deployFixture();
    // releaseFromPool (the only path for a first purchase) has no fee concept at all.
    await token.releaseFromPool(buyer.address, TOKEN_ID, 300);
    expect(await token.balanceOf(buyer.address, TOKEN_ID)).to.equal(300);
  });
});
