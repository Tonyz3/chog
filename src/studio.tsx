import { useMemo, useState } from 'react'

type Remix = { id: number; bg: string; fur: string; eyes: string; accessory: string; title: string }
const backgrounds = [
  { name: 'Moss field', value: '#c8ef7b' }, { name: 'Lilac dusk', value: '#c6a8ed' },
  { name: 'Peach soda', value: '#f5a78f' }, { name: 'Pool day', value: '#82d9d1' },
]
const furs = [{ name: 'Chlorophyll', value: '#397e51' }, { name: 'Blueberry', value: '#555a9f' }, { name: 'Tangerine', value: '#cf7046' }, { name: 'Cream puff', value: '#d3bd8b' }]
const demoGallery: Remix[] = [
  { id: 1, bg: '#c6a8ed', fur: '#397e51', eyes: 'star', accessory: 'cap', title: 'Sunday sprout' },
  { id: 2, bg: '#f5a78f', fur: '#555a9f', eyes: 'round', accessory: 'flower', title: 'Berry good day' },
  { id: 3, bg: '#82d9d1', fur: '#cf7046', eyes: 'sleepy', accessory: 'none', title: 'Poolside pal' },
]

function Chog({ remix, id }: { remix: Remix; id: string }) {
  const eyes = remix.eyes === 'star' ? <><path d="M39 53l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8zM78 53l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" fill="#252a21"/></> : remix.eyes === 'sleepy' ? <><path d="M34 61q7 8 14 0M73 61q7 8 14 0" fill="none" stroke="#252a21" strokeWidth="4" strokeLinecap="round"/></> : <><ellipse cx="42" cy="61" rx="4" ry="6" fill="#252a21"/><ellipse cx="80" cy="61" rx="4" ry="6" fill="#252a21"/></>
  return <svg id={id} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your Chog remix preview">
    <defs><clipPath id={`clip-${id}`}><rect width="120" height="120" rx="20"/></clipPath></defs>
    <g clipPath={`url(#clip-${id})`}><rect width="120" height="120" fill={remix.bg}/><circle cx="94" cy="25" r="13" fill="#ffffff" opacity=".26"/><path d="M0 102Q34 79 67 101T130 96V130H0Z" fill="#ffffff" opacity=".22"/>
      <path d="M35 37 25 16q-2-8 6-4l19 14M76 27 91 12q7-4 7 4l-4 25" fill={remix.fur} stroke="#26382a" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M29 61Q28 35 59 34q32 0 32 28v18q0 23-31 23-31 0-31-24Z" fill={remix.fur} stroke="#26382a" strokeWidth="2.5"/>
      <ellipse cx="60" cy="76" rx="17" ry="13" fill="#e9dbb9" opacity=".94"/>{eyes}<ellipse cx="60" cy="73" rx="3" ry="2.5" fill="#28271f"/><path d="M57 80q3 4 6 0" fill="none" stroke="#6d4b3a" strokeWidth="1.5" strokeLinecap="round"/>
      {remix.accessory === 'cap' && <g><path d="M31 42q27-25 58 0l-8 7q-24-14-43 1Z" fill="#f1ba5c" stroke="#26382a" strokeWidth="2.5"/><path d="M72 44q20-4 27 3-10 7-22 4" fill="#e99947" stroke="#26382a" strokeWidth="2"/></g>}
      {remix.accessory === 'flower' && <g transform="translate(87 35)">{[0,1,2,3,4].map((i)=><ellipse key={i} cx="0" cy="-7" rx="3.5" ry="6" fill="#fff4ec" transform={`rotate(${i*72})`}/>)}<circle r="3.4" fill="#e59c3f"/></g>}
      <path d="M40 98q2 10 20 10t20-10" fill="#f6e8c9" stroke="#26382a" strokeWidth="2"/>
    </g></svg>
}

export default function App() {
  const [remix, setRemix] = useState<Remix>({ ...demoGallery[0], id: Date.now(), title: 'Untitled chog' })
  const [credits, setCredits] = useState(3)
  const [connected, setConnected] = useState(false)
  const [tab, setTab] = useState<'studio'|'gallery'>('studio')
  const [saved, setSaved] = useState<Remix[]>(demoGallery)
  const [notice, setNotice] = useState('')
  const choices = useMemo(() => ({ bg: backgrounds, fur: furs }), [])
  const update = (key: keyof Remix, value: string) => setRemix(current => ({ ...current, [key]: value }))
  const randomize = () => {
    setRemix(current => ({ ...current, id: Date.now(), bg: backgrounds[Math.floor(Math.random()*backgrounds.length)].value, fur: furs[Math.floor(Math.random()*furs.length)].value, eyes: ['round','star','sleepy'][Math.floor(Math.random()*3)], accessory: ['none','cap','flower'][Math.floor(Math.random()*3)] }))
    setNotice('Composition shuffled. Make it yours, then generate.')
  }
  const generate = () => {
    if (credits < 1) { setNotice('You are out of demo credits. Simulate a demo burn to add five.'); return }
    setCredits(value => value - 1)
    const item = { ...remix, id: Date.now() }
    setRemix(item); setSaved(current => [item, ...current]); setNotice('Remix generated and saved in this browser.')
  }
  const burnDemo = () => { setCredits(value => value + 5); setNotice('DEMO ONLY · Simulated burn added five demo credits. No wallet or NFT was used.') }
  const download = async () => {
    const svg = document.getElementById('art-export')
    if (!svg) return
    const source = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024
      const context = canvas.getContext('2d')
      if (context) { context.drawImage(image, 0, 0, 1024, 1024); canvas.toBlob(blob => { if (blob) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='my-chog-remix.png'; a.click(); URL.revokeObjectURL(a.href) } }, 'image/png') }
      URL.revokeObjectURL(url)
    }
    image.onerror = () => { URL.revokeObjectURL(url); setNotice('Export failed. Please try again.') }
    image.src = url
  }
  const gallery = tab === 'gallery' ? saved : saved.slice(0,3)

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">c</span><span>chog<span className="brand-light">studio</span></span></a><nav><button className={tab==='studio'?'nav-active':''} onClick={()=>setTab('studio')}>Studio</button><button className={tab==='gallery'?'nav-active':''} onClick={()=>setTab('gallery')}>Explore</button></nav><div className="top-actions"><span className="demo-pill"><i/> DEMO MODE</span><button className="wallet-btn" onClick={()=>{setConnected(!connected); setNotice(connected?'Demo wallet disconnected.':'Demo wallet connected · sample collection access')}}>{connected?'0x71…4A2':'Connect wallet'}<span className="wallet-dot">◉</span></button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow"><span/> CHOG REMIX STUDIO</p><h1>Your Chog.<br/><em>Your world.</em></h1><p className="hero-copy">A little remix magic. Mix a mood, make it yours, and give your profile a new look.</p><div className="hero-actions"><button className="primary" onClick={()=>{setTab('studio');document.getElementById('workbench')?.scrollIntoView({behavior:'smooth'})}}>Open the studio <span>↗</span></button><div className="credit-chip"><span className="credit-icon">✳</span><div><strong>{credits} credits</strong><small>demo balance</small></div></div></div></div>
      <div className="hero-art"><div className="art-shadow"/><div className="art-frame"><Chog remix={remix} id="hero-chog"/></div><span className="sticker sticker-top">100% chog energy</span><span className="sticker sticker-bottom">✳ made by you</span><span className="sparkle">✳</span></div></section>
    <section className="how"><div className="section-kicker">MADE FOR MAKING</div><div className="how-grid"><div><b>01</b><strong>Pick your palette</strong><span>Choose colors and little details.</span></div><div><b>02</b><strong>Make a remix</strong><span>Every new version gets its own vibe.</span></div><div><b>03</b><strong>Take it with you</strong><span>Export a crisp PNG for your profile.</span></div></div></section>
    <section className="workbench" id="workbench"><div className="work-title"><div><div className="section-kicker">THE PLAYGROUND</div><h2>{tab==='studio'?'Build your chog':'The remix shelf'}</h2></div><span className="autosave">● &nbsp;SAVED IN THIS BROWSER</span></div>
    {tab==='studio' ? <div className="editor"><div className="preview"><div className="preview-head"><span>LIVE PREVIEW <small>· 1:1 CANVAS</small></span><button className="icon-btn" title="Shuffle composition" onClick={randomize}>⤨</button></div><div className="canvas-wrap"><div className="canvas"><Chog remix={remix} id="art-preview"/></div><span className="canvas-note">A fresh little friend</span></div><div className="preview-foot"><span>CHOG REMIX <b>#{String(remix.id).slice(-4)}</b></span><button className="text-btn" onClick={download}>↓ &nbsp;Export PNG</button></div></div>
      <div className="controls"><div className="control-head"><div><span className="section-kicker">YOUR CREATION</span><h3>Make it yours</h3></div><button className="reset" onClick={()=>setRemix({...demoGallery[0],id:Date.now(),title:'Untitled chog'})}>Reset ↺</button></div>
        <div className="control-group"><div className="label-row"><label>Background</label><span>01 / COLOR</span></div><div className="swatches">{choices.bg.map(x=><button key={x.name} title={x.name} aria-label={x.name} className={`swatch ${remix.bg===x.value?'selected':''}`} style={{background:x.value}} onClick={()=>update('bg',x.value)}/>)}</div></div>
        <div className="control-group"><div className="label-row"><label>Chog color</label><span>02 / FUR</span></div><div className="swatches">{choices.fur.map(x=><button key={x.name} title={x.name} aria-label={x.name} className={`swatch ${remix.fur===x.value?'selected':''}`} style={{background:x.value}} onClick={()=>update('fur',x.value)}/>)}</div></div>
        <div className="control-group"><div className="label-row"><label>Expression</label><span>03 / MOOD</span></div><div className="segmented">{['round','star','sleepy'].map((x,i)=><button className={remix.eyes===x?'chosen':''} onClick={()=>update('eyes',x)} key={x}>{['Bright','Starry','Sleepy'][i]}</button>)}</div></div>
        <div className="control-group"><div className="label-row"><label>Little extra</label><span>04 / ACCESSORY</span></div><div className="segmented">{['none','cap','flower'].map((x,i)=><button className={remix.accessory===x?'chosen':''} onClick={()=>update('accessory',x)} key={x}>{['None','Cap','Flower'][i]}</button>)}</div></div>
        <div className="access-note"><span>✳</span><p><strong>How credits work</strong><br/>Chog holders can verify ownership to unlock creation credits. Burning can reward five credits only if the official collection supports a verified burn. Wallet checks and burns are simulated in this demo.</p></div>
        <div className="action-row"><button className="secondary" onClick={burnDemo}>Demo burn +5</button><button className="primary generate" onClick={generate}>Generate remix <span>↗</span></button></div>
        <p className="demo-disclaimer">Demo credits and sample Chogs are stored locally. No NFT is verified or burned.</p>
      </div></div> : <div className="gallery-grid">{gallery.length===0?<p>No remixes yet. Make the first one in Studio.</p>:gallery.map((item,i)=><article className="gallery-card" key={item.id}><div className="gallery-art"><Chog remix={item} id={`gallery-${item.id}-${i}`}/></div><div className="gallery-meta"><div><strong>{item.title||'Untitled chog'}</strong><span>Demo remix · just now</span></div><button onClick={()=>{setRemix(item);setTab('studio')}}>Remix ↗</button></div></article>)}</div>}
    </section>
    <section className="access"><div><span className="section-kicker">A CHOG MAKER PASS</span><h2>Made better by Chogs.</h2><p>In the full experience, your Chog collection is your access pass. Verified holders unlock credits to create and explore remixes. This preview uses sample art and a simulated wallet so judges can try the editor right away.</p></div><div className="access-stats"><div><strong>01</strong><span>hold to unlock</span></div><i/><div><strong>05</strong><span>demo burn reward</span></div><i/><div><strong>∞</strong><span>ways to remix</span></div></div></section>
    <footer><a className="brand" href="#top"><span className="brand-mark">c</span><span>chog<span className="brand-light">studio</span></span></a><span>Made for remix people, with a little chog spirit.</span><span className="footer-demo">DEMO BUILD · COLLECTION NOT VERIFIED</span></footer>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    <svg className="export-source" aria-hidden="true"><Chog remix={remix} id="art-export"/></svg>
  </main>
}
