import { useState, useEffect } from 'react'
import { supabase, fmtDateLong } from '../lib/supabase'

const RISK_COLORS = {
  ok:      { dot: 'var(--green)',  label: 'No prazo' },
  atencao: { dot: 'var(--amber)', label: 'Atenção' },
  risco:   { dot: 'var(--red)',   label: 'Risco' },
  saiu:    { dot: 'var(--muted)', label: 'Saiu' },
}

export default function PainelRH({ activeTeam }) {
  const [analysts, setAnalysts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [selected, setSelected] = useState(null)
  const [snapData, setSnapData] = useState(null)
  const [snapLoading, setSnapLoading] = useState(false)
  const [finalComment, setFinalComment] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('analysts').select('*, analyst_gamification(xp_total, level, level_name, streak_best, streak_days, badges)').eq('team', activeTeam).order('created_at', { ascending: false })

    const enriched = await Promise.all((data || []).map(async a => {
      const { data: sess } = await supabase.from('sessions').select('id, completed, completed_at').eq('analyst_id', a.id)
      const { data: ratings } = await supabase.from('session_ratings').select('rating').eq('analyst_id', a.id)
      const total = sess?.length || 0
      const done = sess?.filter(s => s.completed).length || 0
      const pct = total ? Math.round(done / total * 100) : 0
      const avgCsat = ratings?.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : null
      const lastActivity = sess?.filter(s => s.completed_at).sort((a,b) => new Date(b.completed_at)-new Date(a.completed_at))[0]?.completed_at

      let risk = 'ok'
      if (['desistiu','demitido'].includes(a.status)) risk = 'saiu'
      else if (pct < 30) risk = 'risco'
      else if (pct < 60) risk = 'atencao'

      return { ...a, total_sessions: total, done_sessions: done, progress_pct: pct, avg_csat: avgCsat, last_activity: lastActivity, risk }
    }))

    setAnalysts(enriched)
    setLoading(false)
  }

  async function openSnap(analyst) {
    setSelected(analyst)
    setFinalComment('')
    setSnapLoading(true)

    const [{ data: sess }, { data: enRatings }, { data: xpHist }, { data: vids }, { data: excs }] = await Promise.all([
      supabase.from('sessions').select('*').eq('analyst_id', analyst.id).order('day_number'),
      supabase.from('enablement_ratings').select('*, sessions(title, day_number)').eq('analyst_id', analyst.id).order('created_at'),
      supabase.from('xp_history').select('*').eq('analyst_id', analyst.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('video_submissions').select('id').eq('analyst_id', analyst.id),
      supabase.from('exercises').select('id').eq('analyst_id', analyst.id).not('submitted_at', 'is', null),
    ])

    setSnapData({ sessions: sess || [], enRatings: enRatings || [], xpHistory: xpHist || [], videoCount: vids?.length || 0, exerciseCount: excs?.length || 0 })
    setSnapLoading(false)
  }

  async function generatePDF() {
    if (!selected) return
    await supabase.from('rh_reports').insert({ analyst_id: selected.id, generated_by: 'enablement', final_comment: finalComment, snapshot_data: { ...selected, ...snapData } })

    // Simple print-based PDF
    const content = document.getElementById('snap-content')
    if (content) window.print()
  }

  const filtered = analysts.filter(a => {
    const matchFilter = filter === 'todos' ? true
      : filter === 'ativos' ? a.status === 'ativo'
      : filter === 'risco' ? a.risk === 'risco'
      : filter === 'saiu' ? a.risk === 'saiu'
      : true
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const stats = {
    total: analysts.length,
    ativos: analysts.filter(a => a.status === 'ativo').length,
    concluidos: analysts.filter(a => a.progress_pct === 100).length,
    saiu: analysts.filter(a => ['desistiu','demitido'].includes(a.status)).length,
    taxa: analysts.length ? Math.round(analysts.filter(a => a.progress_pct === 100).length / analysts.length * 100) : 0,
  }

  const EMOJIS = ['','😞','😐','😊','😁','🤩']

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Painel <span style={{ color: 'var(--auvo)' }}>RH</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Snapshot de todos os analistas em onboarding</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: 'var(--muted2)' }}>
          {Object.entries(RISK_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot }} />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { v: stats.total,     l: 'Total', c: 'var(--auvo)' },
          { v: stats.ativos,    l: 'Ativos', c: 'var(--green)' },
          { v: stats.concluidos,l: 'Concluídos', c: 'var(--auvo)' },
          { v: stats.saiu,      l: 'Saíram', c: 'var(--red)' },
          { v: `${stats.taxa}%`,l: 'Taxa de conclusão', c: 'var(--amber)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--auvo)' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['todos','Todos'],['ativos','Ativos'],['risco','🔴 Risco'],['saiu','Saíram']].map(([k,l]) => (
          <button key={k} className={`pill ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar analista..." style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', width: 160, padding: 0 }} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['','Analista','Time','Status','Progresso','CSAT','XP / Nível','Início','Ações'].map(h => (
                  <th key={h} style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 500, background: 'var(--surface)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const rc = RISK_COLORS[a.risk]
                const isExited = ['desistiu','demitido'].includes(a.status)
                const gam = a.analyst_gamification?.[0] || {}
                return (
                  <tr key={a.id} style={{ opacity: isExited ? 0.6 : 1, cursor: 'pointer' }}
                    onClick={() => openSnap(a)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: rc.dot }} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {a.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted2)' }}>{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted2)' }}>
                      {a.team === 'atendimento' ? '🎧' : '💼'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`status-pill status-${a.status}`}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 72, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: a.progress_pct===100?'var(--green)':'var(--auvo)', width: `${a.progress_pct}%` }} />
                        </div>
                        <span style={{ fontSize: 10, color: a.progress_pct===100?'var(--green)':'var(--auvo)', fontWeight: 600 }}>{a.progress_pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      {a.avg_csat ? <span>{EMOJIS[Math.round(a.avg_csat)]} {a.avg_csat}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--auvo)', fontWeight: 600 }}>{gam.xp_total || 0} XP</span>
                      <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>Nv.{gam.level || 1}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted2)', whiteSpace: 'nowrap' }}>
                      {new Date(a.start_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 9 }} onClick={() => openSnap(a)}>
                        📄 Snapshot
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Nenhum analista encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshot Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ width: 680 }} id="snap-content">
            <div style={{ background: 'linear-gradient(135deg, var(--auvo), var(--auvo-dark))', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: '#fff' }}>
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    {selected.team === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'} · {fmtDateLong(selected.start_date)} · {selected.status}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)} style={{ color: 'rgba(255,255,255,0.7)' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {snapLoading ? (
                <div className="flex items-center" style={{ justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
              ) : snapData && (
                <>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                      { v: `${selected.progress_pct}%`, l: 'Progresso' },
                      { v: `${selected.done_sessions}/${selected.total_sessions}`, l: 'Sessões' },
                      { v: selected.avg_csat ? `${EMOJIS[Math.round(selected.avg_csat)]} ${selected.avg_csat}` : '—', l: 'CSAT médio' },
                      { v: selected.analyst_gamification?.[0]?.xp_total || 0, l: 'XP total' },
                      { v: snapData.exerciseCount, l: 'Exercícios' },
                      { v: snapData.videoCount, l: 'Vídeos enviados' },
                    ].map(s => (
                      <div key={s.l} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--auvo)', marginBottom: 3 }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Enablement ratings */}
                  {snapData.enRatings.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Avaliações do enablement</div>
                      {snapData.enRatings.map(r => (
                        <div key={r.id} style={{ background: 'var(--surface2)', borderRadius: 9, padding: 12, marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{r.sessions?.title}</span>
                            <span style={{ color: 'var(--auvo)', fontSize: 12 }}>{'★'.repeat(r.score)}{'☆'.repeat(5-r.score)}</span>
                          </div>
                          {r.comment && <div style={{ fontSize: 11, color: 'var(--muted2)', borderLeft: '2px solid var(--auvo)', paddingLeft: 8, lineHeight: 1.5 }}>{r.comment}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Final comment */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Parecer final do enablement</div>
                    <textarea value={finalComment} onChange={e => setFinalComment(e.target.value)}
                      placeholder="Descreva sua avaliação geral — pontos fortes, áreas de desenvolvimento e perspectiva de performance..."
                      style={{ minHeight: 90, resize: 'vertical', fontSize: 12, lineHeight: 1.6 }} />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setSelected(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={generatePDF} disabled={snapLoading}>
                📄 Gerar e salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
