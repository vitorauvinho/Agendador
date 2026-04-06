import { useState, useEffect, useRef } from 'react'
import AnalistaLayout from '../components/AnalistaLayout.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function getYoutubeId(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match ? match[1] : null
}

let ytApiLoaded = false
function loadYTApi() {
  if (ytApiLoaded || window.YT) return
  ytApiLoaded = true
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}

export default function MinhasTrilhas() {
  const { analyst: authAnalyst } = useAuth()
  const [analyst, setAnalyst] = useState(null)
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState({})
  const [playing, setPlaying] = useState(null)

  const [watchPct, setWatchPct] = useState(0)
  const [canMark, setCanMark] = useState(false)
  const playerRef = useRef(null)
  const intervalRef = useRef(null)
  const iframeId = 'yt-player-frame'

  useEffect(() => { if (authAnalyst?.id) loadAll() }, [authAnalyst])
  useEffect(() => { if (selected) loadItems(selected.id) }, [selected])

  useEffect(() => {
    setWatchPct(0)
    setCanMark(false)
    clearInterval(intervalRef.current)
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch (_) {}
      playerRef.current = null
    }
  }, [playing?.id])

  useEffect(() => {
    if (!playing || playing.type !== 'youtube') return
    const ytId = getYoutubeId(playing.url)
    if (!ytId) return
    loadYTApi()
    const init = () => {
      if (!window.YT || !window.YT.Player) { setTimeout(init, 300); return }
      setTimeout(() => {
        try {
          playerRef.current = new window.YT.Player(iframeId, {
            events: {
              onReady: () => startTracking(),
              onStateChange: (e) => { if (e.data === 1) startTracking(); else stopTracking() }
            }
          })
        } catch (_) {}
      }, 500)
    }
    if (window.YT && window.YT.Player) { init() } else { window.onYouTubeIframeAPIReady = init }
    return () => stopTracking()
  }, [playing?.id])

  function startTracking() {
    stopTracking()
    intervalRef.current = setInterval(() => {
      try {
        const player = playerRef.current
        if (!player) return
        const current = player.getCurrentTime()
        const total = player.getDuration()
        if (!total || total === 0) return
        const pct = Math.round((current / total) * 100)
        setWatchPct(pct)
        if (pct >= 90) { setCanMark(true); stopTracking() }
      } catch (_) {}
    }, 3000)
  }

  function stopTracking() { clearInterval(intervalRef.current) }

  async function loadAll() {
    const { data: a } = await supabase.from('analysts').select('*').eq('id', authAnalyst.id).single()
    if (!a) { setLoading(false); return }
    setAnalyst(a)
    const { data: t } = await supabase.from('video_trails').select('*, video_trail_items(id)')
      .or(`team.eq.${a.team},team.eq.ambos`).order('order_index')
    const { data: prog } = await supabase.from('video_trail_progress').select('*').eq('analyst_id', a.id)
    const progMap = {}
    ;(prog || []).forEach(p => { progMap[p.item_id] = p })
    setProgress(progMap)
    setTrails(t || [])
    setLoading(false)
  }

  async function loadItems(trailId) {
    const { data } = await supabase.from('video_trail_items').select('*').eq('trail_id', trailId).order('order_index')
    setItems(data || [])
  }

  async function markWatched(item) {
    if (progress[item.id]?.watched) return
    await supabase.from('video_trail_progress').upsert(
      { analyst_id: analyst.id, trail_id: selected.id, item_id: item.id, watched: true, watched_at: new Date().toISOString() },
      { onConflict: 'analyst_id,item_id' }
    )
    setProgress(p => ({ ...p, [item.id]: { watched: true } }))
    setPlaying(null); setWatchPct(0); setCanMark(false)
  }

  function trailProgress(trail) {
    const total = trail.video_trail_items?.length || 0
    const done = (trail.video_trail_items || []).filter(i => progress[i.id]?.watched).length
    return { total, done, pct: total ? Math.round(done / total * 100) : 0 }
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  if (!analyst) return (
    <div className="loading-screen">
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 16, color: 'var(--muted2)', marginTop: 8 }}>Acesso não autorizado</div>
    </div>
  )

  return (
    <>
      <AnalistaLayout analystName={analyst.name} analystTeam={analyst.team}>
        <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Minhas <span style={{ color: 'var(--auvo)' }}>trilhas</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Assista os vídeos e acompanhe seu progresso</div>
          </div>

          {trails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 14, color: 'var(--muted2)' }}>Nenhuma trilha disponível ainda</div>
            </div>
          ) : !selected ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' }}>
              {trails.map(trail => {
                const { total, done, pct } = trailProgress(trail)
                return (
                  <div key={trail.id} onClick={() => setSelected(trail)}
                    style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--auvo-border)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                    <div style={{ height: 90, background: 'linear-gradient(135deg, var(--auvo-dim), rgba(16,185,129,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, position: 'relative' }}>
                      🎬
                      {pct === 100 && <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--green)', color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>✓ Concluída</div>}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{trail.title}</div>
                      {trail.description && <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 10, lineHeight: 1.5 }}>{trail.description}</div>}
                      <div className="flex justify-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: 'var(--muted2)' }}>{done}/{total} vídeos</span>
                        <span style={{ fontSize: 10, color: pct === 100 ? 'var(--green)' : 'var(--auvo)', fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, background: pct === 100 ? 'var(--green)' : 'var(--auvo)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              <button className="btn btn-sm" style={{ marginBottom: 16, fontSize: 11 }} onClick={() => { setSelected(null); setPlaying(null) }}>← Voltar às trilhas</button>

              <div style={{ background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selected.title}</div>
                {selected.description && <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>{selected.description}</div>}
                {(() => {
                  const { total, done, pct } = trailProgress(selected)
                  return (
                    <div>
                      <div className="flex justify-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{done} de {total} vídeos assistidos</span>
                        <span style={{ fontSize: 11, color: pct === 100 ? 'var(--green)' : 'var(--auvo)', fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, background: pct === 100 ? 'var(--green)' : 'var(--auvo)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })()}
              </div>

              {playing && (
                <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--auvo-border)' }}>
                  <div style={{ background: 'var(--auvo-dim)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--auvo)' }}>▶ {playing.title}</span>
                    <button onClick={() => { setPlaying(null); stopTracking() }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                  {playing.type === 'youtube' && getYoutubeId(playing.url) ? (
                    <div>
                      <iframe id={iframeId} width="100%" height="400"
                        src={`https://www.youtube.com/embed/${getYoutubeId(playing.url)}?autoplay=1&enablejsapi=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`}
                        frameBorder="0" allowFullScreen allow="autoplay" style={{ display: 'block', borderRadius: 0 }} title={playing.title} />
                      <div style={{ padding: '8px 14px 0', background: 'var(--surface2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 9, color: 'var(--muted2)' }}>
                            {canMark ? '✓ Pode marcar como assistido!' : `Assista pelo menos 90% · ${watchPct}% assistido`}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: canMark ? 'var(--green)' : 'var(--auvo)' }}>{watchPct}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ height: '100%', borderRadius: 4, background: canMark ? 'var(--green)' : 'var(--auvo)', width: `${watchPct}%`, transition: 'width 1s ease' }} />
                        </div>
                      </div>
                      <div style={{ padding: '0 14px 10px', background: 'var(--surface2)' }}>
                        {progress[playing.id]?.watched ? (
                          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Já assistido</span>
                        ) : canMark ? (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, width: '100%' }} onClick={() => markWatched(playing)}>✓ Marcar como assistido e fechar</button>
                        ) : (
                          <button className="btn btn-sm" style={{ fontSize: 11, width: '100%', opacity: 0.5, cursor: 'not-allowed' }} disabled>🔒 Assista {90 - watchPct}% mais para liberar</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface2)', padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, marginBottom: 12 }}>🎬 {playing.title}</div>
                      <a href={playing.url} target="_blank" rel="noreferrer" className="btn btn-primary">Abrir vídeo →</a>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, idx) => {
                  const watched = progress[item.id]?.watched
                  const isPlaying = playing?.id === item.id
                  const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null
                  return (
                    <div key={item.id} onClick={() => setPlaying(playing?.id === item.id ? null : item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${isPlaying ? 'var(--auvo-border)' : watched ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`, borderRadius: 10, background: isPlaying ? 'var(--auvo-dim)' : watched ? 'rgba(16,185,129,0.04)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.borderColor = watched ? 'rgba(16,185,129,0.2)' : 'var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</div>
                      {ytId ? (
                        <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: 56, height: 36, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} alt="" />
                      ) : (
                        <div style={{ width: 56, height: 36, borderRadius: 5, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>🎬</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: watched ? 'line-through' : 'none', color: watched ? 'var(--muted)' : 'var(--text)' }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: item.type === 'youtube' ? 'var(--red-dim)' : 'var(--blue-dim)', color: item.type === 'youtube' ? 'var(--red)' : 'var(--blue)' }}>
                            {item.type === 'youtube' ? 'YouTube' : 'Gravado'}
                          </span>
                          {item.duration && <span style={{ fontSize: 9, color: 'var(--muted)' }}>⏱ {item.duration}</span>}
                        </div>
                      </div>
                      {watched ? (
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
                      ) : isPlaying && watchPct > 0 ? (
                        <span style={{ fontSize: 10, color: 'var(--auvo)', flexShrink: 0, fontWeight: 600 }}>{watchPct}%</span>
                      ) : (
                        <span style={{ fontSize: 20, flexShrink: 0, color: 'var(--auvo)' }}>▶</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </AnalistaLayout>
    </>
  )
}
