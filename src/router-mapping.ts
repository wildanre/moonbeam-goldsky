import {
  ethereum, BigInt, Address
} from '@graphprotocol/graph-ts'

import {
  PoolRouter,
  EmergencyPositionReset,
  PositionLiquidated,
  User,
} from '../generated/schema'

function createEventID(event: ethereum.Event): string {
  return event.block.number.toString().concat('-').concat(event.logIndex.toString());
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
  }
  return user as User;
}

// Router event handlers will be added here when Router ABI events are available
// These are placeholders based on the schema

/*
export function handleEmergencyPositionReset(event: EmergencyPositionResetEvent): void {
  let user = getOrCreateUser(event.params.user);
  let emergencyPositionReset = new EmergencyPositionReset(createEventID(event));
  
  emergencyPositionReset.user = user.id;
  emergencyPositionReset.router = event.address;
  emergencyPositionReset.timestamp = event.block.timestamp;
  emergencyPositionReset.blockNumber = event.block.number;
  emergencyPositionReset.transactionHash = event.transaction.hash;
  emergencyPositionReset.save();
}

export function handlePositionLiquidated(event: PositionLiquidatedEvent): void {
  let user = getOrCreateUser(event.params.user);
  let positionLiquidated = new PositionLiquidated(createEventID(event));
  
  positionLiquidated.user = user.id;
  positionLiquidated.router = event.address;
  positionLiquidated.sharesRemoved = event.params.sharesRemoved;
  positionLiquidated.debtRepaid = event.params.debtRepaid;
  positionLiquidated.timestamp = event.block.timestamp;
  positionLiquidated.blockNumber = event.block.number;
  positionLiquidated.transactionHash = event.transaction.hash;
  positionLiquidated.save();
}
*/