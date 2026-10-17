# Chog Remix Studio

A browser based studio for remixing **real Chog Genesis NFTs** on Monad. Choose artwork from the indexed collection, arrange complete NFT images on a square canvas, add backgrounds and text, save remixes in your browser, and export a 1024 × 1024 PNG.

> The editor and export work without a wallet. Collection data is sourced from Monad contract metadata and IPFS. Wallet access is an optional read-only ERC-721 balance check. There are no credits, burns, simulated transactions, or claims of on-chain activity.

## Features

- Gallery of real Chog Genesis NFTs with token IDs, metadata traits, and marketplace links.
- Collection manifest records discovery, metadata and image availability, failures, and inventory completeness; it does not mark an incomplete import complete.
- Interactive canvas: add, move, resize, reorder, remove, rotate, and crop NFT image layers; set a background and add text.
- Randomize compositions with actual collection assets.
- Export the composition rendered on the canvas as a high-resolution PNG.
- Save, revisit, remove, and remix compositions in local browser storage.
- Optional wallet connection that checks the account’s standard ERC-721 balance on Monad mainnet.
- Responsive desktop and mobile layouts; gallery and editor work without connecting a wallet.

## Collection source and access model

Chog’s official links point to the Chog Genesis OpenSea collection. The collection identifies the Monad ERC-721 contract as `0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763`. The import script verifies Monad chain ID 143, contract bytecode, and on-chain `totalSupply()`, then checks `ownerOf()` and retrieves `tokenURI()` for every enumerated token ID. It resolves metadata and original images from IPFS, preserves raw metadata and traits, and records per-token failures. See [Chog](https://www.chog.xyz/), [official collection](https://opensea.io/collection/chog-genesis), and [Monad network](https://docs.monad.xyz/).

The app displays source and import counts from `public/data/chog-genesis.json`. It reports a complete inventory only after every enumerated ID has an owner, unique metadata, and a reachable image. The editor uses complete source NFT images; it does not claim to have separate transparent trait layers.

The optional wallet check asks the browser wallet for an account, switches to chain 143, then reads `balanceOf(account)` from the verified collection contract. A positive balance only indicates current holder access. It grants no generation credits and sends no transaction. No burn-to-earn flow is implemented because burn semantics have not been established.

## Architecture

- `src/studio.tsx`: React app, collection loading, image gallery, canvas compositor, local save shelf, PNG export, and optional read-only wallet check.
- `src/style.css`: responsive studio and editor styles.
- `scripts/import-chog-genesis.mjs`: checks Monad and the contract, enumerates token IDs, retrieves and normalizes metadata, tests original image URLs, resumes from cached manifest entries, and writes the inventory manifest.
- `public/data/chog-genesis.json`: generated normalized manifest and source metadata.
- `src/main.tsx`: app entry point; `vercel.json` configures Vite output and SPA routing.

## Technology

React 19, TypeScript, Vite 7, browser Canvas and wallet provider APIs, Node.js built-in `fetch` for the collection importer. No backend is required for editing, saving locally, or exporting.

## Local setup

Requirements: Node.js 20.19+ or 22.12+, and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The checked-in manifest lets the editor run without a wallet or environment variables.

## Refresh collection data

```sh
npm run import:collection
```

The importer uses Monad mainnet’s public RPC by default and public IPFS gateways. Optionally set `MONAD_RPC_URL`, `IMPORT_CONCURRENCY` (1–12), and `IMPORT_DELAY_MS` for a private or rate-limited RPC. Existing token metadata is reused when its on-chain `tokenURI` is unchanged, while image URLs are rechecked. The command prints discovered, metadata loaded, images reachable, failures, and unique token counts. It exits unsuccessfully when the full supply has not been verified and ingested.

## Environment variables and secrets

The web app has no required secrets. Browser wallet access is provided by the user’s wallet. The importer’s `MONAD_RPC_URL` is a machine-side public endpoint setting and is not bundled into the frontend. `.env.example` is documentation only. Never place private keys, seed phrases, wallet credentials, or server secrets in `VITE_` variables; Vite publishes those values to the browser. `.env` files are ignored by Git.

## Build and checks

```sh
npm run build
npm run preview
```

`npm run build` runs TypeScript project checks and creates the static site in `dist/`. No automated unit-test or lint script is currently included. Check the gallery, image selection, layer editing, randomize, local save/remix, and PNG download in a browser before a competition presentation.

## Vercel deployment

The included `vercel.json` configures Vite’s `npm run build`, `dist` output, and SPA rewrites. Import the GitHub repository into Vercel, keep those build defaults, and deploy. No environment variables are needed for editor or demo mode. Confirm the deployed URL and try gallery loading and PNG export after deployment. Set a public RPC variable only if a future frontend implementation explicitly needs one; never deploy secrets to browser variables.

## Limitations

- IPFS image availability and browser reachability depend on external gateways; the app provides fallback gateways, but external outages can affect images.
- Saved compositions live in this browser’s local storage and are not shared or synced.
- The wallet check is read-only and is not a durable authorization or credit ledger.
- Burn transactions, generation credits, persistent user accounts, and community activity are not implemented.
- Screenshots can be added after capturing the app with the imported collection data.

## Screenshots

Screenshots: add a real studio capture here when available. No placeholder artwork is used.

No license is included because project ownership and reuse terms have not been selected.
