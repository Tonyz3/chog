# Chog Remix Studio

A small, browser based Chog PFP remix demo built for a competition walkthrough. It lets visitors change a character's palette, expression, and accessory, generate and save remixes locally, browse the remix shelf, and export a 1024 × 1024 PNG.

> **Demo build:** this repository contains sample, original vector artwork and simulated wallet, NFT access, credit, and burn states. It does not verify Chog ownership, connect to a blockchain, or burn an NFT. Do not treat the demo credits or sample gallery as production data.

## Features

- Responsive dark creative studio with live composition preview.
- Background, fur color, expression, and accessory controls; shuffle and reset actions.
- Demo generation credits with duplicate-click protection provided by the single synchronous UI action.
- Session-only remix shelf and remix action; one visual dimension changes with every generated variation.
- PNG export at 1024 × 1024.
- Persistent `DEMO MODE` labels and explicit simulated burn messaging.
- Vercel configuration for Vite static output and SPA routing.

## Screenshots

Add judge-facing screenshots here after running the app. Suggested files: `docs/screenshots/studio.png`, `docs/screenshots/gallery.png`, and `docs/screenshots/mobile.png`.

![Studio screenshot placeholder](docs/screenshots/studio.png)

## Architecture

- `src/studio.tsx` contains the UI, sample vector character, editor state, demo credit actions, local gallery, and PNG export.
- `src/style.css` contains the responsive visual system.
- `src/main.tsx` mounts the React application.
- `vite.config.ts` and `vercel.json` configure the Vite build and Vercel SPA routing.

The character is rendered as inline SVG and rasterized client-side through a canvas for export. Demo creations are held in React state for the current page session; this MVP does not yet persist them across reloads. No backend is included.

## Chog access and generation credits

The intended product model is for a wallet to prove that it owns at least one NFT from the verified Chog collection. A successful, server or chain verified ownership check would grant a configurable standard generation credit without burning the NFT. A separate burn reward could grant five credits only after the real collection's burn support, contract, network, transaction result, and replay protection have been verified.

None of those on-chain steps are implemented in this demo. “Connect wallet” only toggles a sample connected state; collection access and the “Demo burn +5” action are simulations. The burn button sends no transaction and consumes no NFT. The included sample character is an original vector illustration and is not represented as official Chog collection art. Before production use, identify and verify the official network, contract, standard, inventory, metadata source, and burn semantics; then implement wallet reads and a secure credit ledger. Do not enable burning based on the demo UI.

## Technology

- React 19, TypeScript, Vite 7
- Inline SVG and browser Canvas APIs
- Plain CSS; no wallet or backend dependencies

## Local setup

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The demo works without a wallet or environment configuration.

## Environment variables

Copy `.env.example` to `.env.local` only when configuring a future integration. All `VITE_` values are exposed to browser code and must be public values; never put private keys, seed phrases, service role keys, or other secrets there. The current demo does not read these variables.

| Variable | Purpose | Current demo |
| --- | --- | --- |
| `VITE_PUBLIC_RPC_URL` | Optional public RPC endpoint after network verification | Unused |
| `VITE_CHOG_COLLECTION_ADDRESS` | Collection contract address after verification | Unused |
| `VITE_API_BASE_URL` | Future backend endpoint for verified credits and persistent gallery | Unused |

## Build and checks

```sh
npm run build
npm run preview
```

`npm run build` runs TypeScript checking and creates the production bundle in `dist/`. This starter does not include a unit-test or lint command yet. Manually verify the palette, expression, accessory, shuffle, generate, demo burn, gallery remix, and PNG download actions in a browser before presenting it.

## Vercel deployment

1. Push the project to a GitHub repository.
2. In Vercel, choose **Add New → Project**, import `chog-remix-studio`, and use the Vite defaults. The included `vercel.json` sets `npm run build`, `dist`, and SPA rewrites.
3. No environment variables are required for the demo. Deploy, then open the assigned URL and confirm the editor and PNG export work.

Alternatively, with an authenticated Vercel CLI, run `vercel` to link the project and `vercel --prod` to deploy. A deployment is live only after Vercel reports success and the resulting URL loads.

## GitHub publishing

This directory was initially empty and had no Git repository or remote. Initialize and commit locally with:

```sh
git init -b main
git add .
git status --short
git commit -m "Build Chog Remix Studio demo"
```

After GitHub authentication is available, create a **public** repository named `chog-remix-studio` in your account, then connect and push:

```sh
git remote add origin https://github.com/YOUR-USERNAME/chog-remix-studio.git
git push -u origin main
```

Review `git status` and the staged file list before publishing. `.env*` files are ignored except `.env.example`; build outputs, dependencies, and Vercel local state are also ignored. No license is included because no license or ownership terms were selected.

## Known demo limitations

- No verified Chog collection contract, chain, token inventory, metadata, or official artwork catalogue is configured.
- Wallet connection, ownership, balances, and burn actions are simulated.
- Credits and gallery are in-memory UI state, not a secure or persistent ledger.
- Gallery entries are local demo examples, not community submissions.
- No backend, public gallery persistence, authentication, or real transaction support is included.
- External Google Fonts are optional; system sans-serif fonts remain as fallback when offline.
