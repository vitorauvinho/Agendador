import { useState, useEffect } from 'react'
import { supabase, TEAM_SESSIONS } from '../lib/supabase'

const CONTENT_TYPES = [
  { key: 'youtube',    label: 'YouTube',         icon: '▶️', color: 'var(--red)' },
  { key: 'pdf',        label: 'Trein. Gravados',  icon: '🎬', color: 'var(--blue)' },
  { key: 'notebooklm', label: 'NotebookLM',       icon: '🤖', color: 'var(--auvo)' },
  { key: 'texto',      label: 'Texto',            icon: '📝', color: 'var(--green)' },
  { key: 'playbook',   label: 'Playbook',         icon: '📘', color: 'var(--amber)' },
  { key: 'link_util',  label: 'Link útil',        icon: '🔗', color: 'var(--teal)' },
]

const TYPE_COLORS = {
  youtube:    { bg: 'var(--red-dim)',   color: 'var(--red)' },
  pdf:        { bg: 'var(--blue-dim)',  color: 'var(--blue)' },
  notebooklm: { bg: 'var(--auvo-dim)', color: 'var(--auvo)' },
  texto:      { bg: 'var(--green-dim)', color: 'var(--green)' },
  playbook:   { bg: 'var(--amber-dim)', color: 'var(--amber)' },
  link_util:  { bg: 'var(--teal-dim)', color: 'var(--teal)' },
}

const EMPTY_FORM = { title: '', description: '', type: 'youtube', url: '', body: '', session_keys: [], team: 'ambos' }

export default function Biblioteca({ activeTeam }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('todos')
  const [sessionFilter, setSessionFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [preview, setPreview] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const allSessions = TEAM_SESSIONS[activeTeam]
  const uniqueDays = [...new Set(allSessions.map(s => s.day))].sort((a,b) => a-b)

  useEffect(() => { loadItems() }, [activeTeam])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('content_items').select('*')
      .or(`team.eq.${activeTeam},team.eq.ambos`)
      .order('order_index').order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!form.title) return
    setSaving(true)
    if (editing) {
      await supabase.from('content_items').update(form).eq('id', editing)
    } else {
      await supabase.from('content_items').insert({ ...form, team: form.team || activeTeam })
    }
    setSaving(false)
    setShowAdd(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    loadItems()
  }

  async function deleteItem(id) {
    await supabase.from('content_items').delete().eq('id', id)
    setConfirmDelete(null)
    loadItems()
  }

  function openEdit(item) {
    setForm({ ...item })
    setEditing(item.id)
    setShowAdd(true)
  }

  function toggleSession(sessionId) {
    setForm(f => ({
      ...f,
      session_keys: f.session_keys?.includes(sessionId)
        ? f.session_keys.filter(k => k !== sessionId)
        : [...(f.session_keys || []), sessionId]
    }))
  }

  function getYoutubeId(url) {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? match[1] : null
  }

  const typeInfo = (type) => CONTENT_TYPES.find(t => t.key === type) || CONTENT_TYPES[0]

  // Filtered items
  const filtered = items.filter(item => {
    const matchType = typeFilter === 'todos' || item.type === typeFilter
    const matchSession = sessionFilter === 'todos' || item.session_keys?.includes(Number(sessionFilter)) || item.session_keys?.includes(sessionFilter)
    const matchSearch = !search || item.title?.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSession && matchSearch
  })

  // Group by type for summary
  const typeCounts = CONTENT_TYPES.reduce((acc, t) => {
    acc[t.key] = items.filter(i => i.type === t.key).length
    return acc
  }, {})

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Biblioteca <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
            {items.length} conteúdo{items.length !== 1 ? 's' : ''} · {filtered.length} exibido{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM, team: activeTeam }); setEditing(null); setShowAdd(true) }}>
          + Novo conteúdo
        </button>
      </div>

      {/* Search + Filter button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px' }}>
          <span style={{ fontSize: 15, color: 'var(--muted)', flexShrink: 0 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            style={{ background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', padding: 0 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}>✕</button>}
        </div>
        <button onClick={() => setShowFilters(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1px solid ${(typeFilter!=='todos'||sessionFilter!=='todos') ? 'var(--auvo)' : 'var(--border)'}`, background: (typeFilter!=='todos'||sessionFilter!=='todos') ? 'var(--auvo)' : 'var(--surface)', color: (typeFilter!=='todos'||sessionFilter!=='todos') ? '#fff' : 'var(--muted2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, flexShrink: 0, transition: 'all 0.15s' }}>
          <span>⚙️</span>
          Filtros
          {(typeFilter!=='todos'||sessionFilter!=='todos') && (
            <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
              {[typeFilter!=='todos',sessionFilter!=='todos'].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {(typeFilter!=='todos'||sessionFilter!=='todos') && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Filtros ativos:</span>
          {typeFilter!=='todos' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--auvo-dim)', color: 'var(--auvo)', border: '1px solid var(--auvo-border)' }}>
              {CONTENT_TYPES.find(t=>t.key===typeFilter)?.icon} {CONTENT_TYPES.find(t=>t.key===typeFilter)?.label}
              <button onClick={() => setTypeFilter('todos')} style={{ background: 'none', border: 'none', color: 'var(--auvo)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
            </span>
          )}
          {sessionFilter!=='todos' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--auvo-dim)', color: 'var(--auvo)', border: '1px solid var(--auvo-border)' }}>
              📅 Dia {sessionFilter}
              <button onClick={() => setSessionFilter('todos')} style={{ background: 'none', border: 'none', color: 'var(--auvo)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
            </span>
          )}
          <button onClick={() => { setTypeFilter('todos'); setSessionFilter('todos') }} style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Limpar tudo
          </button>
        </div>
      )}

      {/* Filter panel overlay */}
      {showFilters && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowFilters(false)}>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>

            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--auvo)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚙️</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Filtros</span>
              </div>
              <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, padding: 0 }}>✕</button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Tipo */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Tipo de conteúdo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${typeFilter==='todos'?'var(--auvo-border)':'var(--border)'}`, background: typeFilter==='todos'?'var(--auvo-dim)':'transparent', cursor: 'pointer' }}>
                    <input type="radio" checked={typeFilter==='todos'} onChange={() => setTypeFilter('todos')} style={{ accentColor: 'var(--auvo)', width: 14, height: 14 }} />
                    <span style={{ fontSize: 12, color: typeFilter==='todos'?'var(--auvo)':'var(--text)' }}>Todos ({items.length})</span>
                  </label>
                  {CONTENT_TYPES.filter(t => typeCounts[t.key] > 0).map(t => (
                    <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${typeFilter===t.key?'var(--auvo-border)':'var(--border)'}`, background: typeFilter===t.key?'var(--auvo-dim)':'transparent', cursor: 'pointer' }}>
                      <input type="radio" checked={typeFilter===t.key} onChange={() => setTypeFilter(t.key)} style={{ accentColor: 'var(--auvo)', width: 14, height: 14 }} />
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ fontSize: 12, flex: 1, color: typeFilter===t.key?'var(--auvo)':'var(--text)' }}>{t.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{typeCounts[t.key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sessão */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Sessão vinculada</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${sessionFilter==='todos'?'var(--auvo-border)':'var(--border)'}`, background: sessionFilter==='todos'?'var(--auvo-dim)':'transparent', cursor: 'pointer' }}>
                    <input type="radio" checked={sessionFilter==='todos'} onChange={() => setSessionFilter('todos')} style={{ accentColor: 'var(--auvo)', width: 14, height: 14 }} />
                    <span style={{ fontSize: 12, color: sessionFilter==='todos'?'var(--auvo)':'var(--text)' }}>Todas as sessões</span>
                  </label>
                  {uniqueDays.map(day => (
                    <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${sessionFilter==day||sessionFilter==String(day)?'var(--auvo-border)':'var(--border)'}`, background: sessionFilter==day||sessionFilter==String(day)?'var(--auvo-dim)':'transparent', cursor: 'pointer' }}>
                      <input type="radio" checked={sessionFilter==day||sessionFilter==String(day)} onChange={() => setSessionFilter(day)} style={{ accentColor: 'var(--auvo)', width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, color: sessionFilter==day||sessionFilter==String(day)?'var(--auvo)':'var(--text)' }}>Dia {day}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button onClick={() => { setTypeFilter('todos'); setSessionFilter('todos') }}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                Limpar filtros
              </button>
              <button onClick={() => setShowFilters(false)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--auvo)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content list */}
      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 13, color: 'var(--muted2)' }}>
            {search || typeFilter !== 'todos' || sessionFilter !== 'todos' ? 'Nenhum resultado para os filtros aplicados' : 'Nenhum conteúdo ainda'}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(item => {
            const t = typeInfo(item.type)
            const tc = TYPE_COLORS[item.type] || TYPE_COLORS.youtube
            const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null

            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 9,
                background: 'var(--surface)', transition: 'all 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Thumb pequeno */}
                <div style={{ width: 44, height: 30, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {ytId ? (
                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <span>{t.icon}</span>
                  )}
                </div>

                {/* Type badge */}
                <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.04em', background: tc.bg, color: tc.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t.label.toUpperCase()}
                </span>

                {/* Title + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  {item.description && (
                    <div style={{ fontSize: 10, color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{item.description}</div>
                  )}
                </div>

                {/* Session chips */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {item.session_keys?.slice(0, 3).map(k => (
                    <span key={k} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'var(--auvo-dim)', color: 'var(--auvo)' }}>Dia {k}</span>
                  ))}
                  {item.session_keys?.length > 3 && <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{item.session_keys.length - 3}</span>}
                  {(!item.session_keys || item.session_keys.length === 0) && (
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>—</span>
                  )}
                </div>

                {/* Team badge */}
                {item.team === 'ambos' && (
                  <span style={{ fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>🌐</span>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer"
                      className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', textDecoration: 'none', padding: '3px 8px' }}
                      onClick={e => e.stopPropagation()}>
                      Abrir →
                    </a>
                  )}
                  {(item.type === 'youtube' || item.type === 'texto') && (
                    <button className="btn btn-sm" style={{ fontSize: 9, padding: '3px 8px' }}
                      onClick={() => setPreview(item)}>
                      👁️
                    </button>
                  )}
                  <button className="btn btn-sm" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => openEdit(item)}>✏️</button>
                  {confirmDelete === item.id ? (
                    <>
                      <button className="btn btn-danger btn-sm" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => deleteItem(item.id)}>Sim</button>
                      <button className="btn btn-sm" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => setConfirmDelete(null)}>Não</button>
                    </>
                  ) : (
                    <button className="btn btn-sm" style={{ fontSize: 9, padding: '3px 8px', color: 'var(--red)' }} onClick={() => setConfirmDelete(item.id)}>🗑️</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL: Add/Edit */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ width: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar conteúdo' : 'Novo conteúdo'}</div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo de conteúdo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {CONTENT_TYPES.map(t => (
                    <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                      style={{ padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        border: `1px solid ${form.type === t.key ? 'var(--auvo-border)' : 'var(--border)'}`,
                        background: form.type === t.key ? 'var(--auvo-dim)' : 'transparent',
                        color: form.type === t.key ? 'var(--auvo)' : 'var(--muted2)',
                        display: 'flex', alignItems: 'center', gap: 6, fontWeight: form.type === t.key ? 600 : 400 }}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Como realizar o Pré T1" />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do conteúdo" />
              </div>
              {form.type !== 'texto' && (
                <div className="form-group">
                  <label>{form.type === 'youtube' ? 'URL do YouTube' : form.type === 'pdf' ? 'URL do vídeo gravado' : form.type === 'notebooklm' ? 'URL do NotebookLM' : 'URL do link'}</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                </div>
              )}
              {form.type === 'texto' && (
                <div className="form-group">
                  <label>Conteúdo</label>
                  <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Digite o conteúdo aqui..." style={{ minHeight: 100, resize: 'vertical' }} />
                </div>
              )}
              <div className="form-group">
                <label>Disponível para</label>
                <div className="flex gap-2">
                  {[['atendimento','🎧 Atendimento'],['vendas','💼 Vendas'],['ambos','🌐 Ambos os times']].map(([k, l]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, team: k }))}
                      style={{ flex: 1, padding: '7px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        border: `1px solid ${form.team === k ? 'var(--auvo-border)' : 'var(--border)'}`,
                        background: form.team === k ? 'var(--auvo-dim)' : 'transparent',
                        color: form.team === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Vincular a sessões (opcional)</label>
                <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {allSessions.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, border: `1px solid ${form.session_keys?.includes(s.id) ? 'var(--auvo-border)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 0, background: form.session_keys?.includes(s.id) ? 'var(--auvo-dim)' : 'transparent', fontSize: 11 }}>
                      <input type="checkbox" checked={form.session_keys?.includes(s.id) || false} onChange={() => toggleSession(s.id)} />
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--surface3)', color: 'var(--muted)', flexShrink: 0 }}>Dia {s.day}</span>
                      {s.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowAdd(false); setEditing(null); setForm(EMPTY_FORM) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={saving || !form.title}>
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar conteúdo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preview YouTube */}
      {preview && preview.type === 'youtube' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="modal" style={{ width: 700 }}>
            <div className="modal-header">
              <div className="modal-title">{preview.title}</div>
              <button className="modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {getYoutubeId(preview.url) ? (
                <iframe width="100%" height="380" src={`https://www.youtube.com/embed/${getYoutubeId(preview.url)}`}
                  frameBorder="0" allowFullScreen style={{ borderRadius: 8 }} title={preview.title} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>URL inválida</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preview Texto */}
      {preview && preview.type === 'texto' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="modal" style={{ width: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{preview.title}</div>
              <button className="modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ padding: 24, fontSize: 13, lineHeight: 1.8, color: 'var(--muted2)', whiteSpace: 'pre-wrap' }}>
              {preview.body || 'Sem conteúdo.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
