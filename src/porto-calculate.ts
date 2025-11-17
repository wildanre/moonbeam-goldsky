import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import { Porto, PortoSnapshot, LendingPool } from "../generated/schema";

// ========================================
// TOKEN ADDRESS CONSTANTS
// ========================================

// Mock Tokens (Base Sepolia Testnet)
const BASE_MOCK_USDC = "0xd2e0f459a2518b9459b9b11db5aa014f0bf622a7";
const BASE_MOCK_USDT = "0xd61f31154bf292c7be2fd81fac9810f6d93ecc2b";
const BASE_MOCK_WETH = "0x7954270f038bfae7760ccf8d9094745d3e9cf4a3";

// Real Tokens (Base Mainnet)
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_USDT = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";
const BASE_ETH = "0x0000000000000000000000000000000000000001";
const BASE_WETH = "0x4200000000000000000000000000000000000006";
const BASE_WBTC = "0x0555e30da8f98308edb960aa94c0db47230d2b9c";

// ========================================
// TOKEN NORMALIZATION & SYMBOL MAPPING
// ========================================

/**
 * Normalizes token addresses by mapping mock tokens to their real counterparts
 * Mock tokens and real tokens are treated as the same token
 */
export function normalizeTokenAddress(tokenAddress: Bytes): string {
  let addressLower = tokenAddress.toHexString().toLowerCase();

  // Normalize USDC (Mock USDC -> Real USDC)
  if (addressLower == BASE_MOCK_USDC) {
    return BASE_USDC;
  }

  // Normalize USDT (Mock USDT -> Real USDT)
  if (addressLower == BASE_MOCK_USDT) {
    return BASE_USDT;
  }

  // Normalize WETH (Mock WETH -> Real WETH)
  if (addressLower == BASE_MOCK_WETH) {
    return BASE_WETH;
  }

  // ETH normalization (ETH -> WETH for consistency)
  if (addressLower == BASE_ETH) {
    return BASE_WETH;
  }

  // Return original address for non-mock tokens
  return addressLower;
}

/**
 * Gets the token symbol based on normalized address
 */
export function getTokenSymbol(normalizedAddress: string): string {
  if (normalizedAddress == BASE_USDC) {
    return "USDC";
  }
  if (normalizedAddress == BASE_USDT) {
    return "USDT";
  }
  if (normalizedAddress == BASE_WETH) {
    return "WETH";
  }
  if (normalizedAddress == BASE_WBTC) {
    return "WBTC";
  }
  return "UNKNOWN";
}

// ========================================
// PORTO ENTITY MANAGEMENT
// ========================================

/**
 * Gets or creates a Porto entity for a given token
 */
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

// ========================================
// PORTO CALCULATION FUNCTIONS
// ========================================

/**
 * Recalculates all Porto metrics for a given token by aggregating across all pools
 */
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

  // Note: Since we can't query all pools directly in AssemblyScript,
  // we'll need to update this incrementally from events
  // This is a placeholder for the calculation logic
  
  // For now, we'll keep the existing values and update them incrementally
  // This function will be called from event handlers to update the totals

  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  porto.save();

  // Create snapshot
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Updates Porto metrics incrementally when pool events occur
 */
export function updatePortoMetrics(
  pool: LendingPool,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Update Porto for token0 (collateral token)
  updatePortoForToken(
    pool.token0,
    pool,
    true, // isCollateralToken
    timestamp,
    blockNumber
  );

  // Update Porto for token1 (borrow token)
  updatePortoForToken(
    pool.token1,
    pool,
    false, // isBorrowToken
    timestamp,
    blockNumber
  );
}

/**
 * Updates Porto for a specific token based on pool data
 */
function updatePortoForToken(
  tokenAddress: Bytes,
  pool: LendingPool,
  isCollateralToken: boolean,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let porto = getOrCreatePorto(tokenAddress, timestamp, blockNumber);

  // This is a simplified calculation
  // In a real scenario, you'd need to track all pools using this token
  // and aggregate their values

  if (isCollateralToken) {
    // For collateral token (token0):
    // - Add to totalLiquidityAll from totalSupplyAssets
    // - Add to totalCollateralAll (needs to be tracked separately in events)
    
    // Note: This is incremental update logic
    // You may need to store pool-specific values and aggregate them
  } else {
    // For borrow token (token1):
    // - Add to totalBorrowAll from totalBorrowAssets
  }

  // Calculate TVL: totalLiquidity + totalCollateral
  porto.tvl = porto.totalLiquidityAll.plus(porto.totalCollateralAll);

  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  porto.save();

  // Create snapshot for historical tracking
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Creates a snapshot of Porto metrics for historical tracking
 */
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

// ========================================
// HELPER FUNCTIONS FOR EVENT HANDLERS
// ========================================

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
  
  // IMPORTANT: When repay occurs, available liquidity increases back
  // totalLiquidityNow represents available liquidity, so it must increase
  porto.totalLiquidityNow = porto.totalLiquidityNow.plus(amount);
  
  // Recalculate TVL
  porto.tvl = porto.totalLiquidityNow.plus(porto.totalCollateralNow);
  
  // Cumulative total doesn't change on repay
  
  porto.lastUpdated = timestamp;
  porto.blockNumber = blockNumber;
  
  porto.save();
  createPortoSnapshot(porto, timestamp, blockNumber);
}

/**
 * Increments the pool count for a token when a new pool is created
 */
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

