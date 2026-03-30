import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getYoutubeId(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match ? match[1] : null
}

const EMPTY_TRAIL = { title: '', description: '', cover_url: '', team: 'atendimento', order_index: 0 }
const EMPTY_ITEM  = { title: '', url: '', type: 'youtube', duration: '', order_index: 0 }

export default function Trilhas({ activeTeam }) {
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [showTrailForm, setShowTrailForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingTrail, setEditingTrail] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [trailForm, setTrailForm] = useState(EMPTY_TRAIL)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadTrails() }, [activeTeam])
  useEffect(() => { if (selected) loadItems(selected.id) }, [selected])

  async function loadTrails() {
    setLoading(true)
    const { data } = await supabase.from('video_trails').select('*')
      .or(`team.eq.${activeTeam},team.eq.ambos`).order('order_index').order('created_at')
    setTrails(data || [])
    setLoading(false)
  }

  async function loadItems(trailId) {
    const { data } = await supabase.from('video_trail_items').select('*')
      .eq('trail_id', trailId).order('order_index').order('created_at')
    setItems(data || [])
  }

  async function saveTrail() {
    if (!trailForm.title) return
    setSaving(true)
    if (editingTrail) {
      await supabase.from('video_trails').update(trailForm).eq('id', editingTrail)
    } else {
      const { data } = await supabase.from('video_trails').insert({ ...trailForm, team: trailForm.team || activeTeam }).select().single()
      if (data) setSelected(data)
    }
    setSaving(false)
    setShowTrailForm(false)
    setEditingTrail(null)
    setTrailForm(EMPTY_TRAIL)
    loadTrails()
  }

  async function saveItem() {
    if (!itemForm.title || !itemForm.url) return
    setSaving(true)
    const payload = { ...itemForm, trail_id: selected.id, order_index: editingItem ? itemForm.order_index : items.length }
    if (editingItem) {
      await supabase.from('video_trail_items').update(payload).eq('id', editingItem)
    } else {
      await supabase.from('video_trail_items').insert(payload)
    }
    setSaving(false)
    setShowItemForm(false)
    setEditingItem(null)
    setItemForm(EMPTY_ITEM)
    loadItems(selected.id)
  }

  async function deleteTrail(id) {
    await supabase.from('video_trails').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    setConfirmDelete(null)
    loadTrails()
  }

  async function moveTrail(trail, dir) {
    const idx = trails.findIndex(t => t.id === trail.id)
    const swap = trails[idx + dir]
    if (!swap) return

    // Garante que todos têm order_index sequencial antes de trocar
    const newOrderA = idx + dir
    const newOrderB = idx

    await Promise.all([
      supabase.from('video_trails').update({ order_index: newOrderA }).eq('id', trail.id),
      supabase.from('video_trails').update({ order_index: newOrderB }).eq('id', swap.id),
    ])
    loadTrails()
  }

  async function deleteItem(id) {
    await supabase.from('video_trail_items').delete().eq('id', id)
    setConfirmDelete(null)
    loadItems(selected.id)
  }

  async function moveItem(item, dir) {
    const idx = items.findIndex(i => i.id === item.id)
    const swap = items[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('video_trail_items').update({ order_index: swap.order_index }).eq('id', item.id),
      supabase.from('video_trail_items').update({ order_index: item.order_index }).eq('id', swap.id),
    ])
    loadItems(selected.id)
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Trilhas <span style={{ color: 'var(--auvo)' }}>de vídeo</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Crie playlists sequenciais para os analistas</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setTrailForm({ ...EMPTY_TRAIL, team: activeTeam }); setEditingTrail(null); setShowTrailForm(true) }}>
          + Nova trilha
        </button>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, flex: 1, overflow: 'hidden' }}>

          {/* Trail list */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {trails.length} trilha{trails.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 9, color: 'var(--muted)' }}>↑↓ para reordenar</span>
            </div>
            {trails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                <div style={{ fontSize: 12 }}>Nenhuma trilha ainda</div>
              </div>
            ) : trails.map(t => (
              <div key={t.id}
                onClick={() => setSelected(t)}
                style={{ padding: '10px 12px', borderRadius: 9, cursor: 'pointer', marginBottom: 6, border: `1px solid ${selected?.id === t.id ? 'var(--auvo-border)' : 'var(--border)'}`, background: selected?.id === t.id ? 'var(--auvo-dim)' : 'var(--surface2)', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
                  {t.team === 'ambos' ? '🌐 Ambos' : t.team === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'}
                </div>
                {t.description && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                <div className="flex gap-2" style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 6px' }}
                    disabled={trails.indexOf(t) === 0}
                    onClick={() => moveTrail(t, -1)}>↑</button>
                  <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 6px' }}
                    disabled={trails.indexOf(t) === trails.length - 1}
                    onClick={() => moveTrail(t, 1)}>↓</button>
                  <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => { setTrailForm({ ...t }); setEditingTrail(t.id); setShowTrailForm(true) }}>✏️ Editar</button>
                  {confirmDelete === `trail_${t.id}` ? (
                    <>
                      <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteTrail(t.id)}>Sim</button>
                      <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                    </>
                  ) : (
                    <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDelete(`trail_${t.id}`)}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trail items */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
                <div style={{ fontSize: 36 }}>👈</div>
                <div style={{ fontSize: 13 }}>Selecione uma trilha</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.title}</div>
                    {selected.description && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{selected.description}</div>}
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{items.length} vídeo{items.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setItemForm(EMPTY_ITEM); setEditingItem(null); setShowItemForm(true) }}>
                    + Adicionar vídeo
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>▶️</div>
                      <div style={{ fontSize: 12 }}>Nenhum vídeo na trilha ainda</div>
                    </div>
                  ) : items.map((item, idx) => {
                    const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
                        <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 700, width: 24, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</div>
                        {ytId ? (
                          <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: 60, height: 38, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} alt="" />
                        ) : (
                          <div style={{ width: 60, height: 38, borderRadius: 5, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🎬</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: item.type === 'youtube' ? 'var(--red-dim)' : 'var(--blue-dim)', color: item.type === 'youtube' ? 'var(--red)' : 'var(--blue)' }}>
                              {item.type === 'youtube' ? 'YouTube' : 'Gravado'}
                            </span>
                            {item.duration && <span style={{ fontSize: 9, color: 'var(--muted)' }}>⏱ {item.duration}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 7px' }} disabled={idx === 0} onClick={() => moveItem(item, -1)}>↑</button>
                          <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 7px' }} disabled={idx === items.length - 1} onClick={() => moveItem(item, 1)}>↓</button>
                          <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => { setItemForm({ ...item }); setEditingItem(item.id); setShowItemForm(true) }}>✏️</button>
                          {confirmDelete === `item_${item.id}` ? (
                            <>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteItem(item.id)}>Sim</button>
                              <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                            </>
                          ) : (
                            <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDelete(`item_${item.id}`)}>🗑️</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Nova/Editar Trilha */}
      {showTrailForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTrailForm(false)}>
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-header">
              <div className="modal-title">{editingTrail ? 'Editar trilha' : 'Nova trilha'}</div>
              <button className="modal-close" onClick={() => setShowTrailForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título da trilha</label>
                <input value={trailForm.title} onChange={e => setTrailForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Módulo PMOC — Fundamentos" />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <textarea value={trailForm.description} onChange={e => setTrailForm(f => ({ ...f, description: e.target.value }))} placeholder="Sobre o que é essa trilha?" style={{ minHeight: 60, resize: 'none' }} />
              </div>
              <div className="form-group">
                <label>Disponível para</label>
                <div className="flex gap-2">
                  {[['atendimento', '🎧 Atendimento'], ['vendas', '💼 Vendas'], ['ambos', '🌐 Ambos']].map(([k, l]) => (
                    <button key={k} onClick={() => setTrailForm(f => ({ ...f, team: k }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, border: `1px solid ${trailForm.team === k ? 'var(--auvo-border)' : 'var(--border)'}`, background: trailForm.team === k ? 'var(--auvo-dim)' : 'transparent', color: trailForm.team === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowTrailForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTrail} disabled={saving || !trailForm.title}>
                {saving ? 'Salvando...' : editingTrail ? 'Salvar' : 'Criar trilha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar/Editar Vídeo */}
      {showItemForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowItemForm(false)}>
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-header">
              <div className="modal-title">{editingItem ? 'Editar vídeo' : 'Adicionar vídeo'}</div>
              <button className="modal-close" onClick={() => setShowItemForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo</label>
                <div className="flex gap-2">
                  {[['youtube', '▶️ YouTube'], ['gravado', '🎬 Treinamento Gravado']].map(([k, l]) => (
                    <button key={k} onClick={() => setItemForm(f => ({ ...f, type: k }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, border: `1px solid ${itemForm.type === k ? 'var(--auvo-border)' : 'var(--border)'}`, background: itemForm.type === k ? 'var(--auvo-dim)' : 'transparent', color: itemForm.type === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Título do vídeo</label>
                <input value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Introdução ao PMOC" />
              </div>
              <div className="form-group">
                <label>URL do vídeo</label>
                <input value={itemForm.url} onChange={e => setItemForm(f => ({ ...f, url: e.target.value }))} placeholder="https://youtube.com/watch?v=... ou link do Drive" />
                {itemForm.type === 'youtube' && getYoutubeId(itemForm.url) && (
                  <img src={`https://img.youtube.com/vi/${getYoutubeId(itemForm.url)}/mqdefault.jpg`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 7, marginTop: 8 }} alt="" />
                )}
              </div>
              <div className="form-group">
                <label>Duração (opcional)</label>
                <input value={itemForm.duration} onChange={e => setItemForm(f => ({ ...f, duration: e.target.value }))} placeholder="Ex: 12:30" style={{ width: 120 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowItemForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={saving || !itemForm.title || !itemForm.url}>
                {saving ? 'Salvando...' : editingItem ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
