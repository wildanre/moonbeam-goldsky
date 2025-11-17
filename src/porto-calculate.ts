import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import { Porto, PortoSnapshot, LendingPool } from "../generated/schema";

// TOKEN ADDRESS CONSTANTS

const MOCK_USDC = "0xb2FeaAC5202a3653fDA3f546C7c2b1F3958298E6";
const MOCK_USDT = "0x3De8C22F6b84C575429c1B9cbf5bdDd49cf129fC";
const MOCK_WETH = "0x0ca57c18b53DbC15D46B55B73d52ce6AdCb6B060";
const MOCK_WGLMR = "0x69f49486D06FC3206060B10B433a26cDb8160479";


const USDC = "0xFFfffffF7D2B0B761Af01Ca8e25242976ac0aD7D";
const USDT = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
const ETH = "0x0000000000000000000000000000000000000001";
const WETH = "0xFFffFFfF86829AFE1521ad2296719Df3acE8DEd7";
const WBTC = "0xfFffFFFf1B4Bb1ac5749F73D866FfC91a3432c47";
const WGLMR = "0xAcc15dC74880C9944775448304B263D191c6077F";


// TOKEN NORMALIZATION & SYMBOL MAPPING

export function normalizeTokenAddress(tokenAddress: Bytes): string {
  let addressLower = tokenAddress.toHexString().toLowerCase();

  // Normalize USDC (Mock USDC -> Real USDC)
  if (addressLower == MOCK_USDC) {
    return USDC;
  }

  // Normalize USDT (Mock USDT -> Real USDT)
  if (addressLower == MOCK_USDT) {
    return USDT;
  }

  // Normalize WETH (Mock WETH -> Real WETH)
  if (addressLower == MOCK_WETH) {
    return WETH;
  }

  // Normalize WGLMR (Mock WGLMR -> Real WGLMR)
  if (addressLower == MOCK_WGLMR) {
    return WGLMR;
  }

  // ETH normalization (ETH -> WETH for consistency)
  if (addressLower == ETH) {
    return WETH;
  }

  // Return original address for non-mock tokens
  return addressLower;
}

/**
 * Gets the token symbol based on normalized address
 */
export function getTokenSymbol(normalizedAddress: string): string {
  if (normalizedAddress == USDC) {
    return "USDC";
  }
  if (normalizedAddress == USDT) {
    return "USDT";
  }
  if (normalizedAddress == WETH) {
    return "WETH";
  }
  if (normalizedAddress == WBTC) {
    return "WBTC";
  }
  if (normalizedAddress == WGLMR) {
    return "WGLMR";
  }
  return "UNKNOWN";
}

// PORTO ENTITY MANAGEMENT

export function getOrCreatePorto(
  tokenAddress: Bytes,
  timestamp: BigInt,
  blockNumber: BigInt
): Porto {
  let normalizedAddress = normalizeTokenAddress(tokenAddress);
  let porto = Porto.load(normalizedAddress);

  if (porto == null) {
    porto = new Porto(normalizedAddress);
    porto.tokenAddress = Bytes.fromHexString(normalizedAddress);
    porto.tokenSymbol = getTokenSymbol(normalizedAddress);
    
    // Current balances (can increase and decrease)
    porto.tvl = BigInt.fromI32(0);
    porto.totalCollateralNow = BigInt.fromI32(0);
    porto.totalLiquidityNow = BigInt.fromI32(0);
    porto.totalBorrowNow = BigInt.fromI32(0);
    
    // Cumulative totals (only increase)
    porto.totalCollateralAll = BigInt.fromI32(0);
    porto.totalLiquidityAll = BigInt.fromI32(0);
    porto.totalBorrowAll = BigInt.fromI32(0);
    
    porto.poolCount = BigInt.fromI32(0);
    porto.lastUpdated = timestamp;
    porto.blockNumber = blockNumber;
    porto.save();
  }

  return porto as Porto;
}

// PORTO CALCULATION FUNCTIONS

export function recalculatePortoForToken(
  tokenAddress: Bytes,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  let normalizedAddress = normalizeTokenAddress(tokenAddress);

  // Reset totals
  let totalCollateral = BigInt.fromI32(0);
  let totalLiquidity = BigInt.fromI32(0);
  let totalBorrow = BigInt.fromI32(0);
  let poolCount = BigInt.fromI32(0);

  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  porto.save();

  // Create snapshot
  createPortoSnapshot(porto, timestamp, blockNumber);
}

export function updatePortoMetrics(
  pool: LendingPool,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  updatePortoForToken(
    pool.token0,
    pool,
    true,
    timestamp,
    blockNumber
  );

  updatePortoForToken(
    pool.token1,
    pool,
    false,
    timestamp,
    blockNumber
  );
}

function updatePortoForToken(
  tokenAddress: Bytes,
  pool: LendingPool,
  isCollateralToken: boolean,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);


  if (isCollateralToken) {
  } else {

  }

  porto.tvl = porto.totalLiquidityAll.plus(porto.totalCollateralAll);

  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  porto.save();

  // Create snapshot for historical tracking
  createPortoSnapshot(porto, timestamp, blockNumber);
}

function createPortoSnapshot(
  porto: Porto,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let snapshotId = porto.id + "-" + timestamp.toString();
  let snapshot = new PortoSnapshot(snapshotId);

  snapshot.porto = porto.id;
  snapshot.tvl = porto.tvl;
  
  // Current balances
  snapshot.totalCollateralNow = porto.totalCollateralNow;
  snapshot.totalLiquidityNow = porto.totalLiquidityNow;
  snapshot.totalBorrowNow = porto.totalBorrowNow;
  
  // Cumulative totals
  snapshot.totalCollateralAll = porto.totalCollateralAll;
  snapshot.totalLiquidityAll = porto.totalLiquidityAll;
  snapshot.totalBorrowAll = porto.totalBorrowAll;
  
  snapshot.timestamp = timestamp;
  snapshot.blockNumber = blockNumber;

  snapshot.save();
}

// HELPER FUNCTIONS FOR EVENT HANDLERS

/**
 * Updates Porto when liquidity is supplied to a pool
 */
export function handlePortoSupplyLiquidity(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update current balance (increase)
  porto.totalLiquidityNow = porto.totalLiquidityNow.plus(amount);
  
  // Update cumulative total (only increase)
  porto.totalLiquidityAll = porto.totalLiquidityAll.plus(amount);
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto when liquidity is withdrawn from a pool
 */
export function handlePortoWithdrawLiquidity(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update current balance (decrease)
  porto.totalLiquidityNow = porto.totalLiquidityNow.minus(amount);
  
  // Cumulative total doesn't change on withdrawal
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto when collateral is supplied
 */
export function handlePortoSupplyCollateral(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update current balance (increase)
  porto.totalCollateralNow = porto.totalCollateralNow.plus(amount);
  
  // Update cumulative total (only increase)
  porto.totalCollateralAll = porto.totalCollateralAll.plus(amount);
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto when collateral is withdrawn
 */
export function handlePortoWithdrawCollateral(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update current balance (decrease)
  porto.totalCollateralNow = porto.totalCollateralNow.minus(amount);
  
  // Cumulative total doesn't change on withdrawal
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto when a borrow occurs
 */
export function handlePortoBorrow(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update borrow balance (increase)
  porto.totalBorrowNow = porto.totalBorrowNow.plus(amount);
  
  // Update cumulative borrow total (only increase)
  porto.totalBorrowAll = porto.totalBorrowAll.plus(amount);
  
  // IMPORTANT: When borrow occurs, available liquidity decreases
  // totalLiquidityNow represents available liquidity, so it must decrease
  porto.totalLiquidityNow = porto.totalLiquidityNow.minus(amount);
  
  // Recalculate TVL (TVL doesn't change when borrowing from liquidity)
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto when a repay occurs
 */
export function handlePortoRepay(
  tokenAddress: Bytes,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);
  
  // Update borrow balance (decrease)
  porto.totalBorrowNow = porto.totalBorrowNow.minus(amount);
  
  porto.totalLiquidityNow = porto.totalLiquidityNow.plus(amount);
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  // Cumulative total doesn't change on repay
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}


export function handlePortoPoolCreated(
  token0: Bytes,
  token1: Bytes,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Update pool count for token0
  let porto0 = getOrCreatePorto(token0, timestamp, blockNumber);
  porto0.poolCount = porto0.poolCount.plus(BigInt.fromI32(1));
  porto0.lastUpdated = timestamp;
  porto0.blockNumber = blockNumber;
  porto0.save();

  // Update pool count for token1
  let porto1 = getOrCreatePorto(token1, timestamp, blockNumber);
  porto1.poolCount = porto1.poolCount.plus(BigInt.fromI32(1));
  porto1.lastUpdated = timestamp;
  porto1.blockNumber = blockNumber;
  porto1.save();
}

