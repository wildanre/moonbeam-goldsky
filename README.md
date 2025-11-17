# Lending Pool Subgraph

This subgraph indexes events from the Lending Pool smart contracts on moonbeam. It tracks lending pool creation, liquidity supply/withdrawal, borrowing, repayments, collateral management, and position creation.

## Overview

The subgraph consists of:
- **LendingPoolFactory Contract**: Creates new lending pools
- **LendingPool Contract**: Individual lending pools for different token pairs
- **Event Tracking**: Monitors all lending-related activities

## Smart Contract Details


### Tracked Events

#### LendingPoolFactory Events
- `LendingPoolCreated`: When new lending pools are created

#### LendingPool Events
- `SupplyLiquidity`: User supplies liquidity to the pool
- `WithdrawLiquidity`: User withdraws liquidity from the pool
- `BorrowDebtCrosschain`: User borrows against collateral
- `RepayWithCollateralByPosition`: User repays debt using collateral
- `SupplyCollateral`: User adds collateral to position
- `CreatePosition`: New position is created

## Setup and Deployment

### Prerequisites
```bash
npm install -g @graphprotocol/graph-cli
yarn install
```

### Development
```bash
# Generate types from schema and ABIs
yarn codegen

# Build the subgraph
yarn build
```

### Deployment to Goldsky

1. **Login to Goldsky**
```bash
goldsky login
```

2. **Deploy to Goldsky**
```bash
# Copy schema to build directory
cp schema.graphql build/schema.graphql

# Deploy from build directory
cd build
goldsky subgraph deploy my-subgraph/1.0
```

## Schema Entities

### Core Entities
- **LendingPoolFactory**: Factory contract information
- **LendingPool**: Individual lending pool data
- **User**: User account information and aggregated stats

### Event Entities
- **LendingPoolCreated**: Pool creation events
- **SupplyLiquidity**: Liquidity supply events
- **WithdrawLiquidity**: Liquidity withdrawal events
- **BorrowDebtCrosschain**: Borrowing events
- **RepayWithCollateralByPosition**: Repayment events
- **SupplyCollateral**: Collateral supply events
- **CreatePosition**: Position creation events

## File Structure

```
├── abis/                          # Contract ABIs
│   ├── LendingPool.json
│   └── LendingPoolFactory.json
├── config/                        # Network configurations
│   └── network.json
├── src/                          # Mapping functions
│   └── lending-mapping.ts
├── schema.lending.graphql        # GraphQL schema
├── subgraph.yaml                # Subgraph manifest
└── package.json                 # Dependencies and scripts
```

## GraphQL Queries

### Example Queries

```graphql
# Get all lending pools
{
  lendingPools {
    id
    address
    token0
    token1
    totalDeposits
    totalBorrows
    created
  }
}

# Get user activities
{
  users {
    id
    address
    totalDeposited
    totalBorrowed
    totalWithdrawn
    totalRepaid
  }
}

# Get recent supply liquidity events
{
  supplyLiquidities(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    user {
      address
    }
    amount
    timestamp
    transactionHash
  }
}
```

## Development Notes

### Configuration
- Network settings are defined in `config`
- Contract addresses and start block are configurable
- Schema defines all trackable entities and their relationships

### Mapping Functions
- Event handlers process blockchain events and update entities
- Automatic entity creation for new users and pools
- Aggregated statistics tracking for pools and users

### Troubleshooting
- Ensure all contract addresses are valid
- Verify ABI files match deployed contracts
- Check event signatures match contract implementations
- Validate schema entity relationships
