import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(ROOT, 'public', 'data', 'chog-genesis.json')
const CONTRACT = '0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763'
const COLLECTION = 'chog-genesis'
const CHAIN_ID = 143
const EXPECTED_SUPPLY = 1969
const RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz'
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.IMPORT_CONCURRENCY) || 6))
const RATE_DELAY_MS = Math.max(0, Number(process.env.IMPORT_DELAY_MS) || 80)
const IPFS_GATEWAYS = ['https://ipfs2.seadn.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/']
const IMPORTED_AT = new Date().toISOString()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function request(url, options = {}, label = url) {
  let lastError
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(35_000) })
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'))
        await response.body?.cancel()
        await sleep(retryAfter ? retryAfter * 1000 : Math.min(12_000, 500 * 2 ** attempt) + Math.random() * 300)
        continue
      }
      if (!response.ok) {
        const error = new Error(`${label}: HTTP ${response.status}`)
        error.status = response.status
        throw error
      }
      return response
    } catch (error) {
      if (error?.status && error.status < 500 && error.status !== 408) throw error
      lastError = error
      if (attempt < 5) await sleep(Math.min(12_000, 500 * 2 ** attempt) + Math.random() * 300)
    }
  }
  throw lastError || new Error(`${label}: retry limit reached`)
}

async function rpc(method, params) {
  const response = await request(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }, `Monad RPC ${method}`)
  const body = await response.json()
  if (body.error) throw new Error(`Monad RPC ${method}: ${body.error.message || JSON.stringify(body.error)}`)
  return body.result
}

async function ethCall(data) {
  return rpc('eth_call', [{ to: CONTRACT, data }, 'latest'])
}

function decodeAbiString(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x') || hex.length < 130) throw new Error('Invalid ABI string response')
  const bytes = Buffer.from(hex.slice(2), 'hex')
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`))
  if (!Number.isSafeInteger(offset) || offset < 32 || offset + 32 > bytes.length) throw new Error('Invalid ABI string offset')
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`))
  if (!Number.isSafeInteger(length) || length < 1 || offset + 32 + length > bytes.length) throw new Error('Invalid ABI string length')
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8')
}

function resolveContentUri(uri) {
  if (typeof uri !== 'string' || !uri.trim()) throw new Error('Missing content URI')
  const value = uri.trim()
  if (value.startsWith('ipfs://')) {
    const cidPath = value.slice('ipfs://'.length).replace(/^ipfs\//, '')
    return IPFS_GATEWAYS.map(gateway => `${gateway}${cidPath}`)
  }
  if (value.startsWith('ar://')) return [`https://arweave.net/${value.slice('ar://'.length)}`]
  if (value.startsWith('https://')) return [value]
  throw new Error(`Unsupported content URI scheme: ${value.split(':')[0] || 'none'}`)
}

async function fetchJsonUri(uri) {
  let error
  for (const candidate of resolveContentUri(uri)) {
    try {
      const response = await request(candidate, { headers: { accept: 'application/json' } }, `metadata ${candidate}`)
      const value = await response.json()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Metadata must be a JSON object')
      return { value, resolvedUrl: candidate }
    } catch (caught) { error = caught }
  }
  throw error || new Error(`Unable to resolve metadata URI ${uri}`)
}

function normalize(tokenId, tokenUri, raw, resolvedMetadataUrl, imageUrl, imageContentType) {
  const attributes = Array.isArray(raw.attributes) ? raw.attributes.flatMap(attribute => {
    if (!attribute || attribute.trait_type == null || attribute.value == null) return []
    return [{ traitType: String(attribute.trait_type), value: String(attribute.value), displayType: attribute.display_type ? String(attribute.display_type) : null }]
  }) : []
  return {
    tokenId: String(tokenId),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Chog #${tokenId}`,
    description: typeof raw.description === 'string' ? raw.description : '',
    tokenUri,
    metadataUrl: resolvedMetadataUrl,
    imageUri: typeof raw.image === 'string' ? raw.image : typeof raw.image_url === 'string' ? raw.image_url : '',
    imageUrl,
    imageContentType,
    attributes,
    rawMetadata: raw,
    collection: COLLECTION,
    contract: CONTRACT,
    chainId: CHAIN_ID,
    openseaUrl: `https://opensea.io/assets/monad/${CONTRACT}/${tokenId}`,
  }
}

async function checkImage(uri) {
  let error
  for (const candidate of resolveContentUri(uri)) {
    try {
      let response = await request(candidate, { method: 'HEAD', headers: { accept: 'image/*' } }, `image ${candidate}`)
      if (response.status === 405 || response.status === 501) {
        response = await request(candidate, { headers: { accept: 'image/*', range: 'bytes=0-31' } }, `image ${candidate}`)
      }
      const contentType = response.headers.get('content-type')?.split(';')[0] || ''
      if (!contentType.startsWith('image/')) throw new Error(`Not an image (${contentType || 'unknown content type'})`)
      await response.body?.cancel()
      return { url: candidate, contentType }
    } catch (caught) { error = caught }
  }
  throw error || new Error(`Unable to resolve image URI ${uri}`)
}

function serializeManifest(manifest) {
  const entries = Object.entries(manifest)
  const lines = ['{']
  entries.forEach(([key, value], index) => {
    const comma = index < entries.length - 1 ? ',' : ''
    if (key === 'assets' || key === 'failures') {
      lines.push(`  ${JSON.stringify(key)}: [`)
      value.forEach((item, itemIndex) => lines.push(`    ${JSON.stringify(item)}${itemIndex < value.length - 1 ? ',' : ''}`))
      lines.push(`  ]${comma}`)
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`)
    }
  })
  lines.push('}')
  return `${lines.join('\n')}\n`
}

async function writeManifest(manifest) {
  await mkdir(path.dirname(OUTPUT), { recursive: true })
  const temp = `${OUTPUT}.tmp`
  await writeFile(temp, serializeManifest(manifest), 'utf8')
  await rename(temp, OUTPUT)
}

if (process.argv.includes('--compact-manifest')) {
  const manifest = JSON.parse(await readFile(OUTPUT, 'utf8'))
  await writeManifest(manifest)
  console.log(`Compacted ${manifest.assets.length} unique asset records in ${OUTPUT}.`)
  process.exit(0)
}

let previous = { assets: [] }
try { previous = JSON.parse(await readFile(OUTPUT, 'utf8')) } catch { /* first import */ }
const cached = new Map((previous.assets || []).map(asset => [String(asset.tokenId), asset]))

const actualChainId = Number(BigInt(await rpc('eth_chainId', [])))
if (actualChainId !== CHAIN_ID) throw new Error(`Wrong RPC network: expected chain ${CHAIN_ID}, received ${actualChainId}`)
const code = await rpc('eth_getCode', [CONTRACT, 'latest'])
if (!code || code === '0x') throw new Error(`No contract bytecode at ${CONTRACT} on chain ${CHAIN_ID}`)
const totalSupplyHex = await ethCall('0x18160ddd')
const totalSupply = Number(BigInt(totalSupplyHex))
if (!Number.isSafeInteger(totalSupply) || totalSupply < 1) throw new Error(`Invalid totalSupply result: ${totalSupplyHex}`)
if (totalSupply !== EXPECTED_SUPPLY) throw new Error(`Supply mismatch: verified OpenSea collection lists ${EXPECTED_SUPPLY}; contract returned ${totalSupply}`)
console.log(`Verified Monad chain ${actualChainId}; contract ${CONTRACT}; on-chain totalSupply ${totalSupply}.`)
console.log(`Enumerating tokenURI for candidate token IDs 1–${totalSupply}; concurrency ${CONCURRENCY}.`)

const tokenIds = Array.from({ length: totalSupply }, (_, index) => index + 1)
const assets = new Array(totalSupply)
const failures = []
let completed = 0
let metadataLoaded = 0
let imageReachable = 0
let cacheHits = 0
let ownersVerified = 0
let nextIndex = 0

async function processOne(tokenId) {
  const tokenArgument = BigInt(tokenId).toString(16).padStart(64, '0')
  const ownerResult = await ethCall(`0x6352211e${tokenArgument}`)
  if (typeof ownerResult !== 'string' || !/^0x[\da-fA-F]{64}$/.test(ownerResult) || /^0x0{64}$/i.test(ownerResult)) {
    throw new Error(`ownerOf(${tokenId}) returned no valid ERC-721 owner`)
  }
  ownersVerified += 1
  const tokenUriHex = await ethCall(`0xc87b56dd${tokenArgument}`)
  const tokenUri = decodeAbiString(tokenUriHex)
  const old = cached.get(String(tokenId))
  let record
  if (old?.tokenUri === tokenUri && old?.imageUrl && Array.isArray(old?.attributes)) {
    record = { ...old, ownerVerified: true }
    cacheHits += 1
    metadataLoaded += 1
  } else {
    const { value, resolvedUrl } = await fetchJsonUri(tokenUri)
    const originalImageUri = typeof value.image === 'string' ? value.image : value.image_url
    if (!originalImageUri) throw new Error(`Metadata for token ${tokenId} has no image field`)
    metadataLoaded += 1
    const image = await checkImage(originalImageUri)
    imageReachable += 1
    record = normalize(tokenId, tokenUri, value, resolvedUrl, image.url, image.contentType)
    record.ownerVerified = true
  }
  if (old?.tokenUri === tokenUri) {
    const image = await checkImage(record.imageUri)
    record = { ...record, imageUrl: image.url, imageContentType: image.contentType }
    imageReachable += 1
  }
  assets[tokenId - 1] = record
}

async function worker() {
  while (true) {
    const index = nextIndex++
    if (index >= tokenIds.length) return
    const tokenId = tokenIds[index]
    try { await processOne(tokenId) }
    catch (error) {
      failures.push({ tokenId: String(tokenId), error: error instanceof Error ? error.message : String(error) })
    } finally {
      completed += 1
      if (completed % 50 === 0 || completed === totalSupply) {
        const currentAssets = assets.filter(Boolean)
        const uniqueTokens = new Set(currentAssets.map(asset => asset.tokenId)).size
        const manifest = {
          source: 'Monad mainnet ownerOf + tokenURI + IPFS metadata',
          collection: COLLECTION,
          contract: CONTRACT,
          chainId: CHAIN_ID,
          totalSupply,
          discovered: ownersVerified,
          ownersVerified,
          metadataLoaded,
          imagesReachable: imageReachable,
          failed: failures.length,
          uniqueTokenIds: uniqueTokens,
          inventoryComplete: completed === totalSupply && failures.length === 0 && ownersVerified === totalSupply && uniqueTokens === totalSupply && metadataLoaded === totalSupply && imageReachable === totalSupply,
          updatedAt: IMPORTED_AT,
          assets: currentAssets,
          failures: [...failures].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
        }
        await writeManifest(manifest)
        console.log(`Progress ${completed}/${totalSupply}: owners verified ${ownersVerified}, metadata ${metadataLoaded}, images reachable ${imageReachable}, failed ${failures.length}, cached metadata ${cacheHits}.`)
      }
    }
    if (RATE_DELAY_MS) await sleep(RATE_DELAY_MS)
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
const uniqueTokenIds = new Set(assets.filter(Boolean).map(asset => asset.tokenId)).size
const inventoryComplete = completed === totalSupply && failures.length === 0 && ownersVerified === totalSupply && uniqueTokenIds === totalSupply && metadataLoaded === totalSupply && imageReachable === totalSupply
const finalManifest = {
  source: 'Monad mainnet ownerOf + tokenURI + IPFS metadata',
  collection: COLLECTION,
  contract: CONTRACT,
  chainId: CHAIN_ID,
  totalSupply,
  discovered: ownersVerified,
  ownersVerified,
  metadataLoaded,
  imagesReachable: imageReachable,
  failed: failures.length,
  uniqueTokenIds,
  inventoryComplete,
  updatedAt: IMPORTED_AT,
  assets: assets.filter(Boolean),
  failures: [...failures].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
}
await writeManifest(finalManifest)
console.log(`Finished: supply ${totalSupply}, existing NFTs verified ${ownersVerified}, metadata ${metadataLoaded}, images reachable ${imageReachable}, failed ${failures.length}, unique tokens ${uniqueTokenIds}; inventoryComplete=${inventoryComplete}.`)
console.log(`Manifest: ${OUTPUT}`)
if (!inventoryComplete) process.exitCode = 1
