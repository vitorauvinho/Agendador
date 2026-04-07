import { useState, useEffect, useRef } from 'react'
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
  const [form, setForm] = useState({ name: '', email: '', startDate: '', mode: 'all', picked: [], turmaMode: false, turmaIds: [], turmaAnalysts: [], roleId: '' })
  const [exitForm, setExitForm] = useState({ reason: '', detail: '', date: '' })
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmUncheck, setConfirmUncheck] = useState(null)
  const [confirmDeleteAnalyst, setConfirmDeleteAnalyst] = useState(null)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null)
  const [showExerciseForm, setShowExerciseForm] = useState(null)
  const [exerciseFormUrl, setExerciseFormUrl] = useState('')
  const [savingExercise, setSavingExercise] = useState(false)
  const [settings, setSettings] = useState(null)
  const [webhookStatus, setWebhookStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('onboarding')
  const [trilhas, setTrilhas] = useState([])
  const [trilhaProgress, setTrilhaProgress] = useState([])
  const [trilhaView, setTrilhaView] = useState('por_trilha')
  const [selectedTrilha, setSelectedTrilha] = useState(null)
  const [selectedAnalystTrilha, setSelectedAnalystTrilha] = useState(null)
  const [exercicios, setExercicios] = useState([])
  const [exResponses, setExResponses] = useState([])
  const [showExForm, setShowExForm] = useState(false)
  const [editingEx, setEditingEx] = useState(null)
  const [exForm, setExForm] = useState({ title: '', description: '', form_url: '', session_keys: [], team: 'atendimento' })
  const [savingEx, setSavingEx] = useState(false)
  const [confirmDeleteEx, setConfirmDeleteEx] = useState(null)
  const [roles, setRoles] = useState([])
  const [showAddSession, setShowAddSession] = useState(false)
  const [newSessionForm, setNewSessionForm] = useState({ title: '', day: 1, type: 'treinamento', custom: false, picked: [] })
  const [savingSession, setSavingSession] = useState(false)
  const [sessionOrder, setSessionOrder] = useState([])
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const [customSessionsList, setCustomSessionsList] = useState([])
  const allSessions = [
    ...TEAM_SESSIONS[activeTeam],
    ...customSessionsList.map(s => ({ id: `custom_${s.id}`, day: s.day, type: s.type, title: s.title }))
  ].sort((a, b) => a.day - b.day || a.title.localeCompare(b.title))

  useEffect(() => { loadAnalysts(); loadCustomSessions(); loadRoles() }, [activeTeam])
  useEffect(() => { if (activeTab === 'trilhas') loadTrilhas() }, [activeTab, activeTeam])
  useEffect(() => { if (activeTab === 'exercicios') loadExercicios() }, [activeTab, activeTeam])
  useEffect(() => { if (selectedId) loadSessions(selectedId) }, [selectedId])
  useEffect(() => { supabase.from('team_settings').select('*').eq('team', activeTeam).single().then(({ data }) => setSettings(data)) }, [activeTeam])
  useEffect(() => { setSessionOrder(sessions.map(s => s.id)) }, [sessions])

  async function loadRoles() {
    const { data } = await supabase.from('roles').select('*').eq('team', activeTeam).order('created_at')
    setRoles(data || [])
  }

  async function loadCustomSessions() {
    const { data } = await supabase.from('custom_sessions').select('*').eq('team', activeTeam).order('day').order('created_at')
    setCustomSessionsList(data || [])
  }

  async function loadAnalysts(preserveSelected = false) {
    setLoading(true)
    if (!preserveSelected) setSelectedId(null)
    const { data: analystData, error } = await supabase.from('analysts').select('*').eq('team', activeTeam).not('email', 'like', 'rq\_%').order('created_at', { ascending: false })
    if (error || !analystData) { setLoading(false); return }
    const enriched = await Promise.all(analystData.map(async a => {
      const { data: sess } = await supabase.from('sessions').select('id, completed').eq('analyst_id', a.id)
      const { data: ratings } = await supabase.from('session_ratings').select('rating').eq('analyst_id', a.id)
      const total = sess?.length || 0
      const done = sess?.filter(s => s.completed).length || 0
      const avgCsat = ratings?.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : null
      return { ...a, total_sessions: total, done_sessions: done, progress_pct: total ? Math.round((done / total) * 100) : 0, avg_csat: avgCsat }
    }))
    setAnalysts(enriched)
    setLoading(false)
  }

  async function loadExercicios() {
    const [{ data: ex }, { data: resp }] = await Promise.all([
      supabase.from('exercise_forms').select('*').or(`team.eq.${activeTeam},team.eq.ambos`).order('order_index').order('created_at'),
      supabase.from('exercise_responses').select('*, analysts(name)'),
    ])
    setExercicios(ex || [])
    setExResponses(resp || [])
  }

  async function saveEx() {
    if (!exForm.title || !exForm.form_url) return
    setSavingEx(true)
    const payload = { ...exForm, team: exForm.team || activeTeam, session_keys: exForm.session_keys || [] }
    if (editingEx) { await supabase.from('exercise_forms').update(payload).eq('id', editingEx) }
    else { await supabase.from('exercise_forms').insert({ ...payload, order_index: exercicios.length }) }
    setSavingEx(false); setShowExForm(false); setEditingEx(null)
    setExForm({ title: '', description: '', form_url: '', session_keys: [], team: activeTeam })
    loadExercicios()
  }

  async function deleteEx(id) { await supabase.from('exercise_forms').delete().eq('id', id); setConfirmDeleteEx(null); loadExercicios() }

  function toggleExSession(sessionTitle) {
    setExForm(f => ({ ...f, session_keys: f.session_keys?.includes(sessionTitle) ? f.session_keys.filter(k => k !== sessionTitle) : [...(f.session_keys || []), sessionTitle] }))
  }

  async function loadTrilhas() {
    const { data: trails } = await supabase.from('video_trails').select('*, video_trail_items(id)').or(`team.eq.${activeTeam},team.eq.ambos`).order('order_index')
    const { data: activeAnalysts } = await supabase.from('analysts').select('id, name').eq('team', activeTeam).eq('status', 'ativo')
    const { data: prog } = await supabase.from('video_trail_progress').select('*')
    setTrilhas(trails || []); setTrilhaProgress(prog || [])
    if (!selectedTrilha && trails?.length) setSelectedTrilha(trails[0])
    if (!selectedAnalystTrilha && activeAnalysts?.length) setSelectedAnalystTrilha(activeAnalysts[0])
  }

  async function loadSessions(analystId) {
    const { data } = await supabase.from('sessions').select('*, exercises(*), video_submissions(*), session_ratings(*)').eq('analyst_id', analystId).order('day_number')
    setSessions(data || [])
  }

  async function deleteSession(sessionId) {
    await supabase.from('sessions').delete().eq('id', sessionId)
    setConfirmDeleteSession(null); loadSessions(selectedId); loadAnalysts(true)
  }

  async function addSessionToAnalyst() {
    if (!newSessionForm.custom && !newSessionForm.picked.length) return
    if (newSessionForm.custom && !newSessionForm.title) return
    setSavingSession(true)
    const maxKey = sessions.length > 0 ? Math.max(...sessions.map(s => s.session_key || 0)) : 0
    if (newSessionForm.custom) {
      await supabase.from('sessions').insert({
        analyst_id: selectedId,
        session_key: maxKey + 1,
        day_number: newSessionForm.day,
        type: newSessionForm.type,
        title: newSessionForm.title,
        completed: false,
      })
    } else {
      for (let i = 0; i < newSessionForm.picked.length; i++) {
        const s = newSessionForm.picked[i]
        await supabase.from('sessions').insert({
          analyst_id: selectedId,
          session_key: maxKey + i + 1,
          day_number: s.day,
          type: s.type,
          title: s.title,
          completed: false,
        })
      }
    }
    setSavingSession(false)
    setShowAddSession(false)
    setNewSessionForm({ title: '', day: 1, type: 'treinamento', custom: false, picked: [] })
    loadSessions(selectedId)
    loadAnalysts(true)
  }

  function handleDragStart(e, id) { dragItem.current = id; e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, id) { e.preventDefault(); dragOver.current = id }
  function handleDrop() {
    if (dragItem.current === dragOver.current) return
    const newOrder = [...sessionOrder]
    const fromIdx = newOrder.indexOf(dragItem.current)
    const toIdx = newOrder.indexOf(dragOver.current)
    newOrder.splice(fromIdx, 1); newOrder.splice(toIdx, 0, dragItem.current)
    setSessionOrder(newOrder)
    dragItem.current = null; dragOver.current = null
  }

  const orderedSessions = sessionOrder.map(id => sessions.find(s => s.id === id)).filter(Boolean)

  async function addAnalyst() {
    const sessionsToUse = form.mode === 'all' ? allSessions : allSessions.filter(s => { const sid = String(s.id); return form.picked.some(p => String(p) === sid) })
    setSaving(true)

    if (form.turmaMode) {
      if (!form.startDate) { setSaving(false); alert('Preencha a data de início!'); return }
      if (!form.name || !form.email) { setSaving(false); alert('Preencha nome e email do primeiro analista!'); return }
      const allTurmaAnalysts = [{ name: form.name, email: form.email }, ...form.turmaAnalysts].filter(a => a.name && a.email)
      if (allTurmaAnalysts.length === 0) { setSaving(false); return }
      const createdAnalysts = []
      for (const a of allTurmaAnalysts) {
        const { data: newA, error } = await supabase.from('analysts').insert({ name: a.name, email: a.email, team: activeTeam, start_date: form.startDate, status: 'ativo', role: roles.find(r => r.id === form.roleId)?.name || null }).select().single()
        if (error || !newA) { console.error('Erro ao criar analista:', a.name, error); continue }
        createdAnalysts.push(newA)
        await supabase.from('sessions').insert(sessionsToUse.map(s => ({ analyst_id: newA.id, session_key: String(s.id).replace('custom_', ''), day_number: s.day, type: s.type, title: s.title })))
        await supabase.from('analyst_gamification').insert({ analyst_id: newA.id })
        await supabase.from('notifications').insert({ team: activeTeam, type: 'session_completed', analyst_id: newA.id, message: `Novo analista cadastrado: ${newA.name}` })
      }
      if (settings?.webhook_url && createdAnalysts.length > 0) {
        setWebhookStatus('loading')
        try {
          await fetch(settings.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analystName: `Turma: ${createdAnalysts.map(a => a.name).join(', ')}`, analystEmail: createdAnalysts[0].email, turmaEmails: createdAnalysts.map(a => a.email), myEmail: settings.my_email, startDate: form.startDate, sessions: sessionsToUse.map(s => ({ day: s.day, type: s.type, title: s.title, durationMinutes: 60 })) }) })
          setWebhookStatus('success')
        } catch { setWebhookStatus('error') }
        setTimeout(() => setWebhookStatus(null), 5000)
      }
      setShowAdd(false); setForm({ name: '', email: '', startDate: '', mode: 'all', picked: [], turmaMode: false, turmaIds: [], turmaAnalysts: [], roleId: '' }); setSaving(false)
      await loadAnalysts(); if (createdAnalysts[0]) setSelectedId(createdAnalysts[0].id)
      return
    }

    if (!form.name || !form.email || !form.startDate) { setSaving(false); return }
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36)
    const { data: analyst, error } = await supabase.from('analysts').insert({ name: form.name, email: form.email, team: activeTeam, start_date: form.startDate, access_token: token, status: 'ativo', role: roles.find(r => r.id === form.roleId)?.name || null }).select().single()
    if (error || !analyst) { setSaving(false); return }
    await supabase.from('sessions').insert(sessionsToUse.map(s => ({ analyst_id: analyst.id, session_key: s.id, day_number: s.day, type: s.type, title: s.title })))
    await supabase.from('analyst_gamification').insert({ analyst_id: analyst.id })
    await supabase.from('notifications').insert({ team: activeTeam, type: 'session_completed', analyst_id: analyst.id, message: `Novo analista cadastrado: ${analyst.name}` })
    if (settings?.webhook_url) {
      setWebhookStatus('loading')
      try {
        await fetch(settings.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analystName: analyst.name, analystEmail: analyst.email, myEmail: settings.my_email, startDate: form.startDate, sessions: sessionsToUse.map(s => ({ day: s.day, type: s.type, title: s.title, durationMinutes: 60 })), turmaEmails: [] }) })
        setWebhookStatus('success')
      } catch { setWebhookStatus('error') }
      setTimeout(() => setWebhookStatus(null), 5000)
    }
    setShowAdd(false); setForm({ name: '', email: '', startDate: '', mode: 'all', picked: [], turmaMode: false, turmaIds: [], turmaAnalysts: [], roleId: '' }); setSaving(false)
    await loadAnalysts(); setSelectedId(analyst.id)
  }

  async function saveExercise(sessionId) {
    if (!exerciseFormUrl) return
    setSavingExercise(true)
    const { data: existing } = await supabase.from('exercises').select('id').eq('session_id', sessionId).single()
    if (existing) { await supabase.from('exercises').update({ form_url: exerciseFormUrl }).eq('id', existing.id) }
    else { await supabase.from('exercises').insert({ session_id: sessionId, analyst_id: selectedId, form_url: exerciseFormUrl }) }
    setSavingExercise(false); setShowExerciseForm(null); setExerciseFormUrl(''); loadSessions(selectedId)
  }

  async function removeExercise(sessionId) { await supabase.from('exercises').delete().eq('session_id', sessionId); loadSessions(selectedId) }

  async function deleteAnalyst(analystId) {
    await supabase.from('sessions').delete().eq('analyst_id', analystId)
    await supabase.from('analyst_gamification').delete().eq('analyst_id', analystId)
    await supabase.from('xp_history').delete().eq('analyst_id', analystId)
    await supabase.from('notifications').delete().eq('analyst_id', analystId)
    await supabase.from('video_trail_progress').delete().eq('analyst_id', analystId)
    await supabase.from('exercise_responses').delete().eq('analyst_id', analystId)
    await supabase.from('session_ratings').delete().eq('analyst_id', analystId)
    await supabase.from('enablement_ratings').delete().eq('analyst_id', analystId)
    await supabase.from('analysts').delete().eq('id', analystId)
    setConfirmDeleteAnalyst(null); setSelectedId(null); loadAnalysts()
  }

  async function uncompleteSession(sessionId) {
    await supabase.from('sessions').update({ completed: false, completed_at: null }).eq('id', sessionId)
    setConfirmUncheck(null); loadSessions(selectedId); loadAnalysts(true)
  }

  async function toggleSession(session) {
    if (session.completed) return
    const canComplete = (!session.exercises?.length || session.exercise_done) && (!session.video_submissions?.length || session.video_done)
    if (!canComplete) return
    await supabase.from('sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', session.id)
    const xpKey = session.type === 'simulacao' ? 'simulacao_concluida' : 'treinamento_concluido'
    const xpVal = XP_VALUES[xpKey]
    await supabase.from('xp_history').insert({ analyst_id: selectedId, xp_gained: xpVal, reason: xpKey, session_id: session.id })
    const { data: gam } = await supabase.from('analyst_gamification').select('xp_total').eq('analyst_id', selectedId).single()
    if (gam) { const newXp = (gam.xp_total || 0) + xpVal; const lvl = getLevelInfo(newXp); await supabase.from('analyst_gamification').update({ xp_total: newXp, level: lvl.level, level_name: lvl.name }).eq('analyst_id', selectedId) }
    loadSessions(selectedId); loadAnalysts(true)
  }

  async function saveNote(sessionId) { await supabase.from('sessions').update({ note: noteText }).eq('id', sessionId); setShowNote(null); loadSessions(selectedId) }

  async function registerExit() {
    if (!exitForm.reason) return
    const target = analysts.find(a => a.id === selectedId)
    if (!target) return
    await supabase.from('analysts').update({ status: 'desistiu', exit_reason: exitForm.reason, exit_detail: exitForm.detail, exit_date: exitForm.date || new Date().toISOString().split('T')[0] }).eq('id', selectedId)
    await supabase.from('notifications').insert({ team: activeTeam, type: 'analyst_exited', analyst_id: selectedId, message: `${target.name} saiu do onboarding: ${exitForm.reason}` })
    setShowExit(false); setExitForm({ reason: '', detail: '', date: '' }); loadAnalysts(false)
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
    avgCsat: analysts.filter(a => a.avg_csat).length ? (analysts.reduce((s, a) => s + (a.avg_csat || 0), 0) / analysts.filter(a => a.avg_csat).length).toFixed(1) : '—',
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Onboarding <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Gerencie o cronograma dos analistas</div>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          {webhookStatus === 'loading' && <span style={{ fontSize: 11, color: 'var(--auvo)' }}>📅 Agendando...</span>}
          {webhookStatus === 'success' && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Eventos criados!</span>}
          {webhookStatus === 'error'   && <span style={{ fontSize: 11, color: 'var(--red)' }}>✗ Webhook falhou</span>}
          {selectedId && <button className="btn btn-sm" onClick={() => setShowExit(true)}>🚪 Registrar saída</button>}
          <button className="btn btn-primary" onClick={() => { setForm({ name:'', email:'', startDate:'', mode:'all', picked: allSessions.map(s=>s.id), turmaMode: false, turmaIds: [], turmaAnalysts: [], roleId: '' }); setShowAdd(true) }}>+ Novo analista</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {[['onboarding','📅 Onboarding'],['trilhas','🎬 Trilhas de vídeo'],['exercicios','📋 Exercícios']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: activeTab===k ? 600 : 400, background: activeTab===k ? 'var(--auvo)' : 'transparent', color: activeTab===k ? '#fff' : 'var(--muted2)', transition: 'all 0.15s' }}>{l}</button>
        ))}
      </div>

      {activeTab === 'exercicios' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted2)' }}>Formulários do Google Forms vinculados às sessões</div>
            <button className="btn btn-primary btn-sm" onClick={() => { setExForm({ title:'',description:'',form_url:'',session_keys:[],team:activeTeam }); setEditingEx(null); setShowExForm(true) }}>+ Novo exercício</button>
          </div>
          {exercicios.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)' }}><div style={{ fontSize:32, marginBottom:8 }}>📋</div><div style={{ fontSize:13, color:'var(--muted2)' }}>Nenhum exercício ainda</div></div>
          ) : (
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
              {exercicios.map(ex => {
                const exResp = exResponses.filter(r => r.exercise_id===ex.id && r.responded)
                const anaAtivos = analysts.filter(a=>a.status==='ativo')
                return (
                  <div key={ex.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ fontSize:20 }}>📋</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{ex.title}</div>
                        {ex.description && <div style={{ fontSize:11, color:'var(--muted2)', marginTop:2 }}>{ex.description}</div>}
                        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                          {ex.session_keys?.length > 0 ? ex.session_keys.slice(0,3).map(k=>(<span key={k} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, background:'var(--auvo-dim)', color:'var(--auvo)', fontWeight:600, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'inline-block' }}>{k}</span>)) : <span style={{ fontSize:9, color:'var(--muted)' }}>Sem sessão vinculada</span>}
                          {ex.session_keys?.length > 3 && <span style={{ fontSize:9, color:'var(--muted)' }}>+{ex.session_keys.length-3}</span>}
                          <span style={{ fontSize:10, color:exResp.length>0?'var(--green)':'var(--muted2)', marginLeft:4 }}>{exResp.length}/{anaAtivos.length} responderam</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={ex.form_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize:9, color:'var(--auvo)', textDecoration:'none' }}>Ver →</a>
                        <button className="btn btn-sm" style={{ fontSize:9 }} onClick={() => { setExForm({...ex}); setEditingEx(ex.id); setShowExForm(true) }}>✏️</button>
                        {confirmDeleteEx===ex.id ? (<><button className="btn btn-danger btn-sm" style={{ fontSize:9 }} onClick={()=>deleteEx(ex.id)}>Sim</button><button className="btn btn-sm" style={{ fontSize:9 }} onClick={()=>setConfirmDeleteEx(null)}>Não</button></>) : (<button className="btn btn-sm" style={{ fontSize:9, color:'var(--red)' }} onClick={()=>setConfirmDeleteEx(ex.id)}>🗑️</button>)}
                      </div>
                    </div>
                    {anaAtivos.length > 0 && (
                      <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:6 }}>
                        {anaAtivos.map(a => {
                          const resp = exResponses.find(r=>r.exercise_id===ex.id&&r.analyst_id===a.id&&r.responded)
                          return (
                            <div key={a.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 8px', borderRadius:7, border:`1px solid ${resp?'rgba(16,185,129,0.2)':'var(--border)'}`, background:resp?'var(--green-dim)':'var(--surface2)', fontSize:11 }}>
                              <div style={{ width:24, height:24, borderRadius:6, background:resp?'var(--green-dim)':'var(--auvo-dim)', color:resp?'var(--green)':'var(--auvo)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:10, flexShrink:0 }}>{a.name.charAt(0)}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:10, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name.split(' ')[0]}</div>
                                <div style={{ fontSize:9, color:resp?'var(--green)':'var(--muted)' }}>{resp?'✓ Respondido':'Pendente'}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {showExForm && (
            <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowExForm(false)}>
              <div className="modal" style={{ width:500 }}>
                <div className="modal-header"><div className="modal-title">{editingEx?'Editar exercício':'Novo exercício'}</div><button className="modal-close" onClick={()=>setShowExForm(false)}>✕</button></div>
                <div className="modal-body">
                  <div className="form-group"><label>Título</label><input value={exForm.title} onChange={e=>setExForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Fixação — Módulo PMOC" /></div>
                  <div className="form-group"><label>Descrição (opcional)</label><input value={exForm.description} onChange={e=>setExForm(f=>({...f,description:e.target.value}))} placeholder="Sobre o que é esse exercício?" /></div>
                  <div className="form-group">
                    <label>Link do Google Forms</label>
                    <input value={exForm.form_url} onChange={e=>setExForm(f=>({...f,form_url:e.target.value}))} placeholder="https://forms.google.com/..." style={{ fontFamily:'monospace', fontSize:12 }} />
                    {exForm.form_url && <a href={exForm.form_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--auvo)', display:'block', marginTop:4 }}>Testar link →</a>}
                  </div>
                  <div className="form-group">
                    <label>Disponível para</label>
                    <div className="flex gap-2">{[['atendimento','🎧 Atendimento'],['vendas','💼 Vendas'],['ambos','🌐 Ambos']].map(([k,l])=>(<button key={k} onClick={()=>setExForm(f=>({...f,team:k}))} style={{ flex:1, padding:'7px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:11, border:`1px solid ${exForm.team===k?'var(--auvo-border)':'var(--border)'}`, background:exForm.team===k?'var(--auvo-dim)':'transparent', color:exForm.team===k?'var(--auvo)':'var(--muted2)' }}>{l}</button>))}</div>
                  </div>
                  <div className="form-group">
                    <label>Vincular às sessões</label>
                    <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
                      {allSessions.map(s=>{ const isChecked = exForm.session_keys?.includes(s.title)||false; return (<label key={`${s.day}-${s.id}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, border:`1px solid ${isChecked?'var(--auvo-border)':'var(--border)'}`, cursor:'pointer', marginBottom:0, background:isChecked?'var(--auvo-dim)':'transparent', fontSize:11 }}><input type="checkbox" checked={isChecked} onChange={()=>toggleExSession(s.title)} /><span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'var(--surface3)', color:'var(--muted)', marginRight:2, flexShrink:0 }}>Dia {s.day}</span>{s.title}</label>) })}
                    </div>
                  </div>
                </div>
                <div className="modal-footer"><button className="btn" onClick={()=>{setShowExForm(false);setEditingEx(null)}}>Cancelar</button><button className="btn btn-primary" onClick={saveEx} disabled={savingEx||!exForm.title||!exForm.form_url}>{savingEx?'Salvando...':editingEx?'Salvar':'Criar exercício'}</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trilhas' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{[['por_trilha','Por trilha'],['por_analista','Por analista']].map(([k,l]) => (<button key={k} className={`pill ${trilhaView===k?'active':''}`} onClick={() => setTrilhaView(k)}>{l}</button>))}</div>
          {trilhas.length === 0 ? (<div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}><div style={{ fontSize: 32, marginBottom: 10 }}>🎬</div><div style={{ fontSize: 13, color: 'var(--muted2)' }}>Nenhuma trilha criada ainda</div></div>
          ) : trilhaView === 'por_trilha' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, flex: 1, overflow: 'hidden' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, overflowY: 'auto' }}>
                {trilhas.map(t => (<div key={t.id} onClick={() => setSelectedTrilha(t)} style={{ padding: '9px 11px', borderRadius: 8, cursor: 'pointer', marginBottom: 5, border: `1px solid ${selectedTrilha?.id===t.id?'var(--auvo-border)':'var(--border)'}`, background: selectedTrilha?.id===t.id?'var(--auvo-dim)':'var(--surface2)' }}><div style={{ fontSize: 12, fontWeight: 600 }}>{t.title}</div><div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{t.video_trail_items?.length || 0} vídeos</div></div>))}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflowY: 'auto' }}>
                {selectedTrilha && (() => {
                  const trailItems = selectedTrilha.video_trail_items || []; const total = trailItems.length
                  const analystRows = analysts.filter(a => a.status === 'ativo').map(a => { const watched = trailItems.filter(i => trilhaProgress.find(p => p.analyst_id===a.id && p.item_id===i.id && p.watched)).length; const lastWatch = trilhaProgress.filter(p => p.analyst_id===a.id && trailItems.find(i=>i.id===p.item_id) && p.watched_at).sort((x,y)=>new Date(y.watched_at)-new Date(x.watched_at))[0]; return { ...a, watched, pct: total ? Math.round(watched/total*100) : 0, lastWatch } })
                  return (<><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selectedTrilha.title}</div><div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 16 }}>{total} vídeos · {analystRows.filter(a=>a.pct===100).length} analistas concluíram</div><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr>{['Analista','Progresso','Vídeos','Último acesso'].map(h=>(<th key={h} style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 500 }}>{h}</th>))}</tr></thead><tbody>{analystRows.map(a => (<tr key={a.id}><td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{a.name}</td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 3, background: a.pct===100?'var(--green)':'var(--auvo)', width: `${a.pct}%` }} /></div><span style={{ fontSize: 10, color: a.pct===100?'var(--green)':'var(--auvo)', fontWeight: 600 }}>{a.pct}%</span></div></td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--muted2)' }}>{a.watched}/{total}</td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>{a.lastWatch ? new Date(a.lastWatch.watched_at).toLocaleDateString('pt-BR') : '—'}</td></tr>))}</tbody></table></>)
                })()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, flex: 1, overflow: 'hidden' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, overflowY: 'auto' }}>
                {analysts.filter(a=>a.status==='ativo').map(a => (<div key={a.id} onClick={() => setSelectedAnalystTrilha(a)} style={{ padding: '9px 11px', borderRadius: 8, cursor: 'pointer', marginBottom: 5, border: `1px solid ${selectedAnalystTrilha?.id===a.id?'var(--auvo-border)':'var(--border)'}`, background: selectedAnalystTrilha?.id===a.id?'var(--auvo-dim)':'var(--surface2)' }}><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{trilhas.filter(t => { const items = t.video_trail_items || []; return items.length > 0 && items.every(i => trilhaProgress.find(p=>p.analyst_id===a.id&&p.item_id===i.id&&p.watched)) }).length}/{trilhas.length} trilhas concluídas</div></div>))}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflowY: 'auto' }}>
                {selectedAnalystTrilha && (<><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{selectedAnalystTrilha.name} — trilhas</div>{trilhas.map(t => { const items = t.video_trail_items || []; const total = items.length; const watched = items.filter(i => trilhaProgress.find(p=>p.analyst_id===selectedAnalystTrilha.id&&p.item_id===i.id&&p.watched)).length; const pct = total ? Math.round(watched/total*100) : 0; return (<div key={t.id} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: 'var(--surface2)' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{t.title}</div><span style={{ fontSize: 11, color: pct===100?'var(--green)':'var(--auvo)', fontWeight: 600 }}>{pct===100?'✓ Concluída':`${watched}/${total} vídeos`}</span></div><div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 5, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, background: pct===100?'var(--green)':'var(--auvo)', width: `${pct}%`, transition: 'width 0.5s ease' }} /></div></div>) })}</>)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'onboarding' && (
      <>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[{ v: stats.total, l: 'Total', c: 'var(--auvo)' }, { v: stats.ativos, l: 'Ativos', c: 'var(--green)' }, { v: `${stats.avgProg}%`, l: 'Progresso médio', c: 'var(--auvo)' }, { v: stats.avgCsat === '—' ? '—' : `😊 ${stats.avgCsat}`, l: 'CSAT médio', c: '#A78BFA' }].map(s => (
          <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--auvo)' }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, flex: 1, overflow: 'hidden' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['todos','Todos'],['ativos','Ativos'],['concluidos','Concluídos'],['saiu','Saíram']].map(([v,l]) => (<button key={v} className={`pill ${filter===v?'active':''}`} onClick={() => setFilter(v)} style={{ fontSize: 9 }}>{l}</button>))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? (<div className="flex items-center justify-between" style={{ padding: '40px 0', justifyContent: 'center' }}><div className="spinner" /></div>
            ) : filteredAnalysts.length === 0 ? (<div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}><div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div><div style={{ fontSize: 12 }}>Nenhum analista ainda</div></div>
            ) : filteredAnalysts.map(a => {
              const isSel = selectedId === a.id; const isExited = ['desistiu','demitido'].includes(a.status); const pct = a.progress_pct || 0; const pctColor = pct === 100 ? 'var(--green)' : 'var(--auvo)'
              return (
                <div key={a.id} onClick={() => setSelectedId(isSel ? null : a.id)} style={{ padding: '10px 12px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${isSel ? 'var(--auvo-border)' : 'var(--border)'}`, background: isSel ? 'var(--auvo-dim)' : 'var(--surface2)', opacity: isExited ? 0.55 : 1, transition: 'all 0.15s' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{a.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.role ? <span style={{ color: 'var(--auvo)' }}>{a.role} · </span> : ''}{a.email}</div>
                    </div>
                    <span className={`status-pill status-${a.status}`}>{a.status}</span>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteAnalyst(a.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted)', padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}>🗑️</button>
                  </div>
                  <div>
                    <div className="flex justify-between" style={{ marginBottom: 3 }}><span style={{ fontSize: 9, color: 'var(--muted)' }}>{fmtDateLong(a.start_date)}</span><span style={{ fontSize: 9, color: pctColor, fontWeight: 600 }}>{pct}%</span></div>
                    <div className="progress-bar-wrap" style={{ height: 4 }}><div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct===100?'var(--green)':'var(--auvo)', height: '100%' }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
              <div style={{ fontSize: 36 }}>👈</div>
              <div style={{ fontSize: 13 }}>Selecione um analista</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: 'var(--auvo)', flexShrink: 0 }}>{selected.name.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{selected.role && <span style={{ color: 'var(--auvo)', fontWeight: 600 }}>{selected.role} · </span>}{selected.email} · Início em {fmtDateLong(selected.start_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: selected.progress_pct===100?'var(--green)':'var(--auvo)' }}>{selected.progress_pct || 0}%</div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{selected.done_sessions}/{selected.total_sessions} sessões</div>
                  </div>
                </div>
                <div className="progress-bar-wrap" style={{ height: 6 }}><div className="progress-bar-fill" style={{ width: `${selected.progress_pct||0}%`, background: selected.progress_pct===100?'var(--green)':'var(--auvo)', height:'100%' }} /></div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {sessions.length > 1 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>↕</span> Arraste para reordenar
                  </div>
                )}

                {orderedSessions.map(session => {
                  const hasExercise = session.exercises?.length > 0
                  const hasVideo = session.video_submissions?.length > 0
                  const exDone = session.exercise_done
                  const vidDone = session.video_done
                  const canComplete = (!hasExercise || exDone) && (!hasVideo || vidDone)
                  const noteOpen = showNote === session.id

                  return (
                    <div key={session.id}
                      draggable
                      onDragStart={e => handleDragStart(e, session.id)}
                      onDragOver={e => handleDragOver(e, session.id)}
                      onDrop={handleDrop}
                      style={{ marginBottom: 6 }}
                    >
                      {confirmUncheck === session.id && (
                        <div style={{ padding: '8px 10px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 4, fontSize: 11 }}>
                          <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>⚠ Desmarcar esta sessão?</div>
                          <div style={{ color: 'var(--muted2)', marginBottom: 8 }}>O XP do analista não será descontado automaticamente.</div>
                          <div className="flex gap-2">
                            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setConfirmUncheck(null)}>Cancelar</button>
                            <button className="btn btn-danger btn-sm" style={{ fontSize: 10 }} onClick={() => uncompleteSession(session.id)}>Sim, desmarcar</button>
                          </div>
                        </div>
                      )}

                      {confirmDeleteSession === session.id && (
                        <div style={{ padding: '8px 10px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 4, fontSize: 11 }}>
                          <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>🗑️ Excluir esta sessão?</div>
                          <div style={{ color: 'var(--muted2)', marginBottom: 8 }}>A sessão será removida da trilha deste analista.</div>
                          <div className="flex gap-2">
                            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setConfirmDeleteSession(null)}>Cancelar</button>
                            <button className="btn btn-danger btn-sm" style={{ fontSize: 10 }} onClick={() => deleteSession(session.id)}>Sim, excluir</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${session.completed ? 'rgba(16,185,129,0.15)' : 'var(--border)'}`, borderRadius: 8, transition: 'all 0.1s', background: session.completed ? 'rgba(16,185,129,0.04)' : 'var(--surface2)', fontSize: 11, opacity: (!canComplete && !session.completed) ? 0.6 : 1 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)', cursor: 'grab', flexShrink: 0, userSelect: 'none' }}>⠿</span>
                        <input type="checkbox" checked={session.completed}
                          style={{ accentColor: 'var(--green)', flexShrink: 0, cursor: 'pointer' }}
                          onChange={e => { e.stopPropagation(); if (session.completed) setConfirmUncheck(session.id); else if (canComplete) toggleSession(session) }}
                          onClick={e => e.stopPropagation()} />
                        <span style={{ flex: 1, textDecoration: session.completed ? 'line-through' : 'none', color: session.completed ? 'var(--muted)' : 'var(--text)' }}>
                          <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace', marginRight: 4 }}>Dia {session.day_number}</span>
                          {session.title}
                        </span>
                        {hasExercise && <span className="tag tag-exercicio">{exDone ? 'Exercício ✓' : 'Exercício'}</span>}
                        {hasVideo    && <span className="tag tag-video">{vidDone ? 'Vídeo ✓' : 'Vídeo'}</span>}
                        <span className={`tag tag-${session.type}`}>{session.type === 'treinamento' ? 'T' : 'S'}</span>
                        {session.session_ratings?.[0] && <span style={{ fontSize: 14 }}>{['','😞','😐','😊','🤩'][session.session_ratings[0].rating]}</span>}
                        <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 7px', color: session.note ? 'var(--amber)' : 'var(--muted)' }}
                          onClick={e => { e.stopPropagation(); setNoteText(session.note || ''); setShowNote(noteOpen ? null : session.id) }}>
                          {session.note ? '📝' : '+ Nota'}
                        </button>
                        {!session.completed && (
                          <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 6px', color: 'var(--red)', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); setConfirmDeleteSession(session.id) }} title="Excluir sessão">
                            🗑️
                          </button>
                        )}
                      </div>

                      {noteOpen && (
                        <div style={{ padding: '8px 10px', background: 'var(--surface3)', borderRadius: '0 0 8px 8px', borderTop: 'none', border: '1px solid var(--border)' }}>
                          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Anotação sobre esta sessão..." style={{ height: 60, resize: 'none', fontSize: 11, marginBottom: 6 }} />
                          <div className="flex gap-2">
                            <button className="btn btn-sm" onClick={() => setShowNote(null)}>Cancelar</button>
                            <button className="btn btn-primary btn-sm" onClick={() => saveNote(session.id)}>Salvar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button onClick={() => setShowAddSession(true)}
                  style={{ width: '100%', padding: '8px', marginTop: 8, borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--auvo)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--auvo-dim)'; e.currentTarget.style.borderColor = 'var(--auvo-border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  + Adicionar sessão à trilha
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </>
      )}

      {/* MODAL: Confirmar exclusão analista */}
      {confirmDeleteAnalyst && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDeleteAnalyst(null)}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header"><div className="modal-title" style={{ color: 'var(--red)' }}>⚠️ Excluir analista</div><button className="modal-close" onClick={() => setConfirmDeleteAnalyst(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted2)' }}>Isso vai remover <strong style={{ color: 'var(--text)' }}>{analysts.find(a => a.id === confirmDeleteAnalyst)?.name}</strong> e todos os dados relacionados permanentemente.</div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>❌ Esta ação não pode ser desfeita.</div>
            </div>
            <div className="modal-footer"><button className="btn" onClick={() => setConfirmDeleteAnalyst(null)}>Cancelar</button><button className="btn btn-danger" onClick={() => deleteAnalyst(confirmDeleteAnalyst)}>Sim, excluir permanentemente</button></div>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar sessão à trilha */}
      {showAddSession && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddSession(false)}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header"><div className="modal-title">Adicionar sessão à trilha</div><button className="modal-close" onClick={() => setShowAddSession(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo</label>
                <div className="flex gap-2" style={{ marginBottom: 12 }}>
                  {[['existing','Sessão existente'],['new','Nova sessão']].map(([k,l]) => (
                    <button key={k} onClick={() => setNewSessionForm(f => ({ ...f, custom: k === 'new', title: '', picked: [] }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, border: `1px solid ${(k==='new'?newSessionForm.custom:!newSessionForm.custom)?'var(--auvo-border)':'var(--border)'}`, background: (k==='new'?newSessionForm.custom:!newSessionForm.custom)?'var(--auvo-dim)':'transparent', color: (k==='new'?newSessionForm.custom:!newSessionForm.custom)?'var(--auvo)':'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {!newSessionForm.custom ? (
                <div className="form-group">
                  <label>Selecionar sessões {newSessionForm.picked.length > 0 && <span style={{ color: 'var(--auvo)', fontSize: 10 }}>({newSessionForm.picked.length} selecionada{newSessionForm.picked.length > 1 ? 's' : ''})</span>}</label>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {allSessions.filter(s => !sessions.find(se => se.title === s.title)).map(s => {
                      const isPicked = newSessionForm.picked.some(p => p.title === s.title)
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${isPicked ? 'var(--auvo-border)' : 'var(--border)'}`, background: isPicked ? 'var(--auvo-dim)' : 'transparent', cursor: 'pointer', marginBottom: 0, fontSize: 12 }}>
                          <input type="checkbox" checked={isPicked}
                            onChange={() => setNewSessionForm(f => ({
                              ...f,
                              picked: isPicked
                                ? f.picked.filter(p => p.title !== s.title)
                                : [...f.picked, { title: s.title, day: s.day, type: s.type }]
                            }))} />
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>Dia {s.day}</span>
                          <span style={{ flex: 1 }}>{s.title}</span>
                          <span className={`tag tag-${s.type}`} style={{ fontSize: 8 }}>{s.type==='treinamento'?'T':'S'}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group"><label>Título da sessão</label><input value={newSessionForm.title} onChange={e => setNewSessionForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Módulo Financeiro Avançado" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group"><label>Dia</label><input type="number" min="1" max="30" value={newSessionForm.day} onChange={e => setNewSessionForm(f => ({ ...f, day: parseInt(e.target.value) || 1 }))} /></div>
                    <div className="form-group">
                      <label>Tipo</label>
                      <div className="flex gap-2">{[['treinamento','Treino'],['simulacao','Simulação']].map(([k,l]) => (<button key={k} onClick={() => setNewSessionForm(f => ({ ...f, type: k }))} style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, border: `1px solid ${newSessionForm.type===k?'var(--auvo-border)':'var(--border)'}`, background: newSessionForm.type===k?'var(--auvo-dim)':'transparent', color: newSessionForm.type===k?'var(--auvo)':'var(--muted2)' }}>{l}</button>))}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddSession(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addSessionToAnalyst}
                disabled={savingSession || (!newSessionForm.custom && !newSessionForm.picked.length) || (newSessionForm.custom && !newSessionForm.title)}>
                {savingSession ? 'Adicionando...' : newSessionForm.picked.length > 1 ? `Adicionar (${newSessionForm.picked.length})` : 'Adicionar sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Analyst */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-header">
              <div><div style={{ fontSize: 10, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{activeTeam === 'atendimento' ? '🎧 Atendimento' : '💼 Vendas'}</div><div className="modal-title">Novo Analista</div></div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              {[{ label: 'Nome completo', key: 'name', type: 'text', ph: 'João Silva' }, { label: 'E-mail do analista', key: 'email', type: 'email', ph: 'joao@auvo.com.br' }, { label: 'Data de início', key: 'startDate', type: 'date', ph: '' }].map(f => (<div key={f.key} className="form-group"><label>{f.label}</label><input type={f.type} value={form[f.key]} placeholder={f.ph} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} /></div>))}
              {roles.length > 0 && (
                <div className="form-group">
                  <label>Cargo</label>
                  <select value={form.roleId} onChange={e => { const roleId = e.target.value; const role = roles.find(r => r.id === roleId); setForm(x => ({ ...x, roleId, mode: role?.session_ids?.length > 0 ? 'custom' : x.mode, picked: role?.session_ids?.length > 0 ? allSessions.filter(s => role.session_ids.includes(String(s.id))).map(s => s.id) : x.picked })) }} style={{ fontFamily: 'inherit', fontSize: 12 }}>
                    <option value="">Selecionar cargo (opcional)</option>
                    {roles.map(r => (<option key={r.id} value={r.id}>{r.name} — {r.session_ids?.length || 0} sessões</option>))}
                  </select>
                  {form.roleId && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4 }}>✓ Sessões pré-selecionadas — você ainda pode editar abaixo</div>}
                </div>
              )}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={form.turmaMode} onChange={e => setForm(x => ({ ...x, turmaMode: e.target.checked, turmaAnalysts: [] }))} style={{ accentColor: 'var(--auvo)', width: 14, height: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: form.turmaMode ? 600 : 400, color: form.turmaMode ? 'var(--auvo)' : 'var(--text)' }}>👥 Cadastrar como turma</span>
                </label>
                {form.turmaMode && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 10 }}>O analista acima + os que você adicionar abaixo entrarão nas mesmas sessões:</div>
                    {form.turmaAnalysts.map((a, idx) => (<div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}><input value={a.name} onChange={e => setForm(x => ({ ...x, turmaAnalysts: x.turmaAnalysts.map((t,i) => i===idx ? {...t, name: e.target.value} : t) }))} placeholder="Nome" style={{ flex: 1, fontSize: 11 }} /><input value={a.email} onChange={e => setForm(x => ({ ...x, turmaAnalysts: x.turmaAnalysts.map((t,i) => i===idx ? {...t, email: e.target.value} : t) }))} placeholder="Email" type="email" style={{ flex: 1, fontSize: 11 }} /><button onClick={() => setForm(x => ({ ...x, turmaAnalysts: x.turmaAnalysts.filter((_,i) => i!==idx) }))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>×</button></div>))}
                    <button className="btn btn-sm" style={{ fontSize: 11, marginTop: 4, width: '100%' }} onClick={() => setForm(x => ({ ...x, turmaAnalysts: [...x.turmaAnalysts, { name: '', email: '' }] }))}>+ Adicionar analista à turma</button>
                    {form.turmaAnalysts.length > 0 && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--green)' }}>✓ {1 + form.turmaAnalysts.length} analistas serão cadastrados juntos</div>}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Modo de agendamento</label>
                <div className="flex gap-2">{[['all','📅 Agendar tudo'],['custom','✏️ Escolher sessões']].map(([k,l]) => (<button key={k} onClick={() => setForm(x => ({ ...x, mode: k }))} style={{ flex: 1, padding: '9px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, border: `1px solid ${form.mode===k?'var(--auvo-border)':'var(--border)'}`, background: form.mode===k?'var(--auvo-dim)':'transparent', color: form.mode===k?'var(--auvo)':'var(--muted2)', fontWeight: form.mode===k?600:400 }}>{l}</button>))}</div>
              </div>
              {form.mode === 'custom' && (
                <div className="form-group">
                  <div className="flex justify-between" style={{ marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Sessões ({form.picked.length}/{allSessions.length})</label>
                    <div className="flex gap-2"><button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)' }} onClick={() => setForm(x => ({ ...x, picked: allSessions.map(s=>s.id) }))}>Todas</button><button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setForm(x => ({ ...x, picked: [] }))}>Nenhuma</button></div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {allSessions.map(s => (<label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 0, background: form.picked.includes(s.id) ? 'var(--auvo-dim)' : 'transparent' }}><input type="checkbox" checked={form.picked.includes(s.id)} onChange={() => setForm(x => ({ ...x, picked: x.picked.includes(s.id) ? x.picked.filter(i=>i!==s.id) : [...x.picked, s.id] }))} /><span style={{ fontSize: 11, flex: 1 }}>Dia {s.day} — {s.title}</span><span className={`tag tag-${s.type}`} style={{ fontSize: 8 }}>{s.type==='treinamento'?'T':'S'}</span></label>))}
                  </div>
                </div>
              )}
              {!settings?.webhook_url && (<div style={{ padding: '8px 12px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ Webhook n8n não configurado. Configure em Configurações.</div>)}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addAnalyst} disabled={saving || !form.startDate || (!form.turmaMode && (!form.name || !form.email)) || (form.mode==='custom' && !form.turmaMode && !form.picked.length)}>
                {saving ? 'Cadastrando...' : form.turmaMode ? `Cadastrar turma (${1 + form.turmaAnalysts.length} analistas)` : `Cadastrar ${form.mode==='custom'?`(${form.picked.length} sessões)`:'(todas as sessões)'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Exit */}
      {showExit && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowExit(false)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header"><div className="modal-title">Registrar saída — {selected.name}</div><button className="modal-close" onClick={() => setShowExit(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Motivo da saída</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {EXIT_REASONS.map(r => (<label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${exitForm.reason===r?'rgba(239,68,68,0.4)':'var(--border)'}`, background: exitForm.reason===r?'var(--red-dim)':'transparent', cursor: 'pointer', marginBottom: 0, fontSize: 12 }}><input type="radio" checked={exitForm.reason===r} onChange={() => setExitForm(x=>({...x, reason:r}))} />{r}</label>))}
                </div>
              </div>
              <div className="form-group"><label>Observação (opcional)</label><textarea value={exitForm.detail} onChange={e => setExitForm(x=>({...x,detail:e.target.value}))} placeholder="Detalhes adicionais..." style={{ height: 60, resize: 'none', fontSize: 12 }} /></div>
              <div className="form-group"><label>Data da saída</label><input type="date" value={exitForm.date} onChange={e => setExitForm(x=>({...x,date:e.target.value}))} /></div>
            </div>
            <div className="modal-footer"><button className="btn" onClick={() => setShowExit(false)}>Cancelar</button><button className="btn btn-danger" onClick={registerExit} disabled={!exitForm.reason}>Confirmar saída</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
