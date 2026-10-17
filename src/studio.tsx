import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const COLLECTION = '0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763'
const CHAIN_ID = 143
const SAVES_KEY = 'chog-remix-compositions-v1'
const PAGE_SIZE = 32

type Attribute = { traitType: string; value: string; displayType?: string | null }
type Asset = {
  tokenId: string; name: string; description: string; imageUri: string; imageUrl: string
  imageContentType: string; attributes: Attribute[]; openseaUrl: string; ownerVerified?: boolean
}
type Manifest = {
  collection: string; contract: string; chainId: number; totalSupply: number; discovered: number
  metadataLoaded: number; imagesReachable: number; ownersVerified: number; failed: number; uniqueTokenIds: number
  inventoryComplete: boolean; updatedAt: string; assets: Asset[]; failures: { tokenId: string; error: string }[]
}
type ImageLayer = { id: string; kind: 'image'; tokenId: string; x: number; y: number; width: number; height: number; rotation: number; fit: 'contain'|'cover' }
type TextLayer = { id: string; kind: 'text'; text: string; color: string; x: number; y: number; width: number; height: number; rotation: number }
type Layer = ImageLayer | TextLayer
type Composition = { id: string; title: string; createdAt: string; background: string; layers: Layer[] }
type WalletProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> }
declare global { interface Window { ethereum?: WalletProvider } }

const BACKGROUNDS = ['#19251c', '#d6ebad', '#ecd2c4', '#d5c8ec', '#c0e5e3', '#f5e9cb', '#21242b']
const IPFS_FALLBACK = 'https://gateway.pinata.cloud/ipfs/'
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const newComposition = (): Composition => ({ id: uid(), title: 'Untitled remix', createdAt: new Date().toISOString(), background: '#19251c', layers: [] })

function ipfsFallback(url: string) {
  if (!url.startsWith('https://ipfs2.seadn.io/ipfs/')) return undefined
  return IPFS_FALLBACK + url.slice('https://ipfs2.seadn.io/ipfs/'.length)
}

function drawComposition(ctx: CanvasRenderingContext2D, composition: Composition, assets: Map<string, Asset>, images: Map<string, HTMLImageElement>, refresh: () => void, onImageLoaded?: (imageUrl: string) => void, onImageError?: (tokenId: string) => void) {
  const size = ctx.canvas.width
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = composition.background
  ctx.fillRect(0, 0, size, size)
  for (const layer of composition.layers) {
    const left = layer.x * size / 100
    const top = layer.y * size / 100
    const width = layer.width * size / 100
    const height = layer.height * size / 100
    ctx.save()
    ctx.translate(left + width / 2, top + height / 2)
    ctx.rotate(layer.rotation * Math.PI / 180)
    if (layer.kind === 'text') {
      const fontSize = Math.max(14, height * 0.65)
      ctx.font = `700 ${fontSize}px "Space Grotesk", Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = layer.color
      ctx.shadowColor = '#0008'
      ctx.shadowBlur = fontSize * 0.12
      ctx.fillText(layer.text.slice(0, 90), 0, 0, Math.max(20, width))
    } else {
      const asset = assets.get(layer.tokenId)
      if (asset) {
        let image = images.get(asset.imageUrl)
        if (!image) {
          image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => { onImageLoaded?.(asset.imageUrl); refresh() }
          image.onerror = () => {
            const fallback = ipfsFallback(asset.imageUrl)
            if (fallback && image && image.src !== fallback) image.src = fallback
            else onImageError?.(layer.tokenId)
          }
          images.set(asset.imageUrl, image)
          image.src = asset.imageUrl
        }
        if (image.complete && image.naturalWidth > 0) {
          if (layer.fit === 'contain') {
            const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
            const drawWidth = image.naturalWidth * scale
            const drawHeight = image.naturalHeight * scale
            ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
          } else {
            const sourceAspect = image.naturalWidth / image.naturalHeight
            const targetAspect = width / height
            let sourceX = 0, sourceY = 0, sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight
            if (sourceAspect > targetAspect) {
              sourceWidth = image.naturalHeight * targetAspect
              sourceX = (image.naturalWidth - sourceWidth) / 2
            } else {
              sourceHeight = image.naturalWidth / targetAspect
              sourceY = (image.naturalHeight - sourceHeight) / 2
            }
            ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -width / 2, -height / 2, width, height)
          }
        }
      }
    }
    ctx.restore()
  }
}

function CompositionCanvas({ composition, assets, className, onImageLoaded, onImageError }: {
  composition: Composition; assets: Map<string, Asset>; className: string; onImageLoaded?: (imageUrl: string) => void; onImageError?: (tokenId: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageCache = useRef(new Map<string, HTMLImageElement>())
  const [imageRevision, setImageRevision] = useState(0)
  const refresh = useCallback(() => setImageRevision(value => value + 1), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.width = 1024
    canvas.height = 1024
    drawComposition(context, composition, assets, imageCache.current, refresh, onImageLoaded, onImageError)
    for (const layer of composition.layers) {
      if (layer.kind !== 'image' || imageCache.current.has(layer.id)) continue
      const asset = assets.get(layer.tokenId)
      if (!asset || imageCache.current.has(asset.imageUrl)) continue
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => { onImageLoaded?.(asset.imageUrl); refresh() }
      image.onerror = () => {
        const fallback = ipfsFallback(asset.imageUrl)
        if (fallback && image.src !== fallback) image.src = fallback
        else onImageError?.(layer.tokenId)
      }
      imageCache.current.set(asset.imageUrl, image)
      image.src = asset.imageUrl
    }
    drawComposition(context, composition, assets, imageCache.current, refresh)
  }, [composition, assets, imageRevision, onImageLoaded, onImageError, refresh])

  return <div className={`canvas-stage ${className}`}>
    <canvas ref={canvasRef} aria-label="Live composition preview" />
  </div>
}

function readSaves(): Composition[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SAVES_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((item): item is Composition => !!item && typeof item.id === 'string' && Array.isArray(item.layers)) : []
  } catch { return [] }
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [manifestError, setManifestError] = useState('')
  const [composition, setComposition] = useState<Composition>(newComposition)
  const [saved, setSaved] = useState<Composition[]>([])
  const [view, setView] = useState<'studio'|'saved'>('studio')
  const [search, setSearch] = useState('')
  const [traitType, setTraitType] = useState('')
  const [traitValue, setTraitValue] = useState('')
  const [page, setPage] = useState(0)
  const [selectedToken, setSelectedToken] = useState('')
  const [selectedLayer, setSelectedLayer] = useState('')
  const [overlayText, setOverlayText] = useState('')
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [canvasImages, setCanvasImages] = useState<Set<string>>(new Set())
  const [walletAddress, setWalletAddress] = useState('')
  const [ownedCount, setOwnedCount] = useState<number | null>(null)
  const [walletMessage, setWalletMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const resizeRef = useRef<{ id: string; startX: number; startY: number; width: number; height: number } | null>(null)

  useEffect(() => {
    setSaved(readSaves())
    fetch('/data/chog-genesis.json')
      .then(response => { if (!response.ok) throw new Error('The collection manifest has not been imported yet.') ; return response.json() as Promise<Manifest> })
      .then(data => {
        if (data.contract.toLowerCase() !== COLLECTION || data.chainId !== CHAIN_ID || !Array.isArray(data.assets)) throw new Error('The collection manifest identity does not match the verified Chog Genesis contract.')
        setManifest(data)
      })
      .catch(error => setManifestError(error instanceof Error ? error.message : 'Could not load the collection manifest.'))
  }, [])

  useEffect(() => {
    if (!window.ethereum) return
    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined
      setWalletAddress(accounts?.[0] || '')
      setOwnedCount(null)
    }
    const handleChain = () => { setOwnedCount(null) }
    const provider = window.ethereum as WalletProvider & { on?: (event: string, callback: (...args: unknown[]) => void) => void; removeListener?: (event: string, callback: (...args: unknown[]) => void) => void }
    provider.on?.('accountsChanged', handleAccounts)
    provider.on?.('chainChanged', handleChain)
    return () => { provider.removeListener?.('accountsChanged', handleAccounts); provider.removeListener?.('chainChanged', handleChain) }
  }, [])

  const assets = useMemo(() => new Map((manifest?.assets || []).map(asset => [String(asset.tokenId), asset])), [manifest])
  const types = useMemo(() => [...new Set((manifest?.assets || []).flatMap(asset => asset.attributes.map(attribute => attribute.traitType)))].sort(), [manifest])
  const values = useMemo(() => [...new Set((manifest?.assets || []).flatMap(asset => asset.attributes.filter(attribute => !traitType || attribute.traitType === traitType).map(attribute => attribute.value)))].sort(), [manifest, traitType])
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (manifest?.assets || []).filter(asset => {
      const matchesSearch = !query || `${asset.name} ${asset.tokenId} ${asset.attributes.map(attribute => `${attribute.traitType} ${attribute.value}`).join(' ')}`.toLowerCase().includes(query)
      const matchesTrait = !traitValue || asset.attributes.some(attribute => (!traitType || attribute.traitType === traitType) && attribute.value === traitValue)
      return matchesSearch && matchesTrait
    })
  }, [manifest, search, traitType, traitValue])
  const pageAssets = filteredAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const activeLayer = composition.layers.find(layer => layer.id === selectedLayer) || null
  const selectedAsset = assets.get(selectedToken) || null

  useEffect(() => { setPage(0) }, [search, traitType, traitValue])

  const rememberImage = (tokenId: string) => setLoadedImages(current => current.has(tokenId) ? current : new Set(current).add(tokenId))
  const rememberCanvasImage = useCallback((imageUrl: string) => setCanvasImages(current => current.has(imageUrl) ? current : new Set(current).add(imageUrl)), [])
  const setLayer = (id: string, change: Partial<Layer>) => setComposition(current => ({ ...current, layers: current.layers.map(layer => layer.id === id ? { ...layer, ...change } as Layer : layer) }))
  const addAsset = (asset = selectedAsset) => {
    if (!asset) return
    const layer: ImageLayer = { id: uid(), kind: 'image', tokenId: asset.tokenId, x: 14, y: 14, width: 72, height: 72, rotation: 0, fit: 'contain' }
    setComposition(current => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayer(layer.id)
    setNotice(`${asset.name} added as a movable image layer.`)
  }

  const pointFor = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return { x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 }
  }
  const onStageDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-resize-handle]')) return
    const point = pointFor(event)
    const hit = [...composition.layers].reverse().find(layer => point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + layer.height)
    if (!hit) { setSelectedLayer(''); return }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedLayer(hit.id)
    dragRef.current = { id: hit.id, dx: point.x - hit.x, dy: point.y - hit.y }
  }
  const onStageMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointFor(event)
    if (resizeRef.current) {
      const resize = resizeRef.current
      setLayer(resize.id, { width: Math.max(8, Math.min(180, resize.width + point.x - resize.startX)), height: Math.max(8, Math.min(180, resize.height + point.y - resize.startY)) })
    } else if (dragRef.current) {
      const drag = dragRef.current
      setLayer(drag.id, { x: Math.max(-80, Math.min(100, point.x - drag.dx)), y: Math.max(-80, Math.min(100, point.y - drag.dy)) })
    }
  }
  const onStageUp = () => { dragRef.current = null; resizeRef.current = null }
  const onResizeDown = (event: ReactPointerEvent<HTMLButtonElement>, layer: Layer) => {
    event.stopPropagation()
    stageRef.current?.setPointerCapture(event.pointerId)
    const point = pointFor(event as unknown as ReactPointerEvent<HTMLDivElement>)
    resizeRef.current = { id: layer.id, startX: point.x, startY: point.y, width: layer.width, height: layer.height }
  }

  const addText = () => {
    const text = overlayText.trim()
    if (!text) return
    const layer: TextLayer = { id: uid(), kind: 'text', text, color: '#ffffff', x: 12, y: 42, width: 76, height: 12, rotation: 0 }
    setComposition(current => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayer(layer.id)
    setOverlayText('')
  }

  const randomize = () => {
    const pool = manifest?.assets || []
    if (!pool.length) { setNotice('Import the Chog Genesis manifest to randomize with collection artwork.'); return }
    const layerCount = Math.min(pool.length, 1 + Math.floor(Math.random() * 3))
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, layerCount)
    setComposition(current => ({
      ...current, id: uid(), createdAt: new Date().toISOString(),
      background: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
      layers: shuffled.map((asset, index) => ({ id: uid(), kind: 'image' as const, tokenId: asset.tokenId, x: 15 + (index % 2) * 17, y: 15 + (index % 2) * 17, width: 70 - (index % 2) * 18, height: 70 - (index % 2) * 18, rotation: Math.floor(Math.random() * 17) - 8, fit: 'contain' as const })),
    }))
    setSelectedLayer('')
    setNotice('Randomized using real Chog Genesis images.')
  }

  const saveComposition = () => {
    if (!composition.layers.length) { setNotice('Add at least one collection image or text layer before saving.'); return }
    const next = [{ ...composition, createdAt: new Date().toISOString() }, ...saved.filter(item => item.id !== composition.id)].slice(0, 100)
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(next))
      setSaved(next)
      setNotice('Composition saved in this browser.')
    } catch { setNotice('Could not save this composition in browser storage.') }
  }

  const exportPng = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.editor-canvas canvas')
    const pending = composition.layers.some(layer => layer.kind === 'image' && assets.has(layer.tokenId) && !canvasImages.has(assets.get(layer.tokenId)!.imageUrl))
    if (pending) { setNotice('Wait for the selected collection artwork to finish loading before exporting.'); return }
    if (!canvas || !composition.layers.some(layer => layer.kind === 'image' ? assets.has(layer.tokenId) : layer.text.trim().length > 0)) {
      setNotice('Add a loaded image or text layer before exporting.')
      return
    }
    canvas.toBlob(blob => {
      if (!blob) { setNotice('PNG export failed. Check the image gateway connection and try again.'); return }
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${composition.title.trim().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'chog-remix'}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }, 'image/png')
  }

  const verifyWallet = async () => {
    if (!window.ethereum) { setWalletMessage('No compatible browser wallet was found. You can still use the editor and export images.'); return }
    setBusy(true); setWalletMessage('Checking wallet network…'); setOwnedCount(null)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      if (!accounts?.length) throw new Error('The wallet did not provide an account.')
      const chain = String(await window.ethereum.request({ method: 'eth_chainId' }))
      if (Number(BigInt(chain)) !== CHAIN_ID) {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x8f' }] })
      }
      const address = accounts[0]
      if (!/^0x[\da-fA-F]{40}$/.test(address)) throw new Error('The wallet returned an invalid account address.')
      const result = await window.ethereum.request({ method: 'eth_call', params: [{ to: COLLECTION, data: `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}` }, 'latest'] })
      if (typeof result !== 'string' || !/^0x[\da-fA-F]{64,}$/.test(result)) throw new Error('The collection did not return a valid ERC-721 balanceOf result.')
      setWalletAddress(address)
      setOwnedCount(Number(BigInt(result)))
      setWalletMessage(`Verified balanceOf on Monad mainnet for ${address.slice(0, 6)}…${address.slice(-4)}.`)
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : 'Wallet verification failed.')
    } finally { setBusy(false) }
  }

  const disconnectWallet = () => { setWalletAddress(''); setOwnedCount(null); setWalletMessage('Wallet disconnected.') }
  const selectedDisplayName = activeLayer?.kind === 'image' ? assets.get(activeLayer.tokenId)?.name || `Token ${activeLayer.tokenId}` : activeLayer?.kind === 'text' ? activeLayer.text : ''

  return <main className="studio-app">
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Chog Remix Studio"><span className="wordmark-icon">C</span><span>CHOG <i>REMIX STUDIO</i></span></a>
      <nav aria-label="Main navigation"><button className={view === 'studio' ? 'active' : ''} onClick={() => setView('studio')}>Studio</button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>My remixes <span>{saved.length}</span></button></nav>
      <div className="network-status"><span className="network-dot"/> Monad · 143</div>
    </header>

    <section className="intro" id="top">
      <div><p className="overline">OFFICIAL CHOG GENESIS ARTWORK · MONAD</p><h1>Remix your<br/><em>own Chog.</em></h1><p className="intro-copy">Choose real Genesis NFTs, layer the complete artwork, and export your own composition. Your editor works without connecting a wallet.</p></div>
      <div className="source-card"><span className="source-mark">✳</span><div><strong>Chog Genesis</strong><span>{manifest?.inventoryComplete ? `${manifest.totalSupply.toLocaleString()} NFTs indexed` : manifest ? `Partial import · ${manifest.assets.length.toLocaleString()} / ${manifest.totalSupply.toLocaleString()}` : 'Collection manifest loading'}</span><small>Contract {COLLECTION.slice(0, 8)}…{COLLECTION.slice(-6)}</small></div><a href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer">OpenSea ↗</a></div>
    </section>

    {manifest && <section className={`collection-audit ${manifest.inventoryComplete ? 'complete' : 'partial'}`} aria-live="polite">
      <span className="audit-indicator"/>
      <strong>{manifest.inventoryComplete ? 'Inventory checked' : 'Inventory partial'}</strong>
      <span>{manifest.discovered.toLocaleString()} token IDs verified · {manifest.metadataLoaded.toLocaleString()} metadata · {manifest.imagesReachable.toLocaleString()} image URLs reachable · {manifest.failed} failed</span>
      <span className="render-count">{loadedImages.size.toLocaleString()} images rendered in this browser session</span>
      <time dateTime={manifest.updatedAt}>Updated {new Date(manifest.updatedAt).toLocaleDateString()}</time>
    </section>}
    {manifestError && <section className="manifest-warning" role="status"><strong>Collection manifest unavailable.</strong> {manifestError} Run <code>npm run import:collection</code> to fetch verified token metadata. The empty editor and local PNG export remain available.</section>}

    <section className="wallet-strip" aria-label="Optional NFT ownership verification">
      <div className="wallet-explain"><strong>Optional holder check</strong><span>Reads the connected account’s ERC-721 balance on Monad. No credits or transactions.</span></div>
      {walletAddress ? <><span className="wallet-address">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)} {ownedCount !== null && <b>· {ownedCount} owned</b>}</span><button className="quiet-button" onClick={disconnectWallet}>Disconnect</button></> : <button className="outline-button" onClick={verifyWallet} disabled={busy}>{busy ? 'Checking…' : 'Connect & verify'}</button>}
      {walletMessage && <span className="wallet-message" role="status">{walletMessage}</span>}
    </section>

    {view === 'studio' ? <section className="workspace">
      <aside className="asset-panel">
        <div className="panel-heading"><div><p className="overline">BROWSE COLLECTION</p><h2>Genesis NFTs</h2></div><span className="result-count">{filteredAssets.length.toLocaleString()}</span></div>
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, token, or trait" aria-label="Search Chog NFTs"/></label>
        <div className="trait-filters"><select value={traitType} onChange={event => { setTraitType(event.target.value); setTraitValue('') }} aria-label="Filter trait type"><option value="">All traits</option>{types.map(type => <option key={type}>{type}</option>)}</select><select value={traitValue} onChange={event => setTraitValue(event.target.value)} aria-label="Filter trait value"><option value="">Any value</option>{values.map(value => <option key={value}>{value}</option>)}</select></div>
        <div className="asset-grid" aria-live="polite">
          {pageAssets.map(asset => <button key={asset.tokenId} className={`asset-card ${selectedToken === asset.tokenId ? 'selected' : ''}`} onClick={() => setSelectedToken(asset.tokenId)} onDoubleClick={() => addAsset(asset)} title={`${asset.name} · token ${asset.tokenId}`}>
            <img src={asset.imageUrl} crossOrigin="anonymous" loading="lazy" alt={`${asset.name}, Chog Genesis token ${asset.tokenId}`} onLoad={() => rememberImage(asset.tokenId)} onError={event => { const target = event.currentTarget; const fallback = ipfsFallback(asset.imageUrl); if (fallback && target.src !== fallback) target.src = fallback }}/>
            <span className="asset-name">{asset.name}</span><span className="asset-id">TOKEN {asset.tokenId}</span>
          </button>)}
          {pageAssets.length === 0 && <div className="empty-assets">{manifest?.assets.length ? 'No Chog NFTs match those filters.' : 'No verified collection assets are in the manifest yet.'}</div>}
        </div>
        <div className="asset-footer"><span>Page {Math.min(page + 1, Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE)))} / {Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE))}</span><div><button disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>←</button><button disabled={(page + 1) * PAGE_SIZE >= filteredAssets.length} onClick={() => setPage(current => current + 1)}>→</button></div></div>
        <div className="selected-asset"><div>{selectedAsset ? <><strong>{selectedAsset.name}</strong><span>Token {selectedAsset.tokenId} · {selectedAsset.attributes.length} real metadata traits</span><a href={selectedAsset.openseaUrl} target="_blank" rel="noreferrer">View NFT on OpenSea ↗</a></> : <><strong>Select a Chog NFT</strong><span>Click an image to inspect; double-click to add it.</span></>}</div><button disabled={!selectedAsset} onClick={() => addAsset()}>Add layer +</button></div>
      </aside>

      <section className="editor-panel">
        <div className="editor-heading"><div><p className="overline">COMPOSITION CANVAS · 1:1</p><input className="composition-title" value={composition.title} onChange={event => setComposition(current => ({ ...current, title: event.target.value }))} aria-label="Composition title"/></div><div className="editor-actions"><button className="quiet-button" onClick={randomize} disabled={!manifest?.assets.length}>Randomize</button><button className="quiet-button" onClick={saveComposition}>Save</button><button className="export-button" onClick={exportPng}>Export PNG ↓</button></div></div>
        <div className="canvas-holder" ref={stageRef} onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp}>
          <CompositionCanvas composition={composition} assets={assets} className="editor-canvas" onImageLoaded={rememberCanvasImage} onImageError={tokenId => setNotice(`Could not load the image for token ${tokenId}. Try again after the gateway recovers.`)}/>
          {activeLayer && <div className="selection-box" style={{ left: `${activeLayer.x}%`, top: `${activeLayer.y}%`, width: `${activeLayer.width}%`, height: `${activeLayer.height}%`, transform: `rotate(${activeLayer.rotation}deg)` }} aria-label={`Selected layer ${selectedDisplayName}`}><span>{selectedDisplayName}</span><button data-resize-handle onPointerDown={event => onResizeDown(event, activeLayer)} aria-label="Resize selected layer" title="Drag to resize"/></div>}
          {!composition.layers.length && <div className="canvas-empty"><span>＋</span><strong>Your canvas is clear</strong><small>Select a real Chog NFT from the collection to start.</small></div>}
        </div>
        <div className="canvas-caption"><span>{composition.layers.length} layer{composition.layers.length === 1 ? '' : 's'}</span><span>Drag artwork to reposition · drag the corner to resize</span><span>1024 × 1024 PNG</span></div>

        <div className="tools-grid">
          <section className="tool-card"><div className="tool-title"><span>01</span><strong>Background</strong></div><div className="backgrounds">{BACKGROUNDS.map(color => <button key={color} className={composition.background === color ? 'chosen' : ''} style={{ backgroundColor: color }} onClick={() => setComposition(current => ({ ...current, background: color }))} aria-label={`Set background ${color}`} title={color}/ >)}<label className="custom-color" title="Choose a custom background"><input type="color" value={composition.background} onChange={event => setComposition(current => ({ ...current, background: event.target.value }))}/><span>＋</span></label></div></section>
          <section className="tool-card"><div className="tool-title"><span>02</span><strong>Text overlay</strong></div><div className="text-add"><input value={overlayText} onChange={event => setOverlayText(event.target.value)} placeholder="Add your own text" maxLength={90}/><button onClick={addText} disabled={!overlayText.trim()}>Add</button></div></section>
        </div>

        <section className="layers-panel"><div className="layers-heading"><div><p className="overline">STACK ORDER</p><h3>Layers <span>{composition.layers.length}</span></h3></div><button className="quiet-button" onClick={() => setComposition(newComposition())}>Clear canvas</button></div>
          {!composition.layers.length ? <p className="layers-empty">Your NFT images, overlays, and text will appear here.</p> : <div className="layer-list">{[...composition.layers].reverse().map(layer => <div className={`layer-row ${selectedLayer === layer.id ? 'current' : ''}`} key={layer.id} onClick={() => setSelectedLayer(layer.id)}>
            <span className="layer-icon">{layer.kind === 'image' ? '▧' : 'T'}</span><strong>{layer.kind === 'image' ? assets.get(layer.tokenId)?.name || `Token ${layer.tokenId}` : layer.text}</strong>
            <button title="Move layer up" aria-label="Move layer up" onClick={event => { event.stopPropagation(); setComposition(current => { const index = current.layers.findIndex(item => item.id === layer.id); if (index < 0 || index === current.layers.length - 1) return current; const next = [...current.layers]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return { ...current, layers: next } }) }}>↑</button>
            <button title="Move layer down" aria-label="Move layer down" onClick={event => { event.stopPropagation(); setComposition(current => { const index = current.layers.findIndex(item => item.id === layer.id); if (index <= 0) return current; const next = [...current.layers]; [next[index], next[index - 1]] = [next[index - 1], next[index]]; return { ...current, layers: next } }) }}>↓</button>
            <button className="delete-layer" title="Remove layer" aria-label="Remove layer" onClick={event => { event.stopPropagation(); setComposition(current => ({ ...current, layers: current.layers.filter(item => item.id !== layer.id) })); if (selectedLayer === layer.id) setSelectedLayer('') }}>×</button>
          </div>)}</div>}
        </section>

        {activeLayer && <section className="layer-properties"><div className="layers-heading"><div><p className="overline">SELECTED ELEMENT</p><h3>{selectedDisplayName}</h3></div>{activeLayer.kind === 'image' && <label className="fit-toggle">Fit<select value={activeLayer.fit} onChange={event => setLayer(activeLayer.id, { fit: event.target.value as 'contain'|'cover' })}><option value="contain">Contain</option><option value="cover">Crop / cover</option></select></label>}</div>
          <div className="property-controls"><label>Width <input type="range" min="8" max="180" value={activeLayer.width} onChange={event => setLayer(activeLayer.id, { width: Number(event.target.value) })}/><output>{Math.round(activeLayer.width)}%</output></label><label>Rotation <input type="range" min="-180" max="180" value={activeLayer.rotation} onChange={event => setLayer(activeLayer.id, { rotation: Number(event.target.value) })}/><output>{activeLayer.rotation}°</output></label></div>
          {activeLayer.kind === 'text' && <label className="text-color-row">Overlay color <input type="color" value={activeLayer.color} onChange={event => setLayer(activeLayer.id, { color: event.target.value })}/><input className="text-value" value={activeLayer.text} onChange={event => setLayer(activeLayer.id, { text: event.target.value })}/></label>}
        </section>}
      </section>
    </section> : <section className="saved-view"><div className="saved-heading"><div><p className="overline">PRIVATE TO THIS BROWSER</p><h2>My remixes</h2></div><button className="export-button" onClick={() => { setComposition(newComposition()); setView('studio') }}>New composition +</button></div>
      {!saved.length ? <div className="saved-empty"><span>▧</span><h3>No saved remixes yet</h3><p>Build a composition from real Chog Genesis images and save it here. Saved entries stay in this browser.</p><button className="export-button" onClick={() => setView('studio')}>Open the studio</button></div> : <div className="saved-grid">{saved.map(item => <article className="saved-card" key={item.id}><CompositionCanvas composition={item} assets={assets} className="saved-canvas"/><div className="saved-card-meta"><div><strong>{item.title}</strong><span>{item.layers.filter(layer => layer.kind === 'image').length} NFT image layer(s) · {new Date(item.createdAt).toLocaleDateString()}</span></div><button onClick={() => { setComposition({ ...item, id: uid() }); setSelectedLayer(''); setView('studio') }}>Remix ↗</button></div><button className="remove-save" onClick={() => { const next = saved.filter(save => save.id !== item.id); setSaved(next); localStorage.setItem(SAVES_KEY, JSON.stringify(next)) }}>Remove</button></article>)}</div>}
    </section>}

    <footer className="site-footer"><span>Chog Genesis · Monad mainnet</span><span>Original NFT images remain unchanged; all elements are complete collection artwork.</span><a href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer">Collection source ↗</a></footer>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
  </main>
}
