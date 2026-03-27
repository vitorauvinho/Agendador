import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['', '😞', '😐', '😊', '🤩']
const EMOJI_LABELS = ['', 'Ruim', 'Regular', 'Bom', 'Ótimo']

export default function Avaliacoes({ activeTeam }) {
  const [ratings, setRatings] = useState([])
  const [enRatings, setEnRatings] = useState([])
  const [exits, setExits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)
    const { data: r } = await supabase
      .from('session_ratings')
      .select('*, sessions(title, day_number, type), analysts(name, team)')
      .eq('analysts.team', activeTeam)
      .order('created_at', { ascending: false })

    const { data: er } = await supabase
      .from('enablement_ratings')
      .select('*, sessions(title, day_number), analysts(name, team)')
      .eq('analysts.team', activeTeam)
      .order('created_at', { ascending: false })

    const { data: ex } = await supabase
      .from('analysts')
      .select('name, exit_reason, exit_date, team')
      .in('status', ['desistiu', 'demitido'])
      .eq('team', activeTeam)

    setRatings((r || []).filter(x => x.analysts))
    setEnRatings((er || []).filter(x => x.analysts))
    setExits(ex || [])
    setLoading(false)
  }

  const avgCsat = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null

  const distribution = [1,2,3,4].map(score => ({
    score,
    count: ratings.filter(r => r.rating === score).length,
    pct: ratings.length ? Math.round(ratings.filter(r => r.rating === score).length / ratings.length * 100) : 0
  })).reverse()

  // Sessões com pior CSAT
  const sessionAvgs = {}
  ratings.forEach(r => {
    const key = r.sessions?.title
    if (!key) return
    if (!sessionAvgs[key]) sessionAvgs[key] = { title: key, sum: 0, count: 0 }
    sessionAvgs[key].sum += r.rating
    sessionAvgs[key].count++
  })
  const worstSessions = Object.values(sessionAvgs)
    .map(s => ({ ...s, avg: s.sum / s.count }))
    .filter(s => s.avg < 3)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)

  // Exit analysis
  const exitReasons = {}
  exits.forEach(e => {
    const r = e.exit_reason || 'Outro'
    exitReasons[r] = (exitReasons[r] || 0) + 1
  })

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Avaliações <span style={{ color: 'var(--auvo)' }}>& CSAT</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Feedback dos analistas e avaliações do enablement</div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            {/* CSAT */}
            <div className="card">
              <div className="card-title">CSAT do onboarding</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--auvo)', marginBottom: 4 }}>
                {avgCsat ? `${avgCsat} / 4` : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 14 }}>
                {ratings.length} avaliação{ratings.length !== 1 ? 'ões' : ''}
              </div>
              {distribution.map(d => (
                <div key={d.score} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, width: 24 }}>{EMOJIS[d.score]}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${d.pct}%`, background: d.score >= 3 ? 'var(--auvo)' : d.score === 2 ? 'var(--muted)' : 'var(--red)' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted2)', width: 28, textAlign: 'right' }}>{d.pct}%</span>
                </div>
              ))}
            </div>

            {/* Saídas */}
            <div className="card">
              <div className="card-title">Motivos de saída</div>
              {exits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>
                  Nenhuma saída registrada
                </div>
              ) : (
                <>
                  {Object.entries(exitReasons).sort((a,b) => b[1]-a[1]).map(([reason, count]) => (
                    <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, marginBottom: 6, fontSize: 11 }}>
                      <span>{reason}</span>
                      <span style={{ color: 'var(--red)', fontWeight: 600 }}>{count} — {Math.round(count/exits.length*100)}%</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--amber-dim)', borderRadius: 7, fontSize: 10, color: 'var(--amber)' }}>
                    ⚠ {exits.length} saída{exits.length > 1 ? 's' : ''} registrada{exits.length > 1 ? 's' : ''} no total
                  </div>
                </>
              )}

              {worstSessions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sessões com baixa avaliação</div>
                  {worstSessions.map(s => (
                    <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, marginBottom: 5 }}>
                      <span style={{ fontSize: 16 }}>{EMOJIS[Math.round(s.avg)]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                        <div style={{ fontSize: 9, color: 'var(--muted2)' }}>{s.count} avaliação{s.count > 1 ? 'ões' : ''}</div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>{s.avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* History table */}
          <div className="card">
            <div className="card-title">Histórico de avaliações</div>
            {ratings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>Nenhuma avaliação ainda</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Analista','Sessão','CSAT','Comentário','Data'].map(h => (
                        <th key={h} style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ratings.slice(0, 20).map(r => (
                      <tr key={r.id}>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{r.analysts?.name}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted2)' }}>{r.sessions?.title}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 16 }}>{EMOJIS[r.rating]}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 4 }}>{r.rating}/4</span>
                        </td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.comment || '—'}
                        </td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
