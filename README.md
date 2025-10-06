# Envio Property Data Indexer

A blockchain indexer built with Envio that processes property data events from smart contracts and fetches detailed property information from IPFS, including structure, address, and property details.

## Creating a New Deployment

To create a new deployment in Envio:  

1. **Open Envio Dashboard**: Go to [Envio](https://envio.dev) and select your indexer 
2. **Update Git Settings**: 
   - Open **Settings**
   - Set your desired branch name in **Git Release Branch** (e.g., `production`, `staging`)
   - Click **Update**
3. **Set Environment Variables**:
   - Go to **Environment Variables**
   - Set Env variables
     ```bash
      # Envio Configuration
      ENVIO_API_TOKEN="your-api-token-from-envio-dashboard"
      
      # Blockchain Configuration
      ENVIO_START_BLOCK="START_BLOCK" with the latest block number
      ENVIO_CONTRACT_ADDRESS="0x525E59e4DE2B51f52B9e30745a513E407652AB7c"
      
      # Wallet Address Allowlist (add your wallet addresses) 
      ENVIO_WALLET_ADDRESS="0x2C810CD120eEb840a7012b77a2B4F19889Ecf65C"
      # Add more wallets with numbered suffixes if needed:
      # ENVIO_WALLET_ADDRESS_2="0xYourSecondWalletAddress"
      # ENVIO_WALLET_ADDRESS_3="0xYourThirdWalletAddress"
     ```
4. **Create and Push Branch**:
   - Create a new branch from `main` with the same name you set in Git Release Branch:
     ```bash
     git checkout main
     git pull origin main
     git checkout -b production  # or your branch name
     git push origin production
     ```
   - Push any changes to trigger deployment:
     ```bash
     git commit --allow-empty -m "trigger deployment"
     git push origin production
     ```
5. **Monitor Deployment**:
   - Return to Envio dashboard
   - You'll see the deployment has started in your subgraph

## Features

- **Real-time Event Processing**: Monitors `DataSubmitted` and `DataGroupHeartBeat` events
- **IPFS Data Fetching**: Retrieves property, structure, and address data from multiple IPFS gateways
- **Multi-Gateway Failover**: Automatic retry across multiple IPFS gateways for reliability
- **Dynamic Wallet Filtering**: Configurable wallet address allowlist via environment variables
- **GraphQL API**: Query property data through a GraphQL interface

## Prerequisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)
- Git

## Getting Started

### 1. Create Envio Account

1. Visit [envio.dev](https://envio.dev)
2. Sign up for a new account
3. Go to [API Tokens](https://envio.dev/app/api-tokens) to create a new token
4. Save your API token for the next step

### 2. Clone and Setup

```bash
git clone git@github.com:elephant-xyz/envio-subgraph.git
cd envio-subgraph
pnpm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Envio Configuration
ENVIO_API_TOKEN="your-api-token-from-envio-dashboard"

# Blockchain Configuration
ENVIO_START_BLOCK="START_BLOCK"
ENVIO_CONTRACT_ADDRESS="0x525E59e4DE2B51f52B9e30745a513E407652AB7c"

# Wallet Address Allowlist (add your wallet addresses)
ENVIO_WALLET_ADDRESS="0x2C810CD120eEb840a7012b77a2B4F19889Ecf65C"
# Add more wallets with numbered suffixes if needed:
# ENVIO_WALLET_ADDRESS_2="0xYourSecondWalletAddress"
# ENVIO_WALLET_ADDRESS_3="0xYourThirdWalletAddress"
```

**Important Notes:**
- Replace `your-api-token-from-envio-dashboard` with your actual Envio API token
- The indexer will only process events from wallet addresses listed in the environment variables
- You can add multiple wallet addresses using the pattern `ENVIO_WALLET_ADDRESS_*`
- The indexer will crash on startup if no wallet addresses are found (this is intentional for security)

### 4. Generate Code from Schema

Before running, generate the TypeScript types:

```bash
pnpm codegen
```

### 5. Local Development

#### Start the indexer locally:

```bash
pnpm dev
```

This will:
- Start the Envio indexer
- Begin processing events from the specified start block
- Fetch IPFS data for property information
- Provide a local GraphQL endpoint at `http://localhost:8080`

**Local Access:**
- Visit http://localhost:8080 to see the GraphQL Playground
- Local password is `testing`

### 6. Testing the Indexer

#### Check GraphQL Endpoint:

Once running, visit the GraphQL playground at `http://localhost:8080` to query your data:

```graphql
query {
  dataSubmittedWithLabels {
    id
    propertyHash
    label
    submitter
    cid
    structure {
      roof_date
      architectural_style_type
      number_of_stories
    }
    address {
      street_name
      street_number
      city_name
      county_name
      state_code
    }
    property {
      property_type
      parcel_identifier
      property_structure_built_year
    }
    ipfs {
      ipfs_url
      full_generation_command
    }
  }
}
```

#### Monitor Processing:

Watch the logs to see events being processed:
- Events from allowlisted wallets will be processed
- Events from other wallets will be skipped
- IPFS data fetching with retry logic across multiple gateways

### 7. Deploy to Production

#### Deploy to Envio Cloud:

```bash
pnpm deploy
```

This will deploy your indexer to Envio's hosted infrastructure.

#### Production Environment Variables:

Ensure your production environment has the same environment variables set in your Envio dashboard under your project settings.

## Project Structure

```
├── config.yaml              # Envio indexer configuration
├── schema.graphql           # GraphQL schema definitions
├── src/
│   ├── EventHandlers.ts     # Event processing logic
│   └── utils/
│       └── ipfs.ts         # IPFS data fetching utilities
├── .env                     # Environment variables (local)
└── README.md               # This file
```

## Data Sources

The indexer processes these event types:

- **DataSubmitted**: New property data submissions
- **DataGroupHeartBeat**: Property data updates
- **Other Contract Events**: Role management, upgrades, etc.

For each property event, the indexer:

1. Converts the data hash to IPFS CID
2. Fetches metadata from IPFS to determine the label type ("County" or "Seed")
3. For "County" labels, fetches detailed property, structure, and address data
4. Stores all data in the GraphQL database with proper relationships

## Entity Relationships

- **DataSubmittedWithLabel**: Main entity linking to property, structure, address, and IPFS data
- **Structure**: Building details (roof, walls, foundation, etc.)
- **Address**: Location information (street, city, county, etc.)
- **Property**: Property metadata (type, built year, parcel ID, etc.)
- **Ipfs**: Fact sheet data (IPFS URL and generation command)

## IPFS Gateway Configuration

The indexer uses multiple IPFS gateways for reliability:

- Pinata (with authentication tokens)
- Filebase
- IPFS.io
- Cloudflare IPFS
- Web3.storage
- And more...

If one gateway fails, the system automatically tries the next one with built-in delays and retry logic.

## Wallet Address Configuration

The indexer uses a dynamic wallet allowlist system:

- Any environment variable starting with `ENVIO_WALLET_ADDRESS` will be included
- Use `ENVIO_WALLET_ADDRESS` for the primary wallet
- Use `ENVIO_WALLET_ADDRESS_2`, `ENVIO_WALLET_ADDRESS_3`, etc. for additional wallets
- The indexer will crash on startup if no wallet addresses are found

## Troubleshooting

### Common Issues:

1. **"No wallet addresses found" error**:
   - Ensure you have at least one `ENVIO_WALLET_ADDRESS*` variable set in your `.env` file

2. **IPFS fetch failures**:
   - Check the logs for specific gateway errors
   - The system will automatically retry with other gateways

3. **Events not being processed**:
   - Verify your wallet address is in the allowlist
   - Check that the contract address and start block are correct

4. **API token issues**:
   - Ensure your Envio API token is valid and properly set
   - Check your account has the necessary permissions

5. **TypeScript compilation errors**:
   - Run `pnpm codegen` to regenerate types from schema

### Debug Mode:

Enable verbose logging by checking the Envio dashboard logs or running locally to see detailed processing information.

## Development Commands

```bash
# Install dependencies
pnpm install

# Generate TypeScript types from schema
pnpm codegen

# Start local development
pnpm dev

# Deploy to Envio cloud
pnpm deploy
```

## Support

- [Envio Documentation](https://docs.envio.dev) - Complete guide on all Envio indexer features
- [Envio Discord](https://discord.gg/envio)
- [GitHub Issues](./issues) for project-specific problems
