import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AnalistaLayout from '../components/AnalistaLayout.jsx'
import { supabase, getLevelInfo, LEVEL_NAMES } from '../lib/supabase'

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

export default function MinhaGamificacao() {
  const { token } = useParams()
  const [analyst, setAnalyst] = useState(null)
  const [gamif, setGamif] = useState(null)
  const [xpHistory, setXpHistory] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [token])

  async function load() {
    const { data: a } = await supabase.from('analysts').select('*').eq('access_token', token).single()
    if (!a) { setLoading(false); return }
    setAnalyst(a)

    const [{ data: g }, { data: hist }, { data: teamAnalysts }] = await Promise.all([
      supabase.from('analyst_gamification').select('*').eq('analyst_id', a.id).single(),
      supabase.from('xp_history').select('*').eq('analyst_id', a.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('analysts').select('id, name').eq('team', a.team).eq('status', 'ativo'),
    ])

    setGamif(g)
    setXpHistory(hist || [])

    if (teamAnalysts?.length) {
      const enriched = await Promise.all(teamAnalysts.map(async ta => {
        const { data: tg } = await supabase.from('analyst_gamification').select('xp_total, level, level_name').eq('analyst_id', ta.id).single()
        return { ...ta, xp_total: tg?.xp_total || 0, level: tg?.level || 1, level_name: tg?.level_name || 'Novato' }
      }))
      setRanking(enriched.sort((a, b) => b.xp_total - a.xp_total))
    }

    setLoading(false)
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

  const xp = gamif?.xp_total || 0
  const lvl = getLevelInfo(xp)
  const nextLvl = LEVEL_NAMES.find(l => l.level === lvl.level + 1)
  const xpToNext = nextLvl ? nextLvl.min - xp : 0
  const xpPct = nextLvl ? Math.round((xp - lvl.min) / (nextLvl.min - lvl.min) * 100) : 100
  const earnedBadges = gamif?.badges || []
  const medals = ['🥇','🥈','🥉']

  function fmtReason(r) {
    const map = {
      treinamento_concluido: 'Treinamento concluído',
      simulacao_concluida: 'Simulação concluída',
      exercicio_enviado: 'Exercício de fixação enviado',
      video_enviado: 'Vídeo enviado',
      csat_respondido: 'Avaliação CSAT respondida',
      streak_5_dias: 'Bônus: 5 dias seguidos 🔥',
      streak_7_dias: 'Bônus: 7 dias seguidos 🔥',
      streak_14_dias: 'Bônus: 14 dias seguidos 💥',
      semana_perfeita: 'Semana perfeita! ⭐',
    }
    return map[r] || r
  }

  function fmtTime(dt) {
    const d = new Date(dt)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return 'Hoje'
    if (diff < 172800000) return 'Ontem'
    return d.toLocaleDateString('pt-BR')
  }

  const myRankPos = ranking.findIndex(r => r.id === analyst.id)

  return (
    <AnalistaLayout analystName={analyst?.name}>
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--auvo), var(--auvo-dark))', borderRadius: 16, padding: 22, marginBottom: 20, color: '#fff' }}>
        <div className="flex items-center gap-4">
          <div style={{ width: 52, height: 52, borderRadius: 13, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
            {analyst.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', padding: '2px 9px', borderRadius: 8, display: 'inline-block', marginBottom: 5, fontWeight: 600 }}>
              Nível {lvl.level} — {lvl.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{xp}</span>
              <span style={{ fontSize: 12, opacity: 0.65 }}>XP {xpToNext > 0 ? `· próximo nível em ${xpToNext} XP` : '· nível máximo!'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 8, width: 260 }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'rgba(255,255,255,0.85)', width: `${xpPct}%` }} />
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FCD34D' }}>🔥 {gamif?.streak_days || 0}</div>
            <div style={{ fontSize: 10, opacity: 0.75 }}>dias seguidos</div>
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 1 }}>recorde: {gamif?.streak_best || 0}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div>

          {/* Badges */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              Conquistas
              <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 400 }}>{earnedBadges.length} de {BADGES.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {BADGES.map(b => {
                const earned = earnedBadges.includes(b.id)
                return (
                  <div key={b.id} title={b.desc} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 4px', borderRadius: 9,
                    border: `1px solid ${earned ? 'var(--auvo-border)' : 'var(--border)'}`,
                    background: earned ? 'var(--auvo-dim)' : 'transparent',
                    opacity: earned ? 1 : 0.28, filter: earned ? 'none' : 'grayscale(1)',
                    cursor: 'default', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 24 }}>{b.icon}</span>
                    <span style={{ fontSize: 8, fontWeight: 500, textAlign: 'center', color: earned ? 'var(--auvo)' : 'var(--muted2)', lineHeight: 1.3 }}>{b.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* XP History */}
          <div className="card">
            <div className="card-title">Histórico de XP</div>
            {xpHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>Nenhum XP ganho ainda</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {xpHistory.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 7, background: 'var(--surface2)', fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: 'var(--green)', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>+{h.xp_gained} XP</span>
                    <span style={{ flex: 1, color: 'var(--muted2)' }}>{fmtReason(h.reason)}</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{fmtTime(h.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ranking */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-title">Ranking do time</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranking.map((r, i) => {
              const isMe = r.id === analyst.id
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                  borderRadius: 8, border: `1px solid ${isMe ? 'var(--auvo-border)' : 'var(--border)'}`,
                  background: isMe ? 'var(--auvo-dim)' : 'var(--surface2)',
                }}>
                  <span style={{ fontSize: 14, width: 20, flexShrink: 0, textAlign: 'center' }}>
                    {i < 3 ? medals[i] : i+1}
                  </span>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: isMe ? 'var(--auvo)' : 'rgba(255,255,255,0.08)', color: isMe ? '#fff' : 'var(--muted2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                    {r.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name.split(' ')[0]} {isMe && <span style={{ fontSize: 9, color: 'var(--auvo)' }}>(você)</span>}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Nv.{r.level} {r.level_name}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--auvo)' }}>{r.xp_total}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
    </AnalistaLayout>
  )
}
