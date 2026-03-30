import { useState, useEffect } from 'react'
import { supabase, TEAM_SESSIONS } from '../lib/supabase'

const CONTENT_TYPES = [
  { key: 'youtube',    label: 'YouTube',          icon: '▶️', color: 'var(--red)' },
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
  const [filter, setFilter] = useState('todos')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [preview, setPreview] = useState(null)

  const allSessions = TEAM_SESSIONS[activeTeam]

  useEffect(() => { loadItems() }, [activeTeam, filter])

  async function loadItems() {
    setLoading(true)
    let q = supabase.from('content_items').select('*').order('order_index').order('created_at', { ascending: false })
    if (filter !== 'todos') q = q.eq('type', filter)
    q = q.or(`team.eq.${activeTeam},team.eq.ambos`)
    const { data } = await q
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

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Biblioteca <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Conteúdos vinculados ao cronograma</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM, team: activeTeam }); setEditing(null); setShowAdd(true) }}>
          + Novo conteúdo
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`pill ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>Todos</button>
        {CONTENT_TYPES.map(t => (
          <button key={t.key} className={`pill ${filter === t.key ? 'active' : ''}`} onClick={() => setFilter(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content grid */}
      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 6 }}>Nenhum conteúdo ainda</div>
          <div style={{ fontSize: 12 }}>Clique em "+ Novo conteúdo" para adicionar</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, flex: 1, overflowY: 'auto' }}>
          {items.map(item => {
            const t = typeInfo(item.type)
            const tc = TYPE_COLORS[item.type] || TYPE_COLORS.youtube
            const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null
            return (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', transition: 'all 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Thumb */}
                <div style={{ height: 90, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, position: 'relative' }}
                  onClick={() => setPreview(item)}>
                  {ytId ? (
                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <span>{t.icon}</span>
                  )}
                  <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em', background: tc.bg, color: tc.color }}>
                    {t.label.toUpperCase()}
                  </div>
                  {item.team === 'ambos' && (
                    <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'var(--muted2)' }}>
                      Ambos os times
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
                  {item.description && <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8, lineHeight: 1.4 }}>{item.description}</div>}
                  {item.session_keys?.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
                      {item.session_keys.slice(0, 4).map(k => (
                        <span key={k} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: 'var(--auvo-dim)', color: 'var(--auvo)' }}>Dia {k}</span>
                      ))}
                      {item.session_keys.length > 4 && <span style={{ fontSize: 8, color: 'var(--muted)' }}>+{item.session_keys.length - 4}</span>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', textDecoration: 'none' }}>
                        Abrir →
                      </a>
                    )}
                    <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => openEdit(item)}>✏️ Editar</button>
                    {confirmDelete === item.id ? (
                      <div className="flex gap-1" style={{ marginLeft: 'auto' }}>
                        <button className="btn btn-sm btn-danger" style={{ fontSize: 9 }} onClick={() => deleteItem(item.id)}>Sim</button>
                        <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: 9, marginLeft: 'auto', color: 'var(--red)' }} onClick={() => setConfirmDelete(item.id)}>🗑️</button>
                    )}
                  </div>
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
                      Dia {s.day} — {s.title}
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
