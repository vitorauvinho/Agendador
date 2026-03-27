import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Revisoes({ activeTeam }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')

  useEffect(() => { loadReviews() }, [activeTeam, filter])

  async function loadReviews() {
    setLoading(true)

    // Exercícios pendentes
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*, sessions(title, day_number, type), analysts(name, team)')
      .eq('reviewed', false)
      .not('submitted_at', 'is', null)
      .eq('analysts.team', activeTeam)

    // Vídeos pendentes
    const { data: videos } = await supabase
      .from('video_submissions')
      .select('*, sessions(title, day_number), analysts(name, team)')
      .eq('reviewed', false)
      .eq('analysts.team', activeTeam)

    // Notificações de saída
    const { data: exits } = await supabase
      .from('notifications')
      .select('*, analysts(name)')
      .eq('team', activeTeam)
      .eq('type', 'analyst_exited')
      .eq('read', false)
      .order('created_at', { ascending: false })

    const all = [
      ...(exercises || []).filter(e => e.analysts).map(e => ({ ...e, kind: 'exercise' })),
      ...(videos || []).filter(v => v.analysts).map(v => ({ ...v, kind: 'video' })),
      ...(exits || []).map(n => ({ ...n, kind: 'exit' })),
    ].sort((a, b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at))

    const filtered = filter === 'todos' ? all
      : all.filter(i => i.kind === filter)

    setItems(filtered)
    setLoading(false)
  }

  async function markReviewed(item) {
    if (item.kind === 'exercise') {
      await supabase.from('exercises').update({ reviewed: true, reviewed_at: new Date().toISOString(), reviewed_by: 'enablement' }).eq('id', item.id)
    } else if (item.kind === 'video') {
      await supabase.from('video_submissions').update({ reviewed: true, reviewed_at: new Date().toISOString(), reviewed_by: 'enablement' }).eq('id', item.id)
    } else if (item.kind === 'exit') {
      await supabase.from('notifications').update({ read: true }).eq('id', item.id)
    }
    loadReviews()
  }

  function fmtTime(dt) {
    if (!dt) return '—'
    const d = new Date(dt)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    if (diff < 172800000) return `Ontem, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    return d.toLocaleDateString('pt-BR')
  }

  const total = items.length

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Revisões <span style={{ color: 'var(--auvo)' }}>pendentes</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
            {total > 0 ? `${total} item${total > 1 ? 's' : ''} aguardando revisão` : 'Tudo em dia!'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        {[['todos','Todos'],['exercise','📋 Exercícios'],['video','🎥 Vídeos'],['exit','🚪 Saídas']].map(([k,l]) => (
          <button key={k} className={`pill ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, color: 'var(--muted2)' }}>Nenhuma revisão pendente</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
              border: `1px solid ${item.kind !== 'exit' ? 'var(--auvo-border)' : 'var(--border)'}`,
              borderRadius: 10, background: item.kind !== 'exit' ? 'var(--auvo-dim)' : 'var(--surface)',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>
                {item.kind === 'exercise' ? '📋' : item.kind === 'video' ? '🎥' : '🚪'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                  {item.kind === 'exercise' && `Exercício enviado — ${item.analysts?.name}`}
                  {item.kind === 'video'    && `Vídeo enviado — ${item.analysts?.name}`}
                  {item.kind === 'exit'     && `Saída registrada — ${item.analysts?.name}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8 }}>
                  {item.kind !== 'exit' && `${item.sessions?.title} · Dia ${item.sessions?.day_number}`}
                  {item.kind === 'exit' && item.message}
                </div>

                {item.kind === 'video' && item.video_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                      {item.video_url}
                    </span>
                    <a href={item.video_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', textDecoration: 'none', flexShrink: 0 }}>
                      Assistir →
                    </a>
                  </div>
                )}

                {item.kind === 'exercise' && item.form_url && (
                  <div style={{ marginBottom: 8 }}>
                    <a href={item.form_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', textDecoration: 'none' }}>
                      Ver formulário →
                    </a>
                  </div>
                )}

                {item.kind !== 'exit' && (
                  <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={() => markReviewed(item)}>
                    ✓ Marcar como revisado
                  </button>
                )}
                {item.kind === 'exit' && (
                  <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => markReviewed(item)}>
                    ✓ Ciente
                  </button>
                )}
              </div>
              <span style={{ fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>
                {fmtTime(item.submitted_at || item.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
