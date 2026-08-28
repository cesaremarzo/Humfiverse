const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseCatalogueToken", function () {
  const MIDNIGHT_STATIC_ID = 1;
  const MIDNIGHT_STATIC_SUPPLY = 4000;

  async function deployFixture() {
    const [owner, buyer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await Factory.deploy();
    await token.waitForDeployment();
    return { token, owner, buyer, other };
  }

  it("mints the full catalogue supply into the contract's own pool", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY);

    expect(await token.totalSupplyOf(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
    expect(await token.catalogueSlug(MIDNIGHT_STATIC_ID)).to.equal("midnight-static");
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
  });

  it("emits CatalogueMinted on mint", async function () {
    const { token } = await deployFixture();
    await expect(token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY))
      .to.emit(token, "CatalogueMinted")
      .withArgs(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY);
  });

  it("refuses to mint the same token id twice", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY);
    await expect(
      token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 100)
    ).to.be.revertedWith("HumfiverseCatalogueToken: already minted");
  });

  it("only the owner can mint", async function () {
    const { token, other } = await deployFixture();
    await expect(
      token.connect(other).mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY)
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("releases tokens from the pool to a buyer and tracks released/pool balances", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY);

    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40))
      .to.emit(token, "TokensReleased")
      .withArgs(MIDNIGHT_STATIC_ID, buyer.address, 40);

    expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY - 40);
  });

  it("refuses to release more than the remaining supply", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 100);
    await token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 60);

    await expect(
      token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 41)
    ).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");

    // exactly the remainder still works
    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40)).to.not.be.reverted;
  });

  it("only the owner can release from the pool", async function () {
    const { token, buyer, other } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY);
    await expect(
      token.connect(other).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 10)
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("supports minting and releasing multiple independent catalogues", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(1, "midnight-static", 4000);
    await token.mintCatalogue(2, "ember-choir", 2500);

    await token.releaseFromPool(buyer.address, 1, 40);
    await token.releaseFromPool(buyer.address, 2, 12);

    expect(await token.balanceOf(buyer.address, 1)).to.equal(40);
    expect(await token.balanceOf(buyer.address, 2)).to.equal(12);
    expect(await token.poolBalance(1)).to.equal(3960);
    expect(await token.poolBalance(2)).to.equal(2488);
  });
});
