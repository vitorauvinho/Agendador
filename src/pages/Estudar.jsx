import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AnalistaLayout from '../components/AnalistaLayout.jsx'
import { supabase } from '../lib/supabase'

const CONTENT_TYPES = [
  { key: 'youtube',    label: 'YouTube',    icon: '▶️' },
  { key: 'pdf',        label: 'Trein. Gravados', icon: '🎬' },
  { key: 'notebooklm', label: 'NotebookLM', icon: '🤖' },
  { key: 'texto',      label: 'Texto',      icon: '📝' },
  { key: 'playbook',   label: 'Playbook',   icon: '📘' },
  { key: 'link_util',  label: 'Link útil',  icon: '🔗' },
]

const TYPE_COLORS = {
  youtube:    { bg: 'var(--red-dim)',   color: 'var(--red)' },
  pdf:        { bg: 'var(--blue-dim)',  color: 'var(--blue)' },
  notebooklm: { bg: 'var(--auvo-dim)', color: 'var(--auvo)' },
  texto:      { bg: 'var(--green-dim)', color: 'var(--green)' },
  playbook:   { bg: 'var(--amber-dim)', color: 'var(--amber)' },
  link_util:  { bg: 'var(--teal-dim)', color: 'var(--teal)' },
}

export default function Estudar() {
  const { token } = useParams()
  const [analyst, setAnalyst] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [preview, setPreview] = useState(null)

  useEffect(() => { loadAll() }, [token])

  async function loadAll() {
    const { data: a } = await supabase.from('analysts').select('*').eq('access_token', token).single()
    if (!a) { setLoading(false); return }
    setAnalyst(a)
    const { data: content } = await supabase
      .from('content_items').select('*')
      .or(`team.eq.${a.team},team.eq.ambos`)
      .order('order_index').order('created_at', { ascending: false })
    setItems(content || [])
    setLoading(false)
  }

  function getYoutubeId(url) {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? match[1] : null
  }

  const typeInfo = (type) => CONTENT_TYPES.find(t => t.key === type) || CONTENT_TYPES[0]
  const filtered = filter === 'todos' ? items : items.filter(i => i.type === filter)

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
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Seus <span style={{ color: 'var(--auvo)' }}>materiais</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
              {analyst.team === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'} · {items.length} conteúdo{items.length !== 1 ? 's' : ''} disponível{items.length !== 1 ? 'is' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            <button className={`pill ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>Todos ({items.length})</button>
            {CONTENT_TYPES.filter(t => items.some(i => i.type === t.key)).map(t => (
              <button key={t.key} className={`pill ${filter === t.key ? 'active' : ''}`} onClick={() => setFilter(t.key)}>
                {t.icon} {t.label} ({items.filter(i => i.type === t.key).length})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 14, color: 'var(--muted2)' }}>Nenhum conteúdo disponível ainda</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {filtered.map(item => {
                const t = typeInfo(item.type)
                const tc = TYPE_COLORS[item.type] || TYPE_COLORS.youtube
                const ytId = item.type === 'youtube' ? getYoutubeId(item.url) : null
                return (
                  <div key={item.id}
                    style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    onClick={() => {
                      if (item.type === 'youtube' || item.type === 'texto') setPreview(item)
                      else if (item.url) window.open(item.url, '_blank')
                    }}
                  >
                    <div style={{ height: 90, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, position: 'relative' }}>
                      {ytId ? (
                        <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      ) : (
                        <span>{t.icon}</span>
                      )}
                      <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: tc.bg, color: tc.color }}>
                        {t.label.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
                      {item.description && <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.5, marginBottom: 8 }}>{item.description}</div>}
                      {item.session_keys?.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
                          {item.session_keys.slice(0, 4).map(k => (
                            <span key={k} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: 'var(--auvo-dim)', color: 'var(--auvo)' }}>Dia {k}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--auvo)', fontWeight: 500 }}>
                        {item.type === 'youtube' && '▶ Assistir'}
                        {item.type === 'pdf' && '🎬 Assistir gravação'}
                        {item.type === 'notebooklm' && '🤖 Abrir NotebookLM'}
                        {item.type === 'texto' && '📝 Ler'}
                        {item.type === 'playbook' && '📘 Abrir playbook'}
                        {item.type === 'link_util' && '🔗 Acessar'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </AnalistaLayout>

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

      {preview && preview.type === 'texto' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="modal" style={{ width: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{preview.title}</div>
              <button className="modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ padding: 24, fontSize: 13, lineHeight: 1.8, color: 'var(--muted2)', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflowY: 'auto' }}>
              {preview.body || 'Sem conteúdo.'}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
