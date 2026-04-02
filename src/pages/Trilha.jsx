import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AnalistaLayout from '../components/AnalistaLayout.jsx'
import { supabase, WEEKS, getSessionDate, fmtDate, fmtWeekday, fmtDateLong, XP_VALUES, getLevelInfo } from '../lib/supabase'

const EMOJIS = ['', '😞', '😐', '😊', '😁', '🤩']

export default function Trilha() {
  const { token } = useParams()
  const [analyst, setAnalyst] = useState(null)
  const [sessions, setSessions] = useState([])
  const [contents, setContents] = useState([])
  const [gamif, setGamif] = useState(null)
  const [enRatings, setEnRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCsat, setShowCsat] = useState(null)
  const [csatScore, setCsatScore] = useState(0)
  const [csatComment, setCsatComment] = useState('')
  const [videoLinks, setVideoLinks] = useState({})
  const [submitting, setSubmitting] = useState({})
  const [expandedSession, setExpandedSession] = useState(null)
  const [exerciseForms, setExerciseForms] = useState([])
  const [exerciseResponses, setExerciseResponses] = useState([])
  const [showingVideo, setShowingVideo] = useState(null)
  const [confirmUncheck, setConfirmUncheck] = useState(null)

  // Rotas do enablement que não devem cair aqui
  const ENABLEMENT_ROUTES = ['exercicios','onboarding','biblioteca','revisoes','avaliacoes','gamificacao','trilhas','rh','configuracoes','requalificacao']
  const isEnablementRoute = ENABLEMENT_ROUTES.includes(token)

  useEffect(() => {
    if (!isEnablementRoute) loadAll()
    else setLoading(false)
  }, [token])

  async function handleUncomplete(session) {
    await supabase.from('sessions').update({ completed: false, completed_at: null }).eq('id', session.id)
    setConfirmUncheck(null)
    loadAll(true)
  }

  async function handleComplete(session) {
    const hasEx = exerciseForms.some(ef => ef.session_keys?.includes(session.title))
    const exDone = hasEx ? exerciseResponses.some(r => exerciseForms.find(ef => ef.session_keys?.includes(session.title) && ef.id === r.exercise_id) && r.responded) : true
    if (!exDone) return // não completa se tiver exercício pendente

    await supabase.from('sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', session.id)
    await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: session.type === 'simulacao' ? 25 : 10, reason: session.type === 'simulacao' ? 'simulacao_concluida' : 'treinamento_concluido', session_id: session.id })
    const { data: gam } = await supabase.from('analyst_gamification').select('xp_total').eq('analyst_id', analyst.id).single()
    if (gam) {
      const newXp = (gam.xp_total || 0) + (session.type === 'simulacao' ? 25 : 10)
      const lvl = getLevelInfo(newXp)
      await supabase.from('analyst_gamification').update({ xp_total: newXp, level: lvl.level, level_name: lvl.name }).eq('analyst_id', analyst.id)
    }
    loadAll(true)
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    const { data: a } = await supabase.from('analysts').select('*').eq('access_token', token).single()
    if (!a || a.status === 'requalificacao') { setLoading(false); return }
    setAnalyst(a)

    const [{ data: sess }, { data: cont }, { data: gam }, { data: er }, { data: exForms }, { data: exResp }] = await Promise.all([
      supabase.from('sessions').select('*, exercises(*), video_submissions(*), session_ratings(*)').eq('analyst_id', a.id).order('day_number'),
      supabase.from('content_items').select('*').or(`team.eq.${a.team},team.eq.ambos`),
      supabase.from('analyst_gamification').select('*').eq('analyst_id', a.id).single(),
      supabase.from('enablement_ratings').select('*, sessions(title, day_number)').eq('analyst_id', a.id).order('created_at', { ascending: false }),
      supabase.from('exercise_forms').select('*').or(`team.eq.${a.team},team.eq.ambos`),
      supabase.from('exercise_responses').select('*').eq('analyst_id', a.id),
    ])

    setSessions(sess || [])
    setContents(cont || [])
    setGamif(gam)
    setEnRatings(er || [])
    setExerciseForms(exForms || [])
    setExerciseResponses(exResp || [])
    setLoading(false)
  }

  async function checkAndGrantBadges(analystId, updatedSessions, updatedGamif) {
    const currentBadges = updatedGamif?.badges || []
    const newBadges = [...currentBadges]
    const completedSessions = updatedSessions.filter(s => s.completed)
    const simulations = completedSessions.filter(s => s.type === 'simulacao')
    const videos = await supabase.from('video_submissions').select('id').eq('analyst_id', analystId)
    const csats = await supabase.from('session_ratings').select('id').eq('analyst_id', analystId)
    const videoCount = videos.data?.length || 0
    const csatCount = csats.data?.length || 0
    const grant = (id) => { if (!newBadges.includes(id)) newBadges.push(id) }

    if (simulations.length >= 1) grant('primeira_simulacao')
    const week1Sessions = updatedSessions.filter(s => s.day_number <= 5)
    if (week1Sessions.length > 0 && week1Sessions.every(s => s.completed)) grant('semana1_completa')
    if ((updatedGamif?.streak_best || 0) >= 7) grant('streak_7')
    if ((updatedGamif?.streak_best || 0) >= 14) grant('streak_14')
    const pmocSessions = updatedSessions.filter(s => s.title?.toLowerCase().includes('pmoc'))
    if (pmocSessions.length > 0 && pmocSessions.every(s => s.completed)) grant('pmoc_master')
    if (videoCount >= 5) grant('diretor')
    if (csatCount >= 20) grant('csat_top')

    if (week1Sessions.length > 0 && week1Sessions.every(s => s.completed)) {
      const w1WithDate = week1Sessions.filter(s => s.completed_at)
      if (w1WithDate.length > 0) {
        const lastW1 = new Date(Math.max(...w1WithDate.map(s => new Date(s.completed_at))))
        const start = new Date(analyst.start_date + 'T12:00:00Z')
        const diffDays = Math.ceil((lastW1 - start) / (1000 * 60 * 60 * 24))
        if (diffDays <= 5) grant('velocista')
      }
    }

    const allDone = updatedSessions.length > 0 && updatedSessions.every(s => s.completed)
    if (allDone) {
      grant('onboarding_completo')
      const ratings = await supabase.from('session_ratings').select('rating').eq('analyst_id', analystId)
      if (ratings.data?.length) {
        const avg = ratings.data.reduce((s, r) => s + r.rating, 0) / ratings.data.length
        if (avg >= 3.5) grant('auvonauta')
      }
    }

    if (newBadges.length !== currentBadges.length) {
      await supabase.from('analyst_gamification').update({ badges: newBadges }).eq('analyst_id', analystId)
    }
  }

  async function submitCsat(sessionId) {
    if (!csatScore) return
    setSubmitting(s => ({ ...s, [sessionId]: true }))
    await supabase.from('session_ratings').upsert(
      { session_id: sessionId, analyst_id: analyst.id, rating: csatScore, comment: csatComment },
      { onConflict: 'session_id,analyst_id' }
    )
    await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: XP_VALUES.csat_respondido, reason: 'csat_respondido', session_id: sessionId })
    if (gamif) {
      const newXp = (gamif.xp_total || 0) + XP_VALUES.csat_respondido
      const lvl = getLevelInfo(newXp)
      await supabase.from('analyst_gamification').update({ xp_total: newXp, level: lvl.level, level_name: lvl.name }).eq('analyst_id', analyst.id)
    }
    setShowCsat(null); setCsatScore(0); setCsatComment('')
    setSubmitting(s => ({ ...s, [sessionId]: false }))
    loadAll(true)
  }

  async function submitVideo(sessionId) {
    const url = videoLinks[sessionId]
    if (!url) return
    setSubmitting(s => ({ ...s, [`v_${sessionId}`]: true }))
    const platform = url.includes('youtube') || url.includes('youtu.be') ? 'youtube'
      : url.includes('drive.google') ? 'drive'
      : url.includes('loom') ? 'loom' : 'outro'
    await supabase.from('video_submissions').upsert(
      { session_id: sessionId, analyst_id: analyst.id, video_url: url, platform, submitted_at: new Date().toISOString() },
      { onConflict: 'session_id,analyst_id' }
    )
    await supabase.from('sessions').update({ video_done: true }).eq('id', sessionId)
    await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: XP_VALUES.video_enviado, reason: 'video_enviado', session_id: sessionId })
    await supabase.from('notifications').insert({ team: analyst.team, type: 'video_submitted', analyst_id: analyst.id, session_id: sessionId, message: `${analyst.name} enviou um vídeo — ${sessions.find(s => s.id === sessionId)?.title}` })
    if (gamif) {
      const newXp = (gamif.xp_total || 0) + XP_VALUES.video_enviado
      const lvl = getLevelInfo(newXp)
      await supabase.from('analyst_gamification').update({ xp_total: newXp, level: lvl.level, level_name: lvl.name }).eq('analyst_id', analyst.id)
    }
    setSubmitting(s => ({ ...s, [`v_${sessionId}`]: false }))
    loadAll(true)
  }

  async function completeSession(session) {
    const hasEx = session.exercises?.length > 0
    const hasCsat = session.session_ratings?.length > 0
    if (hasEx && !session.exercise_done) return
    if (!hasCsat) { setShowCsat(session.id); return }

    await supabase.from('sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', session.id)

    const xpKey = session.type === 'simulacao' ? 'simulacao_concluida' : 'treinamento_concluido'
    await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: XP_VALUES[xpKey], reason: xpKey, session_id: session.id })

    let updatedGamif = gamif
    if (gamif) {
      const newXp = (gamif.xp_total || 0) + XP_VALUES[xpKey]
      const lvl = getLevelInfo(newXp)
      const today = new Date().toISOString().split('T')[0]
      const lastDate = gamif.streak_last_date
      let newStreak = gamif.streak_days || 0
      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        newStreak = lastDate === yesterday ? newStreak + 1 : 1
      }
      const newBest = Math.max(gamif.streak_best || 0, newStreak)
      let bonusXp = 0
      if (newStreak === 5)  bonusXp = XP_VALUES.streak_5_dias
      if (newStreak === 7)  bonusXp = XP_VALUES.streak_7_dias
      if (newStreak === 14) bonusXp = XP_VALUES.streak_14_dias
      if (bonusXp) await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: bonusXp, reason: `streak_${newStreak}_dias` })
      const finalXp = newXp + bonusXp
      const finalLvl = getLevelInfo(finalXp)
      await supabase.from('analyst_gamification').update({ xp_total: finalXp, level: finalLvl.level, level_name: finalLvl.name, streak_days: newStreak, streak_best: newBest, streak_last_date: today }).eq('analyst_id', analyst.id)
      updatedGamif = { ...gamif, xp_total: finalXp, streak_days: newStreak, streak_best: newBest }
    }

    const { data: updatedSessions } = await supabase.from('sessions').select('*').eq('analyst_id', analyst.id)
    await checkAndGrantBadges(analyst.id, updatedSessions || [], updatedGamif)
    loadAll(true)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  if (isEnablementRoute) {
    window.location.href = '/' + token
    return null
  }

  if (!analyst) return (
    <div className="loading-screen">
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 16, color: 'var(--muted2)', marginTop: 8 }}>Link inválido ou expirado</div>
    </div>
  )

  const done = sessions.filter(s => s.completed).length
  const total = sessions.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <>
      <AnalistaLayout analystName={analyst.name} analystTeam={analyst.team}>
        <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, rgba(109,38,194,0.15), rgba(16,185,129,0.06))', border: '1px solid var(--auvo-border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--auvo)', flexShrink: 0 }}>
                {analyst.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Olá, {analyst.name.split(' ')[0]}! 👋</div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                  {analyst.team === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'} · Início em {fmtDateLong(analyst.start_date)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: pct === 100 ? 'var(--green)' : 'var(--auvo)' }}>{pct}%</div>
                <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{done} de {total} sessões</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: pct === 100 ? 'var(--green)' : 'var(--auvo)', transition: 'width 0.7s ease' }} />
            </div>
            {gamif && (
              <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>⭐ {gamif.xp_total || 0} XP · {gamif.level_name}</span>
                {gamif.streak_days > 0 && <span style={{ fontSize: 11, color: 'var(--amber)' }}>🔥 {gamif.streak_days} dias seguidos</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

            {/* Sessions */}
            <div>
              {WEEKS.map(week => {
                const wkSessions = sessions.filter(s => week.days.includes(s.day_number))
                if (!wkSessions.length) return null
                return (
                  <div key={week.label} style={{ marginBottom: 24 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{week.label}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 9, color: 'var(--muted)' }}>{wkSessions.filter(s => s.completed).length}/{wkSessions.length}</span>
                    </div>

                    {week.days.map(day => {
                      const daySessions = wkSessions.filter(s => s.day_number === day)
                      if (!daySessions.length) return null
                      const sessionDate = getSessionDate(analyst.start_date, day)
                      return (
                        <div key={day} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'inline-flex', gap: 6, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 5, marginBottom: 6 }}>
                            <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>Dia {day}</span>
                            <span style={{ color: 'var(--border)' }}>·</span>
                            <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'capitalize' }}>{fmtWeekday(sessionDate)}, {fmtDate(sessionDate)}</span>
                          </div>

                          {daySessions.map(session => {
                            const hasEx = session.exercises?.length > 0
                            const exDone = session.exercise_done
                            const vidDone = session.video_done
                            const hasCsat = session.session_ratings?.length > 0
                            const isNext = !session.completed && sessions.filter(s => !s.completed)[0]?.id === session.id
                            const sessionContents = contents.filter(c => c.session_keys?.includes(session.session_key))
                            const isExpanded = expandedSession === session.id

                            return (
                              <div key={session.id} style={{ marginBottom: 6 }}>
                                <div style={{
                                  padding: '10px 12px', borderRadius: 9, fontSize: 12,
                                  border: `1px solid ${session.completed ? 'rgba(16,185,129,0.2)' : isNext ? 'var(--auvo-border)' : 'var(--border)'}`,
                                  background: session.completed ? 'rgba(16,185,129,0.04)' : isNext ? 'var(--auvo-dim)' : 'var(--surface)',
                                  position: 'relative',
                                  cursor: 'pointer',
                                }}
                                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={session.completed}
                                      onChange={() => {
                                        if (session.completed) setConfirmUncheck(session.id)
                                        else handleComplete(session)
                                      }}
                                      style={{ accentColor: 'var(--green)', flexShrink: 0, cursor: 'pointer' }} />
                                    {confirmUncheck === session.id && (
                                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                                        <span style={{ fontSize: 11, flex: 1 }}>Desfazer conclusão desta sessão?</span>
                                        <button className="btn btn-danger btn-sm" style={{ fontSize: 10 }} onClick={() => handleUncomplete(session)}>Sim, desfazer</button>
                                        <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setConfirmUncheck(null)}>Cancelar</button>
                                      </div>
                                    )}
                                    <span style={{ flex: 1, textDecoration: session.completed ? 'line-through' : 'none', color: session.completed ? 'var(--muted)' : isNext ? 'var(--auvo)' : 'var(--text)', fontWeight: isNext ? 600 : 400 }}>
                                      {session.title} {isNext && '← próxima'}
                                    </span>
                                    <span className={`tag tag-${session.type}`}>{session.type === 'treinamento' ? 'Treino' : 'Simulação'}</span>
                                    {hasCsat && <span style={{ fontSize: 14 }}>{EMOJIS[session.session_ratings[0].rating]}</span>}
                                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '0 0 9px 9px', border: '1px solid var(--border)', borderTop: 'none' }}>

                                    {/* YouTube inline player */}
                                    {showingVideo && showingVideo.sessionId === session.id && (() => {
                                      const url = showingVideo.url
                                      const ytId = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]
                                      return ytId ? (
                                        <div style={{ marginBottom: 10 }}>
                                          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--auvo)' }}>{showingVideo.title}</span>
                                            <button onClick={() => setShowingVideo(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                                          </div>
                                          <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                                            frameBorder="0" allowFullScreen allow="autoplay" style={{ borderRadius: 8 }} title={showingVideo.title} />
                                        </div>
                                      ) : (
                                        <div style={{ marginBottom: 10, padding: '10px', background: 'var(--surface2)', borderRadius: 8, textAlign: 'center' }}>
                                          <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ textDecoration: 'none', fontSize: 11 }}>Abrir vídeo →</a>
                                          <button onClick={() => setShowingVideo(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, marginLeft: 8 }}>✕ Fechar</button>
                                        </div>
                                      )
                                    })()}

                                    {/* Materials */}
                                    {sessionContents.length > 0 && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>📎 Materiais</div>
                                        {sessionContents.map(c => (
                                          <div key={c.id} className="flex items-center gap-2" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                                            <span style={{ fontSize: 14 }}>{c.type === 'youtube' ? '▶️' : c.type === 'pdf' ? '📄' : c.type === 'notebooklm' ? '🤖' : c.type === 'playbook' ? '📘' : '🔗'}</span>
                                            <span style={{ flex: 1 }}>{c.title}</span>
                                            {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--auvo)', textDecoration: 'none' }}>Abrir →</a>}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Exercícios do treino — busca pelo dia da sessão */}
                                    {(() => {
                                      const dayExercises = exerciseForms.filter(ef => ef.session_keys?.includes(session.title))
                                      if (!dayExercises.length) return null
                                      return dayExercises.map(ef => {
                                        const resp = exerciseResponses.find(r => r.exercise_id === ef.id)
                                        return (
                                          <div key={ef.id} style={{ background: resp?.responded ? 'var(--green-dim)' : 'var(--amber-dim)', border: `1px solid ${resp?.responded ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 11 }}>
                                            <div style={{ fontWeight: 600, marginBottom: 4, color: resp?.responded ? 'var(--green)' : 'var(--amber)' }}>
                                              📋 Exercício do treino {resp?.responded ? '✅' : ''}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 8 }}>{ef.title}</div>
                                            {resp?.responded ? (
                                              <div style={{ fontSize: 10, color: 'var(--green)' }}>
                                                ✓ Respondido em {new Date(resp.responded_at).toLocaleDateString('pt-BR')}
                                              </div>
                                            ) : (
                                              <div className="flex gap-2">
                                                <a href={ef.form_url} target="_blank" rel="noreferrer"
                                                  className="btn btn-primary btn-sm" style={{ fontSize: 10, textDecoration: 'none' }}>
                                                  📝 Abrir formulário →
                                                </a>
                                                <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--green)', borderColor: 'rgba(16,185,129,0.3)' }}
                                                  onClick={async () => {
                                                    await supabase.from('exercise_responses').upsert(
                                                      { exercise_id: ef.id, analyst_id: analyst.id, responded: true, responded_at: new Date().toISOString() },
                                                      { onConflict: 'exercise_id,analyst_id' }
                                                    )
                                                    await supabase.from('xp_history').insert({ analyst_id: analyst.id, xp_gained: 15, reason: 'exercicio_enviado', session_id: session.id })
                                                    await supabase.from('notifications').insert({ team: analyst.team, type: 'exercise_submitted', analyst_id: analyst.id, session_id: session.id, message: `${analyst.name} respondeu o exercício "${ef.title}"` })
                                                    loadAll(true)
                                                  }}>
                                                  ✓ Já respondi
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    })()}

                                    {/* Video */}
                                    {!session.video_submissions?.length && (
                                      <div style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 5 }}>🎥 Envie o link da sua gravação</div>
                                        <div className="flex gap-2">
                                          <input value={videoLinks[session.id] || ''} onChange={e => setVideoLinks(v => ({ ...v, [session.id]: e.target.value }))} placeholder="Cole o link do vídeo (YouTube, Drive, Loom...)" style={{ fontSize: 11 }} />
                                          <button className="btn btn-primary btn-sm" style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }} disabled={!videoLinks[session.id] || submitting[`v_${session.id}`]} onClick={() => submitVideo(session.id)}>
                                            {submitting[`v_${session.id}`] ? '...' : 'Enviar'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {vidDone && <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 8 }}>✅ Vídeo enviado!</div>}

                                    {/* Complete button */}
                                    {!session.completed && (
                                      <button className="btn btn-primary btn-sm" style={{ width: '100%', fontSize: 11, marginTop: 4 }}
                                        onClick={() => completeSession(session)}>
                                        {hasCsat ? 'Marcar como concluída' : 'Concluir e avaliar sessão'}
                                      </button>
                                    )}

                                    {/* Avaliar sessão concluída sem CSAT */}
                                    {session.completed && !hasCsat && (
                                      <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, marginTop: 6, color: 'var(--auvo)', borderColor: 'var(--auvo-border)' }}
                                        onClick={() => { setCsatScore(0); setCsatComment(''); setShowCsat(session.id) }}>
                                        ✨ Avaliar esta sessão
                                      </button>
                                    )}

                                    {/* CSAT respondido */}
                                    {session.completed && hasCsat && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--muted2)' }}>
                                        <span style={{ fontSize: 16 }}>{EMOJIS[session.session_ratings[0].rating]}</span>
                                        <span>Você avaliou esta sessão</span>
                                        <button className="btn btn-sm" style={{ fontSize: 9, marginLeft: 'auto' }}
                                          onClick={() => { setCsatScore(session.session_ratings[0].rating); setCsatComment(session.session_ratings[0].comment || ''); setShowCsat(session.id) }}>
                                          Editar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {enRatings.length > 0 && (
                <div className="card">
                  <div className="card-title">Feedback do enablement</div>
                  {enRatings.slice(0, 3).map(r => (
                    <div key={r.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{r.sessions?.title}</span>
                        <span style={{ color: 'var(--auvo)', fontSize: 12 }}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
                      </div>
                      {r.comment && <div style={{ fontSize: 11, color: 'var(--muted2)', borderLeft: '2px solid var(--auvo)', paddingLeft: 8, lineHeight: 1.5 }}>{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}

              {gamif && (
                <div className="card">
                  <div className="card-title">Sua gamificação</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--auvo)', marginBottom: 2 }}>{gamif.xp_total || 0} XP</div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 10 }}>Nível {gamif.level} — {gamif.level_name}</div>
                  {gamif.streak_days > 0 && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>🔥 {gamif.streak_days} dias seguidos</div>}
                  {gamif.badges?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {gamif.badges.map((b, i) => <span key={i} style={{ fontSize: 20 }}>{b}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </AnalistaLayout>

      {/* CSAT Modal — fora do layout para evitar overflow */}
      {showCsat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCsat(null)}>
          <div className="modal" style={{ width: 380 }}>
            <div className="modal-header">
              <div className="modal-title">Como foi essa sessão? ✨</div>
              <button className="modal-close" onClick={() => setShowCsat(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16 }}>Sua avaliação ajuda o enablement a melhorar o onboarding.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
                {[1, 2, 3, 4, 5].map(score => (
                  <button key={score} onClick={() => setCsatScore(score)}
                    style={{ width: 52, height: 52, borderRadius: 12, border: `2px solid ${csatScore === score ? 'var(--auvo)' : 'var(--border2)'}`, background: csatScore === score ? 'var(--auvo-dim)' : 'var(--surface2)', cursor: 'pointer', fontSize: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, transform: csatScore === score ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.15s' }}>
                    <span>{EMOJIS[score]}</span>
                    <span style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'monospace' }}>{score}</span>
                  </button>
                ))}
              </div>
              {csatScore > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>
                    {csatScore <= 2 ? 'O que poderia melhorar?' : 'Alguma anotação sobre esta sessão? (opcional)'}
                  </div>
                  <textarea value={csatComment} onChange={e => setCsatComment(e.target.value)}
                    placeholder={csatScore <= 2 ? 'Conte o que aconteceu...' : 'Principais aprendizados, dúvidas ou observações...'}
                    style={{ minHeight: 70, resize: 'none', fontSize: 12 }} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowCsat(null)}>Agora não</button>
              <button className="btn btn-primary" disabled={!csatScore || submitting[showCsat]} onClick={() => submitCsat(showCsat)}>
                {submitting[showCsat] ? '...' : 'Enviar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
