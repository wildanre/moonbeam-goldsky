import { SwapTokenByPosition as SwapTokenByPositionEvent } from "../generated/templates/Position/Position";

export function handleSwapTokenByPosition(
  event: SwapTokenByPositionEvent
): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);

  // Update user and pool swap totals
  user.totalSwapped = user.totalSwapped.plus(event.params.amountIn);
  user.save();
  pool.totalSwaps = pool.totalSwaps.plus(event.params.amountIn);
  pool.totalSwapNow = pool.totalSwapNow.plus(event.params.amountIn);
  pool.save();
}
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts";

import {
  SupplyLiquidity as SupplyLiquidityEvent,
  WithdrawLiquidity as WithdrawLiquidityEvent,
  BorrowDebtCrosschain as BorrowDebtCrosschainEvent,
  RepayByPosition as RepayByPositionEvent,
  SupplyCollateral as SupplyCollateralEvent,
  CreatePosition as CreatePositionEvent,
  InterestRateModelSet as InterestRateModelSetEvent,
} from "../generated/templates/LendingPool/LendingPool";

import { LendingPoolCreated as LendingPoolCreatedEvent } from "../generated/LendingPoolFactory/LendingPoolFactory";

import {
  LendingPool,
  LendingPoolFactory,
  User,
  LendingPoolCreated,
  SupplyLiquidity,
  WithdrawLiquidity,
  BorrowDebtCrosschain,
  RepayWithCollateralByPosition,
  SupplyCollateral,
  CreatePosition,
  UserPosition,
  PoolAPYSnapshot,
} from "../generated/schema";

import {
  LendingPool as LendingPoolTemplate,
  Position as PositionTemplate,
} from "../generated/templates";

import {
  handlePortoSupplyLiquidity,
  handlePortoWithdrawLiquidity,
  handlePortoSupplyCollateral,
  handlePortoWithdrawCollateral,
  handlePortoBorrow,
  handlePortoRepay,
  handlePortoPoolCreated,
} from "./porto-calculate";

function createEventID(event: ethereum.Event): string {
  return event.block.number
    .toString()
    .concat("-")
    .concat(event.logIndex.toString());
}

function getOrCreateFactory(factoryAddress: Address): LendingPoolFactory {
  let factory = LendingPoolFactory.load(factoryAddress.toHexString());
  if (factory == null) {
    factory = new LendingPoolFactory(factoryAddress.toHexString());
    factory.address = factoryAddress;
    factory.totalPoolsCreated = BigInt.fromI32(0);
    factory.created = BigInt.fromI32(0);
  }
  return factory as LendingPoolFactory;
}

function getOrCreateUser(userAddress: Address): User {
  let user = User.load(userAddress.toHexString());
  if (user == null) {
    user = new User(userAddress.toHexString());
    user.address = userAddress;
    user.totalDeposited = BigInt.fromI32(0);
    user.totalWithdrawn = BigInt.fromI32(0);
    user.totalBorrowed = BigInt.fromI32(0);
    user.totalRepaid = BigInt.fromI32(0);
    user.totalSwapped = BigInt.fromI32(0);
    user.totalDepositNow = BigInt.fromI32(0);
    user.totalWithdrawalNow = BigInt.fromI32(0);
    user.totalBorrowNow = BigInt.fromI32(0);
    user.totalRepayNow = BigInt.fromI32(0);
    user.totalSwapNow = BigInt.fromI32(0);
  }
  return user as User;
}

function getOrCreatePool(poolAddress: Address): LendingPool {
  let pool = LendingPool.load(poolAddress.toHexString());
  if (pool == null) {
    // Get or create factory first - use a default factory address
    // In production, this should be the actual factory address from the event
    let defaultFactoryAddress = Address.fromString("0x0000000000000000000000000000000000000000");
    let factory = getOrCreateFactory(defaultFactoryAddress);
    
    pool = new LendingPool(poolAddress.toHexString());
    pool.address = poolAddress;
    pool.factory = factory.id; // ✅ Set required factory field
    // Initialize token fields with default values (will be set properly in handleLendingPoolCreated)
    pool.token0 = Address.fromString("0x0000000000000000000000000000000000000000");
    pool.token1 = Address.fromString("0x0000000000000000000000000000000000000000");
    pool.totalDeposits = BigInt.fromI32(0);
    pool.totalWithdrawals = BigInt.fromI32(0);
    pool.totalBorrows = BigInt.fromI32(0);
    pool.totalRepays = BigInt.fromI32(0);
    pool.totalSwaps = BigInt.fromI32(0);
    pool.totalDepositNow = BigInt.fromI32(0);
    pool.totalWithdrawalNow = BigInt.fromI32(0);
    pool.totalBorrowNow = BigInt.fromI32(0);
    pool.totalRepayNow = BigInt.fromI32(0);
    pool.totalSwapNow = BigInt.fromI32(0);
    // APY tracking fields
    pool.totalSupplyAssets = BigInt.fromI32(0);
    pool.totalSupplyShares = BigInt.fromI32(0);
    pool.totalLiquidity = BigInt.fromI32(0);
    pool.totalBorrowAssets = BigInt.fromI32(0);
    pool.totalBorrowShares = BigInt.fromI32(0);
    pool.utilizationRate = 0;
    pool.supplyAPY = 0;
    pool.borrowAPY = 0;
    pool.supplyRate = 0;
    pool.borrowRate = 0;
    pool.lastAccrued = BigInt.fromI32(0);
    pool.created = BigInt.fromI32(0);
    // pool.lastUpdated and pool.blockNumber don't exist in schema
    pool.save();
  }
  return pool as LendingPool;
}

function getOrCreateUserPosition(
  userId: string,
  poolId: string,
  positionAddress: Address,
  timestamp: BigInt
): UserPosition {
  let positionId = userId + "-" + poolId;
  let userPosition = UserPosition.load(positionId);
  if (userPosition == null) {
    userPosition = new UserPosition(positionId);
    userPosition.user = userId;
    userPosition.pool = poolId;
    userPosition.positionAddress = positionAddress;
    userPosition.isActive = true;
    userPosition.createdAt = timestamp;
    userPosition.lastUpdated = timestamp;
  }
  return userPosition as UserPosition;
}

//apy calculation
function calculateUtilizationRate(
  totalSupplyAssets: BigInt,
  totalBorrowAssets: BigInt
): BigInt {
  if (totalSupplyAssets.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0);
  }
  // utilizationRate = (totalBorrowAssets / totalSupplyAssets) * 10000 (basis points)
  let utilization = totalBorrowAssets
    .times(BigInt.fromI32(10000))
    .div(totalSupplyAssets);
  return utilization;
}

function calculateSupplyAPY(
  utilizationRate: BigInt,
  borrowAPY: BigInt
): BigInt {
  // Simple model: supplyAPY = utilizationRate * borrowAPY / 10000
  // This assumes 100% of borrow interest goes to suppliers (minus protocol fees)
  return utilizationRate.times(borrowAPY).div(BigInt.fromI32(10000));
}

function calculateBorrowAPY(utilizationRate: BigInt): BigInt {
  // Simple interest rate model: borrowAPY increases with utilization
  // Base rate: 2% (200 basis points)
  // Slope: 18% at 100% utilization (1800 basis points)
  let baseRate = BigInt.fromI32(200); // 2%
  let slope = BigInt.fromI32(1800); // 18%

  // borrowAPY = baseRate + (utilizationRate * slope / 10000)
  return baseRate.plus(utilizationRate.times(slope).div(BigInt.fromI32(10000)));
}

function updatePoolAPY(
  pool: LendingPool,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Calculate utilization rate
  let utilizationRate = calculateUtilizationRate(
    pool.totalSupplyAssets,
    pool.totalBorrowAssets
  );

  // Calculate borrow APY based on utilization
  let borrowAPY = calculateBorrowAPY(utilizationRate);

  // Calculate supply APY based on utilization and borrow APY
  let supplyAPY = calculateSupplyAPY(utilizationRate, borrowAPY);

  // Update pool fields
  pool.utilizationRate = utilizationRate.toI32();
  pool.borrowAPY = borrowAPY.toI32();
  pool.supplyAPY = supplyAPY.toI32();
  pool.lastAccrued = timestamp;

  // Calculate liquidity
  pool.totalLiquidity = pool.totalSupplyAssets.minus(pool.totalBorrowAssets);

  // Create APY snapshot
  let snapshotId = pool.id + "-" + timestamp.toString();
  let snapshot = new PoolAPYSnapshot(snapshotId);
  snapshot.pool = pool.id;
  snapshot.supplyAPY = supplyAPY.toI32();
  snapshot.borrowAPY = borrowAPY.toI32();
  snapshot.utilizationRate = utilizationRate.toI32();
  snapshot.totalSupplyAssets = pool.totalSupplyAssets;
  snapshot.totalBorrowAssets = pool.totalBorrowAssets;
  snapshot.timestamp = timestamp;
  snapshot.blockNumber = blockNumber;
  snapshot.save();

  pool.save();
}

// ========================================
// FACTORY EVENT HANDLERS
// ========================================

export function handlePoolCreated(event: LendingPoolCreatedEvent): void {
  let factory = getOrCreateFactory(event.address);
  let pool = getOrCreatePool(event.params.lendingPool);
  let poolCreated = new LendingPoolCreated(createEventID(event));

  factory.totalPoolsCreated = factory.totalPoolsCreated.plus(BigInt.fromI32(1));
  factory.save();

  pool.factory = factory.id;
  pool.token0 = event.params.collateralToken;
  pool.token1 = event.params.borrowToken;
  pool.created = event.block.timestamp;
  pool.save();

  poolCreated.lendingPool = event.params.lendingPool;
  poolCreated.collateralToken = event.params.collateralToken;
  poolCreated.borrowToken = event.params.borrowToken;
  poolCreated.ltv = event.params.ltv;
  poolCreated.timestamp = event.block.timestamp;
  poolCreated.blockNumber = event.block.number;
  poolCreated.transactionHash = event.transaction.hash;
  poolCreated.save();

  // Update Porto for both tokens
  handlePortoPoolCreated(
    event.params.collateralToken,
    event.params.borrowToken,
    event.block.timestamp,
    event.block.number
  );

  // Create new LendingPool template instance for dynamic pool tracking
  LendingPoolTemplate.create(event.params.lendingPool);
}

// ========================================
// POOL EVENT HANDLERS
// ========================================

export function handleSupplyLiquidity(event: SupplyLiquidityEvent): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let supplyLiquidity = new SupplyLiquidity(createEventID(event));

  // Update user totals
user.totalDeposited = user.totalDeposited.plus(event.params.amount);
user.totalDepositNow = user.totalDepositNow.plus(event.params.amount);
user.save();

  // Update pool totals
  pool.totalDeposits = pool.totalDeposits.plus(event.params.amount);
  pool.totalSupplyAssets = pool.totalSupplyAssets.plus(event.params.amount);
  pool.totalSupplyShares = pool.totalSupplyShares.plus(event.params.shares);
  pool.totalDepositNow = pool.totalDepositNow.plus(event.params.amount);

  // Update APY calculations
  updatePoolAPY(pool, event.block.timestamp, event.block.number);

  // Update Porto for liquidity supply (token1 - borrow token)
  // Supply Liquidity = menyupply asset yang akan dipinjamkan = token1
  handlePortoSupplyLiquidity(
    pool.token1,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Create event record
  supplyLiquidity.user = user.id;
  supplyLiquidity.pool = pool.id;
  supplyLiquidity.asset = pool.token1; // Use borrow token as asset for supply liquidity
  supplyLiquidity.amount = event.params.amount;
  supplyLiquidity.shares = event.params.shares;
  supplyLiquidity.onBehalfOf = event.params.user; // Since event only has user param, use same user
  supplyLiquidity.timestamp = event.block.timestamp;
  supplyLiquidity.blockNumber = event.block.number;
  supplyLiquidity.transactionHash = event.transaction.hash;
  supplyLiquidity.save();

  user.totalDeposited = user.totalDeposited.plus(event.params.amount);
  user.totalDepositNow = user.totalDepositNow.plus(event.params.amount);
  user.save();
}

export function handleWithdrawLiquidity(event: WithdrawLiquidityEvent): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let withdrawLiquidity = new WithdrawLiquidity(createEventID(event));

  // Update user totals
user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
user.totalWithdrawalNow = user.totalWithdrawalNow.plus(event.params.amount);
user.totalDepositNow = user.totalDepositNow.minus(event.params.amount);
user.save();

  // Update pool totals
  pool.totalWithdrawals = pool.totalWithdrawals.plus(event.params.amount);
  pool.totalSupplyAssets = pool.totalSupplyAssets.minus(event.params.amount);
  pool.totalSupplyShares = pool.totalSupplyShares.minus(event.params.shares);
  pool.totalWithdrawalNow = pool.totalWithdrawalNow.plus(event.params.amount);
  pool.totalDepositNow = pool.totalDepositNow.minus(event.params.amount);

  // Update APY calculations
  updatePoolAPY(pool, event.block.timestamp, event.block.number);

  // Update Porto for liquidity withdrawal (token1 - borrow token)
  // Withdraw Liquidity = withdraw asset yang dipinjamkan = token1
  handlePortoWithdrawLiquidity(
    pool.token1,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Create event record
  withdrawLiquidity.user = user.id;
  withdrawLiquidity.pool = pool.id;
  withdrawLiquidity.asset = pool.token1; // Use borrow token as asset for withdraw liquidity
  withdrawLiquidity.amount = event.params.amount;
  withdrawLiquidity.shares = event.params.shares;
  withdrawLiquidity.to = event.params.user; // Since event only has user param, use same user
  withdrawLiquidity.timestamp = event.block.timestamp;
  withdrawLiquidity.blockNumber = event.block.number;
  withdrawLiquidity.transactionHash = event.transaction.hash;
  withdrawLiquidity.save();

  user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
  user.totalWithdrawalNow = user.totalWithdrawalNow.plus(event.params.amount);
  user.totalDepositNow = user.totalDepositNow.minus(event.params.amount);
  user.save();
}

export function handleBorrowDebtCrosschain(
  event: BorrowDebtCrosschainEvent
): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let borrowDebtCrosschain = new BorrowDebtCrosschain(createEventID(event));

user.totalBorrowed = user.totalBorrowed.plus(event.params.amount);
user.totalBorrowNow = user.totalBorrowNow.plus(event.params.amount);
user.save();

  // Update pool totals
  pool.totalBorrows = pool.totalBorrows.plus(event.params.amount);
  pool.totalBorrowAssets = pool.totalBorrowAssets.plus(event.params.amount);
  pool.totalBorrowShares = pool.totalBorrowShares.plus(event.params.shares);
  pool.totalBorrowNow = pool.totalBorrowNow.plus(event.params.amount);

  // Update APY calculations
  updatePoolAPY(pool, event.block.timestamp, event.block.number);

  // Update Porto for borrow (token1 - borrow token)
  handlePortoBorrow(
    pool.token1,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Create event record
  borrowDebtCrosschain.user = user.id;
  borrowDebtCrosschain.pool = pool.id;
  borrowDebtCrosschain.asset = pool.token1; // Use borrow token as asset for borrow
  borrowDebtCrosschain.amount = event.params.amount;
  borrowDebtCrosschain.shares = event.params.shares;
  borrowDebtCrosschain.chainId = event.params.chainId;
  borrowDebtCrosschain.addExecutorLzReceiveOption =
    event.params.addExecutorLzReceiveOption;
  borrowDebtCrosschain.onBehalfOf = event.params.user; // Since event only has user param, use same user
  borrowDebtCrosschain.timestamp = event.block.timestamp;
  borrowDebtCrosschain.blockNumber = event.block.number;
  borrowDebtCrosschain.transactionHash = event.transaction.hash;
  borrowDebtCrosschain.save();
}

export function handleRepayByPosition(event: RepayByPositionEvent): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let repayByPosition = new RepayWithCollateralByPosition(createEventID(event));

  // Update user totals
user.totalRepaid = user.totalRepaid.plus(event.params.amount);
user.totalRepayNow = user.totalRepayNow.plus(event.params.amount);
user.totalBorrowNow = user.totalBorrowNow.minus(event.params.amount);
user.save();

  // Update pool totals
  pool.totalRepays = pool.totalRepays.plus(event.params.amount);
  pool.totalBorrowAssets = pool.totalBorrowAssets.minus(event.params.amount);
  pool.totalBorrowShares = pool.totalBorrowShares.minus(event.params.shares);
  pool.totalRepayNow = pool.totalRepayNow.plus(event.params.amount);
  pool.totalBorrowNow = pool.totalBorrowNow.minus(event.params.amount);

  // Update APY calculations
  updatePoolAPY(pool, event.block.timestamp, event.block.number);

  // Update Porto for repay (token1 - borrow token)
  // Borrow amount berkurang
  handlePortoRepay(
    pool.token1,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Update Porto for collateral used (token0 - collateral token)
  // Karena ini RepayWithCollateralByPosition, collateral digunakan untuk repay
  // Collateral berkurang sejumlah amount yang di-repay
  handlePortoWithdrawCollateral(
    pool.token0,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Create event record
  repayByPosition.user = user.id;
  repayByPosition.pool = pool.id;
  repayByPosition.asset = pool.token1; // Use borrow token as asset for repay
  repayByPosition.amount = event.params.amount;
  repayByPosition.shares = event.params.shares;
  repayByPosition.repayer = event.params.user; // Since event only has user param, use same user
  repayByPosition.timestamp = event.block.timestamp;
  repayByPosition.blockNumber = event.block.number;
  repayByPosition.transactionHash = event.transaction.hash;
  repayByPosition.save();
}

export function handleSupplyCollateral(event: SupplyCollateralEvent): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let supplyCollateral = new SupplyCollateral(createEventID(event));

  // Update Porto for collateral supply (token0 - collateral token)
  handlePortoSupplyCollateral(
    pool.token0,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Create event record
  supplyCollateral.user = user.id;
  supplyCollateral.pool = pool.id;
  supplyCollateral.asset = pool.token0; // Use collateral token as asset
  supplyCollateral.amount = event.params.amount;
  supplyCollateral.onBehalfOf = event.params.user; // Since event only has user param, use same user
  supplyCollateral.timestamp = event.block.timestamp;
  supplyCollateral.blockNumber = event.block.number;
  supplyCollateral.transactionHash = event.transaction.hash;
  supplyCollateral.save();
}

export function handleCreatePosition(event: CreatePositionEvent): void {
  let pool = getOrCreatePool(event.address);
  let user = getOrCreateUser(event.params.user);
  let createPosition = new CreatePosition(createEventID(event));

  // Create or update user position tracking
  let userPosition = getOrCreateUserPosition(
    user.id,
    pool.id,
    event.params.positionAddress,
    event.block.timestamp
  );
  userPosition.lastUpdated = event.block.timestamp;
  userPosition.save();

  // Create event record
  createPosition.user = user.id;
  createPosition.pool = pool.id;
  createPosition.positionAddress = event.params.positionAddress;
  createPosition.timestamp = event.block.timestamp;
  createPosition.blockNumber = event.block.number;
  createPosition.transactionHash = event.transaction.hash;
  createPosition.save();

  // Create new Position template instance for dynamic position tracking
  PositionTemplate.create(event.params.positionAddress);
}

export function handleInterestRateModelSet(
  event: InterestRateModelSetEvent
): void {
  let pool = getOrCreatePool(event.address);

  // Update pool with new interest rate model - assuming these are the indexed addresses
  // pool.interestRateModel = event.params.newModel; // Uncomment if schema has this field
  pool.save();

  // Note: InterestRateModelSet has indexed addresses but we'll need to check ABI for exact parameter names
}
