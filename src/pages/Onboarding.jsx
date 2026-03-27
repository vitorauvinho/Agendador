import { useState, useEffect } from 'react'
import { supabase, TEAM_SESSIONS, WEEKS, getSessionDate, fmtDate, fmtWeekday, fmtDateLong, EXIT_REASONS, XP_VALUES, getLevelInfo } from '../lib/supabase'

export default function Onboarding({ activeTeam }) {
  const [analysts, setAnalysts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [showNote, setShowNote] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [form, setForm] = useState({ name: '', email: '', startDate: '', mode: 'all', picked: [] })
  const [exitForm, setExitForm] = useState({ reason: '', detail: '', date: '' })
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(null)
  const [webhookStatus, setWebhookStatus] = useState(null)

  const allSessions = TEAM_SESSIONS[activeTeam]

  useEffect(() => { loadAnalysts() }, [activeTeam])
  useEffect(() => { if (selectedId) loadSessions(selectedId) }, [selectedId])
  useEffect(() => {
    supabase.from('team_settings').select('*').eq('team', activeTeam).single()
      .then(({ data }) => setSettings(data))
  }, [activeTeam])

  async function loadAnalysts() {
    setLoading(true)
    setSelectedId(null)

    const { data: analystData, error } = await supabase
      .from('analysts')
      .select('*')
      .eq('team', activeTeam)
      .order('created_at', { ascending: false })

    if (error || !analystData) { setLoading(false); return }

    const enriched = await Promise.all(analystData.map(async a => {
      const { data: sess } = await supabase
        .from('sessions').select('id, completed').eq('analyst_id', a.id)
      const { data: ratings } = await supabase
        .from('session_ratings').select('rating').eq('analyst_id', a.id)
      const total = sess?.length || 0
      const done = sess?.filter(s => s.completed).length || 0
      const avgCsat = ratings?.length
        ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
        : null
      return { ...a, total_sessions: total, done_sessions: done,
        progress_pct: total ? Math.round((done / total) * 100) : 0, avg_csat: avgCsat }
    }))

    setAnalysts(enriched)
    setLoading(false)
  }

  async function loadSessions(analystId) {
    const { data } = await supabase
      .from('sessions')
      .select('*, exercises(*), video_submissions(*), session_ratings(*)')
      .eq('analyst_id', analystId)
      .order('day_number')
    setSessions(data || [])
  }

  async function addAnalyst() {
    if (!form.name || !form.email || !form.startDate) return
    setSaving(true)
    const sessionsToUse = form.mode === 'all'
      ? allSessions
      : allSessions.filter(s => form.picked.includes(s.id))

    const { data: analyst, error } = await supabase
      .from('analysts')
      .insert({ name: form.name, email: form.email, team: activeTeam, start_date: form.startDate })
      .select().single()

    if (error || !analyst) { setSaving(false); return }

    // Criar sessões
    const sessionRows = sessionsToUse.map(s => ({
      analyst_id: analyst.id,
      session_key: s.id,
      day_number: s.day,
      type: s.type,
      title: s.title,
    }))
    await supabase.from('sessions').insert(sessionRows)

    // Criar gamificação
    await supabase.from('analyst_gamification').insert({ analyst_id: analyst.id })

    // Notificação
    await supabase.from('notifications').insert({
      team: activeTeam, type: 'session_completed',
      analyst_id: analyst.id,
      message: `Novo analista cadastrado: ${analyst.name}`,
    })

    // Webhook n8n
    if (settings?.webhook_url) {
      setWebhookStatus('loading')
      try {
        await fetch(settings.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analystName: analyst.name, analystEmail: analyst.email,
            myEmail: settings.my_email, startDate: form.startDate,
            sessions: sessionsToUse.map(s => ({ day: s.day, type: s.type, title: s.title, durationMinutes: 60 })),
          }),
        })
        setWebhookStatus('success')
      } catch { setWebhookStatus('error') }
      setTimeout(() => setWebhookStatus(null), 5000)
    }

    setShowAdd(false)
    setForm({ name: '', email: '', startDate: '', mode: 'all', picked: [] })
    setSaving(false)
    await loadAnalysts()
    setSelectedId(analyst.id)
  }

  async function toggleSession(session) {
    if (session.completed) return
    const canComplete =
      (!session.exercises?.length || session.exercise_done) &&
      (!session.video_submissions?.length || session.video_done)
    if (!canComplete) return

    await supabase.from('sessions')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', session.id)

    // XP
    const xpKey = session.type === 'simulacao' ? 'simulacao_concluida' : 'treinamento_concluido'
    const xpVal = XP_VALUES[xpKey]
    await supabase.from('xp_history').insert({ analyst_id: selectedId, xp_gained: xpVal, reason: xpKey, session_id: session.id })
    const { data: gam } = await supabase.from('analyst_gamification').select('xp_total').eq('analyst_id', selectedId).single()
    if (gam) {
      const newXp = (gam.xp_total || 0) + xpVal
      const lvl = getLevelInfo(newXp)
      await supabase.from('analyst_gamification').update({ xp_total: newXp, level: lvl.level, level_name: lvl.name }).eq('analyst_id', selectedId)
    }

    loadSessions(selectedId)
    loadAnalysts()
  }

  async function saveNote(sessionId) {
    await supabase.from('sessions').update({ note: noteText }).eq('id', sessionId)
    setShowNote(null)
    loadSessions(selectedId)
  }

  async function registerExit() {
    if (!exitForm.reason) return
    const target = analysts.find(a => a.id === selectedId)
    if (!target) return
    await supabase.from('analysts').update({
      status: 'desistiu', exit_reason: exitForm.reason,
      exit_detail: exitForm.detail, exit_date: exitForm.date || new Date().toISOString().split('T')[0],
    }).eq('id', selectedId)
    await supabase.from('notifications').insert({
      team: activeTeam, type: 'analyst_exited', analyst_id: selectedId,
      message: `${target.name} saiu do onboarding: ${exitForm.reason}`,
    })
    setShowExit(false)
    setExitForm({ reason: '', detail: '', date: '' })
    loadAnalysts()
  }

  const selected = analysts.find(a => a.id === selectedId)
  const filteredAnalysts = analysts.filter(a => {
    if (filter === 'ativos') return a.status === 'ativo'
    if (filter === 'concluidos') return a.status === 'concluido' || a.progress_pct === 100
    if (filter === 'saiu') return ['desistiu', 'demitido'].includes(a.status)
    return true
  })

  const stats = {
    total: analysts.length,
    ativos: analysts.filter(a => a.status === 'ativo').length,
    avgProg: analysts.length ? Math.round(analysts.reduce((s, a) => s + (a.progress_pct || 0), 0) / analysts.length) : 0,
    avgCsat: analysts.filter(a => a.avg_csat).length
      ? (analysts.reduce((s, a) => s + (a.avg_csat || 0), 0) / analysts.filter(a => a.avg_csat).length).toFixed(1)
      : '—',
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Onboarding <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Gerencie o cronograma dos analistas</div>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          {webhookStatus === 'loading' && <span style={{ fontSize: 11, color: 'var(--auvo)' }}>📅 Agendando...</span>}
          {webhookStatus === 'success' && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Eventos criados!</span>}
          {webhookStatus === 'error'   && <span style={{ fontSize: 11, color: 'var(--red)' }}>✗ Webhook falhou</span>}
          {selectedId && <button className="btn btn-sm" onClick={() => setShowExit(true)}>🚪 Registrar saída</button>}
          <button className="btn btn-primary" onClick={() => { setForm({ name:'', email:'', startDate:'', mode:'all', picked: allSessions.map(s=>s.id) }); setShowAdd(true) }}>
            + Novo analista
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { v: stats.total,   l: 'Total', c: 'var(--auvo)' },
          { v: stats.ativos,  l: 'Ativos', c: 'var(--green)' },
          { v: `${stats.avgProg}%`, l: 'Progresso médio', c: 'var(--auvo)' },
          { v: stats.avgCsat === '—' ? '—' : `😊 ${stats.avgCsat}`, l: 'CSAT médio', c: '#A78BFA' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--auvo)' }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, flex: 1, overflow: 'hidden' }}>

        {/* Analyst list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['todos','Todos'],['ativos','Ativos'],['concluidos','Concluídos'],['saiu','Saíram']].map(([v,l]) => (
              <button key={v} className={`pill ${filter===v?'active':''}`} onClick={() => setFilter(v)} style={{ fontSize: 9 }}>{l}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? (
              <div className="flex items-center justify-between" style={{ padding: '40px 0', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : filteredAnalysts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 12 }}>Nenhum analista ainda</div>
              </div>
            ) : filteredAnalysts.map(a => {
              const isSel = selectedId === a.id
              const isExited = ['desistiu','demitido'].includes(a.status)
              const pct = a.progress_pct || 0
              const pctColor = pct === 100 ? 'var(--green)' : 'var(--auvo)'
              return (
                <div key={a.id}
                  onClick={() => setSelectedId(isSel ? null : a.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${isSel ? 'var(--auvo-border)' : 'var(--border)'}`,
                    background: isSel ? 'var(--auvo-dim)' : 'var(--surface2)',
                    opacity: isExited ? 0.55 : 1, transition: 'all 0.15s',
                  }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
                    </div>
                    <span className={`status-pill status-${a.status}`}>{a.status}</span>
                  </div>
                  <div>
                    <div className="flex justify-between" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: 'var(--muted)' }}>{fmtDateLong(a.start_date)}</span>
                      <span style={{ fontSize: 9, color: pctColor, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: 4 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct===100?'var(--green)':'var(--auvo)', height: '100%' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Session detail */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
              <div style={{ fontSize: 36 }}>👈</div>
              <div style={{ fontSize: 13 }}>Selecione um analista</div>
            </div>
          ) : (
            <>
              {/* Analyst header */}
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: 'var(--auvo)', flexShrink: 0 }}>
                    {selected.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{selected.email} · Início em {fmtDateLong(selected.start_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: selected.progress_pct===100?'var(--green)':'var(--auvo)' }}>{selected.progress_pct || 0}%</div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{selected.done_sessions}/{selected.total_sessions} sessões</div>
                  </div>
                </div>
                <div className="progress-bar-wrap" style={{ height: 6 }}>
                  <div className="progress-bar-fill" style={{ width: `${selected.progress_pct||0}%`, background: selected.progress_pct===100?'var(--green)':'var(--auvo)', height:'100%' }} />
                </div>

                {/* Link único */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7 }}>
                  <span style={{ fontSize: 11 }}>🔗</span>
                  <span style={{ fontSize: 9, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {window.location.origin}/analista/{selected.access_token}
                  </span>
                  <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', flexShrink: 0 }}
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/analista/${selected.access_token}`)}>
                    Copiar
                  </button>
                </div>
              </div>

              {/* Sessions */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {WEEKS.map(week => {
                  const wkSessions = sessions.filter(s => week.days.includes(s.day_number))
                  if (!wkSessions.length) return null
                  const wkDone = wkSessions.filter(s => s.completed).length
                  return (
                    <div key={week.label} style={{ marginBottom: 20 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{week.label}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 9, color: 'var(--muted)' }}>{wkDone}/{wkSessions.length}</span>
                      </div>

                      {week.days.map(day => {
                        const daySessions = wkSessions.filter(s => s.day_number === day)
                        if (!daySessions.length) return null
                        const sessionDate = getSessionDate(selected.start_date, day)
                        return (
                          <div key={day} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 5, marginBottom: 5 }}>
                              <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>Dia {day}</span>
                              <span style={{ color: 'var(--border)' }}>·</span>
                              <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'capitalize' }}>{fmtWeekday(sessionDate)}, {fmtDate(sessionDate)}</span>
                            </div>

                            {daySessions.map(session => {
                              const hasExercise = session.exercises?.length > 0
                              const hasVideo = session.video_submissions?.length > 0
                              const exDone = session.exercise_done
                              const vidDone = session.video_done
                              const canComplete = (!hasExercise || exDone) && (!hasVideo || vidDone)
                              const noteOpen = showNote === session.id

                              return (
                                <div key={session.id} style={{ marginBottom: 4 }}>
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                    border: `1px solid ${session.completed ? 'rgba(16,185,129,0.15)' : 'var(--border)'}`,
                                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.1s',
                                    background: session.completed ? 'rgba(16,185,129,0.04)' : 'var(--surface2)',
                                    fontSize: 11, opacity: (!canComplete && !session.completed) ? 0.6 : 1,
                                  }}
                                    onClick={() => canComplete && !session.completed && toggleSession(session)}
                                  >
                                    <input type="checkbox" checked={session.completed} readOnly
                                      style={{ accentColor: 'var(--green)', flexShrink: 0 }}
                                      onClick={e => { e.stopPropagation(); canComplete && !session.completed && toggleSession(session) }}
                                    />
                                    <span style={{ flex: 1, textDecoration: session.completed ? 'line-through' : 'none', color: session.completed ? 'var(--muted)' : 'var(--text)' }}>
                                      {session.title}
                                    </span>
                                    {hasExercise && <span className="tag tag-exercicio">{exDone ? 'Exercício ✓' : 'Exercício'}</span>}
                                    {hasVideo    && <span className="tag tag-video">{vidDone ? 'Vídeo ✓' : 'Vídeo'}</span>}
                                    <span className={`tag tag-${session.type}`}>{session.type === 'treinamento' ? 'Treino' : 'Simulação'}</span>
                                    {session.session_ratings?.[0] && <span style={{ fontSize: 14 }}>{['','😞','😐','😊','🤩'][session.session_ratings[0].rating]}</span>}
                                    <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 7px', color: session.note ? 'var(--amber)' : 'var(--muted)' }}
                                      onClick={e => { e.stopPropagation(); setNoteText(session.note || ''); setShowNote(noteOpen ? null : session.id) }}>
                                      {session.note ? '📝' : '+ Nota'}
                                    </button>
                                  </div>

                                  {/* Note inline */}
                                  {noteOpen && (
                                    <div style={{ padding: '8px 10px', background: 'var(--surface3)', borderRadius: '0 0 8px 8px', borderTop: 'none', border: '1px solid var(--border)' }}>
                                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                                        placeholder="Anotação sobre esta sessão..."
                                        style={{ height: 60, resize: 'none', fontSize: 11, marginBottom: 6 }}
                                      />
                                      <div className="flex gap-2">
                                        <button className="btn btn-sm" onClick={() => setShowNote(null)}>Cancelar</button>
                                        <button className="btn btn-primary btn-sm" onClick={() => saveNote(session.id)}>Salvar</button>
                                      </div>
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
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: Add Analyst ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 10, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  {activeTeam === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'}
                </div>
                <div className="modal-title">Novo Analista</div>
              </div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                { label: 'Nome completo', key: 'name', type: 'text', ph: 'João Silva' },
                { label: 'E-mail do analista', key: 'email', type: 'email', ph: 'joao@auvo.com.br' },
                { label: 'Data de início', key: 'startDate', type: 'date', ph: '' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label>{f.label}</label>
                  <input type={f.type} value={form[f.key]} placeholder={f.ph}
                    onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} />
                </div>
              ))}

              <div className="form-group">
                <label>Modo de agendamento</label>
                <div className="flex gap-2">
                  {[['all','📅 Agendar tudo'],['custom','✏️ Escolher sessões']].map(([k,l]) => (
                    <button key={k} onClick={() => setForm(x => ({ ...x, mode: k }))}
                      style={{ flex: 1, padding: '9px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                        border: `1px solid ${form.mode===k?'var(--auvo-border)':'var(--border)'}`,
                        background: form.mode===k?'var(--auvo-dim)':'transparent',
                        color: form.mode===k?'var(--auvo)':'var(--muted2)', fontWeight: form.mode===k?600:400 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {form.mode === 'custom' && (
                <div className="form-group">
                  <div className="flex justify-between" style={{ marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Sessões ({form.picked.length}/{allSessions.length})</label>
                    <div className="flex gap-2">
                      <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)' }} onClick={() => setForm(x => ({ ...x, picked: allSessions.map(s=>s.id) }))}>Todas</button>
                      <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setForm(x => ({ ...x, picked: [] }))}>Nenhuma</button>
                    </div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {allSessions.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 0, background: form.picked.includes(s.id) ? 'var(--auvo-dim)' : 'transparent' }}>
                        <input type="checkbox" checked={form.picked.includes(s.id)}
                          onChange={() => setForm(x => ({ ...x, picked: x.picked.includes(s.id) ? x.picked.filter(i=>i!==s.id) : [...x.picked, s.id] }))} />
                        <span style={{ fontSize: 11, flex: 1 }}>Dia {s.day} — {s.title}</span>
                        <span className={`tag tag-${s.type}`} style={{ fontSize: 8 }}>{s.type==='treinamento'?'T':'S'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!settings?.webhook_url && (
                <div style={{ padding: '8px 12px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                  ⚠ Webhook n8n não configurado. Configure em Configurações.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addAnalyst} disabled={saving || (form.mode==='custom' && !form.picked.length)}>
                {saving ? 'Cadastrando...' : `Cadastrar ${form.mode==='custom'?`(${form.picked.length})`:'(31 sessões)'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Exit ── */}
      {showExit && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowExit(false)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Registrar saída — {selected.name}</div>
              <button className="modal-close" onClick={() => setShowExit(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Motivo da saída</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {EXIT_REASONS.map(r => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${exitForm.reason===r?'rgba(239,68,68,0.4)':'var(--border)'}`, background: exitForm.reason===r?'var(--red-dim)':'transparent', cursor: 'pointer', marginBottom: 0, fontSize: 12 }}>
                      <input type="radio" checked={exitForm.reason===r} onChange={() => setExitForm(x=>({...x, reason:r}))} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Observação (opcional)</label>
                <textarea value={exitForm.detail} onChange={e => setExitForm(x=>({...x,detail:e.target.value}))} placeholder="Detalhes adicionais..." style={{ height: 60, resize: 'none', fontSize: 12 }} />
              </div>
              <div className="form-group">
                <label>Data da saída</label>
                <input type="date" value={exitForm.date} onChange={e => setExitForm(x=>({...x,date:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowExit(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={registerExit} disabled={!exitForm.reason}>Confirmar saída</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
