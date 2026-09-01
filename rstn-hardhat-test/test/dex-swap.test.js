const { expect } = require("chai");
const hre = require("hardhat");

describe("RstnDexPool — swap end-to-end (price birth)", function () {
  let wrstn, quote, factory, pool, deployer, lp, trader;

  before(async function () {
    [deployer, lp, trader] = await hre.ethers.getSigners();

    // Deploy WRSTN
    const WRSTN = await hre.ethers.getContractFactory("WRSTN");
    wrstn = await WRSTN.deploy();

    // Deploy quote token (USDC-like, 6 decimals)
    const Quote = await hre.ethers.getContractFactory("ERC20Mock");
    quote = await Quote.deploy("USDC Mock", "USDC", 6);

    // Deploy factory
    const Factory = await hre.ethers.getContractFactory("RstnDexFactory");
    factory = await Factory.deploy();

    // Create canonical pool wRSTN / USDC
    const tx = await factory.createPool(await wrstn.getAddress(), await quote.getAddress());
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "PoolCreated");
    const poolAddr = ev.args.pool;
    pool = await hre.ethers.getContractAt("RstnDexPool", poolAddr);
  });

  it("first LP seeds liquidity and sets initial price", async function () {
    // LP deposits 1_000_000 wRSTN (9 dec) + 100_000 USDC (6 dec) → price 0.1 USDC per wRSTN
    const wrstnAmt = hre.ethers.parseUnits("1000000", 9);
    const usdcAmt = hre.ethers.parseUnits("100000", 6);

    // fund LP
    await wrstn.connect(deployer).deposit({ value: wrstnAmt });
    await wrstn.transfer(lp.address, wrstnAmt);
    await quote.mint(lp.address, usdcAmt);

    // approve pool
    await wrstn.connect(lp).approve(await pool.getAddress(), wrstnAmt);
    await quote.connect(lp).approve(await pool.getAddress(), usdcAmt);

    // transfer in then mint (Uniswap V2 pattern)
    await wrstn.connect(lp).transfer(await pool.getAddress(), wrstnAmt);
    await quote.connect(lp).transfer(await pool.getAddress(), usdcAmt);
    await pool.connect(lp).mint(lp.address);

    const r0 = await pool.reserve0();
    const r1 = await pool.reserve1();
    expect(r0).to.equal(wrstnAmt);
    expect(r1).to.equal(usdcAmt);
  });

  it("first swap executes and moves the price (price is born)", async function () {
    // Trader buys wRSTN with 1_000 USDC
    const usdcIn = hre.ethers.parseUnits("1000", 6);
    await quote.mint(trader.address, usdcIn);
    await quote.connect(trader).approve(await pool.getAddress(), usdcIn);
    await quote.connect(trader).transfer(await pool.getAddress(), usdcIn);

    const r0Before = await pool.reserve0();
    const r1Before = await pool.reserve1();
    const expectedOut = await pool.getAmountOut(usdcIn, r1Before, r0Before);

    // swap: token1 (USDC) in, token0 (wRSTN) out
    await pool.connect(trader).swap(expectedOut, 0, trader.address);

    const r0After = await pool.reserve0();
    const r1After = await pool.reserve1();

    // wRSTN reserve decreased (bought), USDC reserve increased (sold)
    expect(r0After).to.be.lessThan(r0Before);
    expect(r1After).to.be.greaterThan(r1Before);

    // trader received wRSTN
    expect(await wrstn.balanceOf(trader.address)).to.equal(expectedOut);
  });
});
