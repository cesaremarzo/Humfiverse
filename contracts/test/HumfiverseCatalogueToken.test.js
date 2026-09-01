const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HumfiverseCatalogueToken", function () {
  const MIDNIGHT_STATIC_ID = 1;
  const MIDNIGHT_STATIC_SUPPLY = 4000;
  const PRICE_PER_TOKEN = ethers.parseEther("0.0025");

  async function deployFixture() {
    const [owner, buyer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HumfiverseCatalogueToken");
    const token = await Factory.deploy();
    await token.waitForDeployment();
    return { token, owner, buyer, other };
  }

  it("mints the full catalogue supply into the contract's own pool, at the given price", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");

    expect(await token.totalSupplyOf(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
    expect(await token.catalogueSlug(MIDNIGHT_STATIC_ID)).to.equal("midnight-static");
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY);
    expect(await token.pricePerToken(MIDNIGHT_STATIC_ID)).to.equal(PRICE_PER_TOKEN);
    expect(await token.trackTitle(MIDNIGHT_STATIC_ID)).to.equal("Test Track");
    expect(await token.artistName(MIDNIGHT_STATIC_ID)).to.equal("Test Artist");
  });

  it("emits CatalogueMinted on mint", async function () {
    const { token } = await deployFixture();
    await expect(token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist"))
      .to.emit(token, "CatalogueMinted")
      .withArgs(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
  });

  it("refuses to mint the same token id twice", async function () {
    const { token } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
    await expect(
      token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 100, PRICE_PER_TOKEN, "Test Track", "Test Artist")
    ).to.be.revertedWith("HumfiverseCatalogueToken: already minted");
  });

  it("only the owner can mint", async function () {
    const { token, other } = await deployFixture();
    await expect(
      token.connect(other).mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist")
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("releases tokens from the pool to a buyer and tracks released/pool balances", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");

    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40))
      .to.emit(token, "TokensReleased")
      .withArgs(MIDNIGHT_STATIC_ID, buyer.address, 40);

    expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(40);
    expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(MIDNIGHT_STATIC_SUPPLY - 40);
  });

  it("refuses to release more than the remaining supply", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 100, PRICE_PER_TOKEN, "Test Track", "Test Artist");
    await token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 60);

    await expect(
      token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 41)
    ).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");

    // exactly the remainder still works
    await expect(token.releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 40)).to.not.be.reverted;
  });

  it("only the owner can release from the pool", async function () {
    const { token, buyer, other } = await deployFixture();
    await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
    await expect(
      token.connect(other).releaseFromPool(buyer.address, MIDNIGHT_STATIC_ID, 10)
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("supports minting and releasing multiple independent catalogues", async function () {
    const { token, buyer } = await deployFixture();
    await token.mintCatalogue(1, "midnight-static", 4000, PRICE_PER_TOKEN, "Test Track", "Test Artist");
    await token.mintCatalogue(2, "ember-choir", 2500, ethers.parseEther("0.004"), "Ember Choir", "Sasha Wren");

    await token.releaseFromPool(buyer.address, 1, 40);
    await token.releaseFromPool(buyer.address, 2, 12);

    expect(await token.balanceOf(buyer.address, 1)).to.equal(40);
    expect(await token.balanceOf(buyer.address, 2)).to.equal(12);
    expect(await token.poolBalance(1)).to.equal(3960);
    expect(await token.poolBalance(2)).to.equal(2488);
  });

  describe("buy() — public, paid first-purchase path", function () {
    it("lets anyone buy at the fixed price, paying the payout recipient in full", async function () {
      const { token, owner, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
      const cost = 10n * PRICE_PER_TOKEN;
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 10, { value: cost }))
        .to.emit(token, "TokensPurchased")
        .withArgs(MIDNIGHT_STATIC_ID, buyer.address, 10, cost);

      expect(await token.balanceOf(buyer.address, MIDNIGHT_STATIC_ID)).to.equal(10);
      expect(await token.releasedOf(MIDNIGHT_STATIC_ID)).to.equal(10);
      expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBefore + cost);
    });

    it("refuses to buy a catalogue with no price set", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, 0, "Test Track", "Test Artist");
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1, { value: 1 })
      ).to.be.revertedWith("HumfiverseCatalogueToken: not for sale");
    });

    it("refuses underpayment or overpayment", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
      const correct = 5n * PRICE_PER_TOKEN;
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 5, { value: correct - 1n })
      ).to.be.revertedWith("HumfiverseCatalogueToken: wrong payment");
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 5, { value: correct + 1n })
      ).to.be.revertedWith("HumfiverseCatalogueToken: wrong payment");
    });

    it("refuses to buy more than remains in the pool", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 10, PRICE_PER_TOKEN, "Test Track", "Test Artist");
      const cost = 11n * PRICE_PER_TOKEN;
      await expect(
        token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 11, { value: cost })
      ).to.be.revertedWith("HumfiverseCatalogueToken: exceeds supply");
    });

    it("shares the same pool/released accounting as releaseFromPool", async function () {
      const { token, buyer, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", 100, PRICE_PER_TOKEN, "Test Track", "Test Artist");
      await token.releaseFromPool(other.address, MIDNIGHT_STATIC_ID, 60);
      const cost = 40n * PRICE_PER_TOKEN;
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 41, { value: 41n * PRICE_PER_TOKEN })).to.be.revertedWith(
        "HumfiverseCatalogueToken: exceeds supply"
      );
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 40, { value: cost });
      expect(await token.poolBalance(MIDNIGHT_STATIC_ID)).to.equal(0);
    });
  });

  describe("admin: price and payout recipient", function () {
    it("lets the owner open/close/reprice public sale", async function () {
      const { token, buyer } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, 0, "Test Track", "Test Artist");
      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1, { value: 1 })).to.be.revertedWith(
        "HumfiverseCatalogueToken: not for sale"
      );

      await expect(token.setPrice(MIDNIGHT_STATIC_ID, PRICE_PER_TOKEN))
        .to.emit(token, "PriceUpdated")
        .withArgs(MIDNIGHT_STATIC_ID, 0, PRICE_PER_TOKEN);

      await expect(token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 1, { value: PRICE_PER_TOKEN })).to.not.be.reverted;
    });

    it("only the owner can set price", async function () {
      const { token, other } = await deployFixture();
      await expect(token.connect(other).setPrice(MIDNIGHT_STATIC_ID, PRICE_PER_TOKEN)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("lets the owner redirect payout proceeds", async function () {
      const { token, owner, buyer, other } = await deployFixture();
      await token.mintCatalogue(MIDNIGHT_STATIC_ID, "midnight-static", MIDNIGHT_STATIC_SUPPLY, PRICE_PER_TOKEN, "Test Track", "Test Artist");
      await token.setPayoutRecipient(other.address);
      const otherBalanceBefore = await ethers.provider.getBalance(other.address);

      const cost = 3n * PRICE_PER_TOKEN;
      await token.connect(buyer).buy(MIDNIGHT_STATIC_ID, 3, { value: cost });

      expect(await ethers.provider.getBalance(other.address)).to.equal(otherBalanceBefore + cost);
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
});
