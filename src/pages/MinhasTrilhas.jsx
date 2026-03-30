import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AnalistaLayout from '../components/AnalistaLayout.jsx'
import { supabase } from '../lib/supabase'

function getYoutubeId(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match ? match[1] : null
}

export default function MinhasTrilhas() {
  const { token } = useParams()
  const [analyst, setAnalyst] = useState(null)
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState({})
  const [playing, setPlaying] = useState(null)

  useEffect(() => { loadAll() }, [token])
  useEffect(() => { if (selected) loadItems(selected.id) }, [selected])

  async function loadAll() {
    const { data: a } = await supabase.from('analysts').select('*').eq('access_token', token).single()
    if (!a) { setLoading(false); return }
    setAnalyst(a)

    const { data: t } = await supabase.from('video_trails').select('*, video_trail_items(id)')
      .or(`team.eq.${a.team},team.eq.ambos`).order('order_index')

    const { data: prog } = await supabase.from('video_trail_progress')
      .select('*').eq('analyst_id', a.id)

    const progMap = {}
    ;(prog || []).forEach(p => { progMap[p.item_id] = p })
    setProgress(progMap)
    setTrails(t || [])
    setLoading(false)
  }

  async function loadItems(trailId) {
    const { data } = await supabase.from('video_trail_items').select('*')
      .eq('trail_id', trailId).order('order_index')
    setItems(data || [])
  }

  async function markWatched(item) {
    if (progress[item.id]?.watched) return
    await supabase.from('video_trail_progress').upsert(
      { analyst_id: analyst.id, trail_id: selected.id, item_id: item.id, watched: true, watched_at: new Date().toISOString() },
      { onConflict: 'analyst_id,item_id' }
    )
    setProgress(p => ({ ...p, [item.id]: { watched: true } }))
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
      <div style={{ fontSize: 16, color: 'var(--muted2)', marginTop: 8 }}>Link inválido</div>
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
            // Trail list
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' }}>
              {trails.map(trail => {
                const { total, done, pct } = trailProgress(trail)
                return (
                  <div key={trail.id}
                    onClick={() => setSelected(trail)}
                    style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--auvo-border)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ height: 90, background: 'linear-gradient(135deg, var(--auvo-dim), rgba(16,185,129,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, position: 'relative' }}>
                      🎬
                      {pct === 100 && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--green)', color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>✓ Concluída</div>
                      )}
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
            // Trail detail
            <div>
              <button className="btn btn-sm" style={{ marginBottom: 16, fontSize: 11 }} onClick={() => { setSelected(null); setPlaying(null) }}>
                ← Voltar às trilhas
              </button>

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

              {/* Video player */}
              {playing && (
                <div style={{ marginBottom: 20 }}>
                  {playing.type === 'youtube' && getYoutubeId(playing.url) ? (
                    <iframe width="100%" height="400" src={`https://www.youtube.com/embed/${getYoutubeId(playing.url)}?autoplay=1`}
                      frameBorder="0" allowFullScreen allow="autoplay" style={{ borderRadius: 12 }} title={playing.title} />
                  ) : (
                    <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, marginBottom: 12 }}>🎬 {playing.title}</div>
                      <a href={playing.url} target="_blank" rel="noreferrer" className="btn btn-primary">Abrir vídeo →</a>
                    </div>
                  )}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{playing.title}</div>
                    {!progress[playing.id]?.watched ? (
                      <button className="btn btn-primary btn-sm" onClick={() => markWatched(playing)}>✓ Marcar como assistido</button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Assistido</span>
                    )}
                  </div>
                </div>
              )}

              {/* Items list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, idx) => {
                  const watched = progress[item.id]?.watched
                  const isPlaying = playing?.id === item.id
                  const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null
                  return (
                    <div key={item.id}
                      onClick={() => setPlaying(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${isPlaying ? 'var(--auvo-border)' : watched ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`, borderRadius: 10, background: isPlaying ? 'var(--auvo-dim)' : watched ? 'rgba(16,185,129,0.04)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.borderColor = watched ? 'rgba(16,185,129,0.2)' : 'var(--border)' }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</div>
                      {ytId ? (
                        <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: 56, height: 36, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} alt="" />
                      ) : (
                        <div style={{ width: 56, height: 36, borderRadius: 5, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>🎬</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: watched ? 'line-through' : 'none', color: watched ? 'var(--muted)' : 'var(--text)' }}>
                          {item.title}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: item.type === 'youtube' ? 'var(--red-dim)' : 'var(--blue-dim)', color: item.type === 'youtube' ? 'var(--red)' : 'var(--blue)' }}>
                            {item.type === 'youtube' ? 'YouTube' : 'Gravado'}
                          </span>
                          {item.duration && <span style={{ fontSize: 9, color: 'var(--muted)' }}>⏱ {item.duration}</span>}
                        </div>
                      </div>
                      {watched ? (
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
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
