import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BADGES = [
  { id: 'primeira_simulacao', icon: '🎯', name: 'Primeiro passo',      desc: 'Concluiu a primeira simulação' },
  { id: 'semana1_completa',   icon: '⚡', name: 'Semana 1 perfeita',   desc: 'Completou toda a semana 1' },
  { id: 'streak_7',           icon: '🔥', name: 'Chama acesa',         desc: 'Streak de 7 dias' },
  { id: 'streak_14',          icon: '💥', name: 'Imparável',           desc: 'Streak de 14 dias' },
  { id: 'pmoc_master',        icon: '🏅', name: 'PMOC Master',         desc: 'Todos os módulos PMOC' },
  { id: 'diretor',            icon: '📹', name: 'Diretor',             desc: '5 vídeos enviados' },
  { id: 'csat_top',           icon: '💬', name: 'Voz ativa',           desc: '20 avaliações CSAT' },
  { id: 'velocista',          icon: '🚀', name: 'Velocista',           desc: 'Semana 1 em menos de 5 dias' },
  { id: 'onboarding_completo',icon: '🏆', name: 'Onboarding completo', desc: '100% das sessões' },
  { id: 'auvonauta',          icon: '💜', name: 'Auvonauta',           desc: '100% + CSAT médio ≥ 3.5' },
]

export default function Gamificacao({ activeTeam }) {
  const [ranking, setRanking] = useState([])
  const [badgeSummary, setBadgeSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)

    const { data: analysts } = await supabase
      .from('analysts')
      .select('id, name, email, status')
      .eq('team', activeTeam)
      .eq('status', 'ativo')

    if (!analysts?.length) { setRanking([]); setLoading(false); return }

    const enriched = await Promise.all(analysts.map(async a => {
      const { data: g } = await supabase.from('analyst_gamification').select('*').eq('analyst_id', a.id).single()
      return { ...a, ...(g || { xp_total: 0, level: 1, level_name: 'Novato', streak_days: 0, streak_best: 0, badges: [] }) }
    }))

    const sorted = enriched.sort((a, b) => (b.xp_total || 0) - (a.xp_total || 0))
    setRanking(sorted)

    // Badge summary — count per badge
    const summary = {}
    enriched.forEach(a => {
      (a.badges || []).forEach(b => { summary[b] = (summary[b] || 0) + 1 })
    })
    setBadgeSummary(Object.entries(summary).sort((a,b) => b[1]-a[1]))

    setLoading(false)
  }

  const medals = ['🥇','🥈','🥉']
  const maxXp = ranking[0]?.xp_total || 1

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Gamificação <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Ranking, XP e conquistas do time</div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : ranking.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 14, color: 'var(--muted2)' }}>Nenhum analista ativo ainda</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="grid-2" style={{ marginBottom: 16 }}>

            {/* Ranking */}
            <div className="card">
              <div className="card-title">Ranking semanal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ranking.map((a, i) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 9, border: `1px solid ${i === 0 ? 'var(--auvo-border)' : 'var(--border)'}`,
                    background: i === 0 ? 'var(--auvo-dim)' : 'var(--surface2)',
                  }}>
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>
                      {i < 3 ? medals[i] : `${i+1}`}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {a.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Nível {a.level} — {a.level_name}</div>
                    </div>
                    <div style={{ width: 70, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--auvo)', width: `${Math.round((a.xp_total||0)/maxXp*100)}%` }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--auvo)', minWidth: 44, textAlign: 'right' }}>{a.xp_total || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Badge summary */}
            <div className="card">
              <div className="card-title">Badges conquistados no time</div>
              {badgeSummary.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>Nenhum badge ainda</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {badgeSummary.map(([badgeId, count]) => {
                    const b = BADGES.find(x => x.id === badgeId)
                    if (!b) return null
                    return (
                      <div key={badgeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                        <span style={{ fontSize: 20 }}>{b.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{b.desc}</div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--auvo)', fontWeight: 600 }}>{count} analista{count>1?'s':''}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* XP Rules reference */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tabela de XP</div>
                {[
                  ['Treinamento concluído','10 XP'],
                  ['Simulação concluída','25 XP'],
                  ['Exercício enviado','15 XP'],
                  ['Vídeo enviado','20 XP'],
                  ['CSAT respondido','5 XP'],
                  ['Streak 7 dias','75 XP bônus'],
                ].map(([action, xp]) => (
                  <div key={action} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)', color: 'var(--muted2)' }}>
                    <span>{action}</span>
                    <span style={{ color: 'var(--auvo)', fontWeight: 600 }}>{xp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analyst detail cards */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Detalhe por analista</div>
          <div className="grid-3">
            {ranking.map(a => (
              <div key={a.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                    {a.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Nível {a.level} — {a.level_name}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--auvo)' }}>{a.xp_total || 0}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>XP total</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>🔥 {a.streak_days || 0}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>dias seguidos</div>
                  </div>
                </div>
                {a.badges?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {a.badges.map((b, i) => {
                      const badge = BADGES.find(x => x.id === b)
                      return badge ? <span key={i} title={badge.name} style={{ fontSize: 18 }}>{badge.icon}</span> : null
                    })}
                  </div>
                )}
                {(!a.badges || a.badges.length === 0) && (
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Nenhum badge ainda</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
