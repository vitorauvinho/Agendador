import { useState, useEffect, useRef } from 'react'
import { supabase, TEAM_SESSIONS } from '../lib/supabase'

export default function Configuracoes({ activeTeam }) {
  const [form, setForm] = useState({ my_email: '', webhook_url: '', logo_url: '', company_name: 'Auvo', gemini_api_key: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [customSessions, setCustomSessions] = useState([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ title: '', type: 'treinamento', day: '' })
  const [savingSession, setSavingSession] = useState(false)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null)
  const [sessionMode, setSessionMode] = useState('existing')
  const [selectedSessions, setSelectedSessions] = useState([])
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef()

  // Cargos
  const [roles, setRoles] = useState([])
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', session_ids: [] })
  const [savingRole, setSavingRole] = useState(false)
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(null)

  useEffect(() => { load(); loadCustomSessions(); loadRoles() }, [activeTeam])

  // ── Custom Sessions ──────────────────────────────────────────────────────
  async function loadCustomSessions() {
    const { data } = await supabase.from('custom_sessions').select('*')
      .eq('team', activeTeam).order('day').order('created_at')
    setCustomSessions(data || [])
  }

  async function saveSession() {
    setSavingSession(true)
    if (sessionMode === 'existing' && selectedSessions.length > 0 && sessionForm.day) {
      const rows = selectedSessions.map(s => ({
        title: s.title, type: s.type, day: parseInt(sessionForm.day), team: activeTeam,
      }))
      await supabase.from('custom_sessions').insert(rows)
    } else if (sessionForm.title && sessionForm.day) {
      await supabase.from('custom_sessions').insert({
        title: sessionForm.title, type: sessionForm.type,
        day: parseInt(sessionForm.day), team: activeTeam,
      })
    } else { setSavingSession(false); return }
    setSavingSession(false)
    setShowSessionForm(false)
    setSessionForm({ title: '', type: 'treinamento', day: '' })
    setSelectedSessions([])
    setSessionMode('existing')
    loadCustomSessions()
  }

  async function deleteSession(id) {
    await supabase.from('custom_sessions').delete().eq('id', id)
    setConfirmDeleteSession(null)
    loadCustomSessions()
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('team_settings').select('*').eq('team', activeTeam).single()
    if (data) setForm({
      my_email: data.my_email || '',
      webhook_url: data.webhook_url || '',
      logo_url: data.logo_url || '',
      company_name: data.company_name || 'Auvo',
      gemini_api_key: data.gemini_api_key || '',
    })
    setLoading(false)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Somente imagens são permitidas.'); return }
    if (file.size > 2 * 1024 * 1024) { setUploadError('Imagem deve ter menos de 2MB.'); return }
    setUploading(true); setUploadError('')
    const ext = file.name.split('.').pop()
    const fileName = `logo_${activeTeam}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('images').upload(fileName, file, { upsert: true })
    if (error) { setUploadError('Erro ao fazer upload. Tente novamente.'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
    setForm(f => ({ ...f, logo_url: urlData.publicUrl }))
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('team_settings').upsert(
      { team: activeTeam, ...form, updated_at: new Date().toISOString() },
      { onConflict: 'team' }
    )
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  async function loadRoles() {
    const { data } = await supabase.from('roles').select('*')
      .eq('team', activeTeam).order('created_at')
    setRoles(data || [])
  }

  function openRoleForm(role = null) {
    if (role) {
      setEditingRole(role.id)
      setRoleForm({ name: role.name, session_ids: role.session_ids || [] })
    } else {
      setEditingRole(null)
      setRoleForm({ name: '', session_ids: [] })
    }
    setShowRoleForm(true)
  }

  async function saveRole() {
    if (!roleForm.name) return
    setSavingRole(true)
    const payload = { name: roleForm.name, session_ids: roleForm.session_ids, team: activeTeam }
    if (editingRole) {
      await supabase.from('roles').update(payload).eq('id', editingRole)
    } else {
      await supabase.from('roles').insert(payload)
    }
    setSavingRole(false)
    setShowRoleForm(false)
    setEditingRole(null)
    setRoleForm({ name: '', session_ids: [] })
    loadRoles()
  }

  async function deleteRole(id) {
    await supabase.from('roles').delete().eq('id', id)
    setConfirmDeleteRole(null)
    loadRoles()
  }

  function toggleRoleSession(sessionId) {
    const sid = String(sessionId)
    setRoleForm(f => ({
      ...f,
      session_ids: f.session_ids.includes(sid)
        ? f.session_ids.filter(i => i !== sid)
        : [...f.session_ids, sid]
    }))
  }

  const allSessions = [
    ...TEAM_SESSIONS[activeTeam],
    ...customSessions.map(s => ({ id: `custom_${s.id}`, day: s.day, type: s.type, title: s.title }))
  ].sort((a, b) => a.day - b.day || a.title.localeCompare(b.title))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '22px 24px' }}>
      {/* Header fixo */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Configurações <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Identidade visual, cargos e integração com n8n</div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        /* Área com scroll */
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>

            {/* ── Identidade visual ── */}
            <div className="card">
              <div className="card-title">Identidade visual</div>
              <div className="form-group">
                <label>Nome da empresa</label>
                <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Ex: Auvo" />
              </div>
              <div className="form-group">
                <label>Logo da empresa</label>
                {!form.logo_url ? (
                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed var(--border2)', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', background: 'var(--surface2)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--auvo)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                  >
                    {uploading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div className="spinner" />
                        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Fazendo upload...</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted2)', marginBottom: 4 }}>Clique para fazer upload</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>PNG, JPG ou SVG · máx. 2MB</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <img src={form.logo_url} alt="Logo" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>✓ Logo carregada</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>Aparece na sidebar dos analistas</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => fileInputRef.current?.click()}>Trocar</button>
                      <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--red)' }} onClick={() => setForm(f => ({ ...f, logo_url: '' }))}>Remover</button>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                {uploadError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>⚠ {uploadError}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 9, marginTop: 4 }}>
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>
                    {(form.company_name || 'A').charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{form.company_name || 'Auvo'}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>Preview da sidebar</div>
                </div>
              </div>
            </div>

            {/* ── Cargos ── */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 2 }}>Cargos</div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Cada cargo define quais sessões o analista recebe ao ser cadastrado</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openRoleForm()}>+ Novo cargo</button>
              </div>

              {roles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>
                  Nenhum cargo cadastrado ainda
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roles.map(role => (
                    <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{role.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>
                          {role.session_ids?.length || 0} sessões vinculadas
                        </div>
                      </div>
                      <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => openRoleForm(role)}>✏️ Editar</button>
                      {confirmDeleteRole === role.id ? (
                        <>
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteRole(role.id)}>Sim</button>
                          <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDeleteRole(null)}>Não</button>
                        </>
                      ) : (
                        <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDeleteRole(role.id)}>🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sessões ── */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Cronograma de sessões</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setSessionForm({ title: '', type: 'treinamento', day: '' }); setShowSessionForm(true) }}>
                  + Nova sessão
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
                Sessões personalizadas adicionadas aqui aparecem no cronograma de todos os novos analistas deste time.
              </div>
              {customSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>Nenhuma sessão personalizada ainda</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {customSessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: s.type === 'treinamento' ? 'var(--auvo-dim)' : 'var(--green-dim)', color: s.type === 'treinamento' ? 'var(--auvo)' : 'var(--green)', fontWeight: 600, flexShrink: 0 }}>Dia {s.day}</span>
                      <span style={{ fontSize: 12, flex: 1 }}>{s.title}</span>
                      <span style={{ fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>{s.type === 'treinamento' ? '📚 Treino' : '🎯 Simulação'}</span>
                      {confirmDeleteSession === s.id ? (
                        <>
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteSession(s.id)}>Sim</button>
                          <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDeleteSession(null)}>Não</button>
                        </>
                      ) : (
                        <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDeleteSession(s.id)}>🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── n8n ── */}
            <div className="card">
              <div className="card-title">n8n + Google Agenda</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16, lineHeight: 1.7 }}>
                Configure para agendar automaticamente as sessões no Google Agenda ao cadastrar um analista.
              </div>
              <div className="form-group">
                <label>Seu e-mail (Google Calendar)</label>
                <input type="email" value={form.my_email} onChange={e => setForm(f => ({ ...f, my_email: e.target.value }))} placeholder="enablement@auvo.com.br" />
              </div>
              <div className="form-group">
                <label>URL do Webhook n8n</label>
                <input type="url" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder="https://...n8n.cloud/webhook/onboarding" style={{ fontFamily: 'monospace', fontSize: 12 }} />
              </div>
              {form.webhook_url && (
                <div style={{ padding: '8px 12px', background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--green)' }}>
                  ✓ Webhook configurado
                </div>
              )}
            </div>

            {/* ── Gemini API ── */}
            <div className="card">
              <div className="card-title">Gemini API (Avaliações por IA)</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16, lineHeight: 1.7 }}>
                Chave usada para avaliar automaticamente as respostas dos analistas com inteligência artificial.
                Obtenha gratuitamente em <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--auvo)' }}>aistudio.google.com</a>.
              </div>
              <div className="form-group">
                <label>Chave da API do Gemini</label>
                <input
                  type="password"
                  value={form.gemini_api_key}
                  onChange={e => setForm(f => ({ ...f, gemini_api_key: e.target.value }))}
                  placeholder="AIzaSy..."
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              {form.gemini_api_key && (
                <div style={{ padding: '8px 12px', background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--green)' }}>
                  ✓ Chave configurada
                </div>
              )}
            </div>

            <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : saved ? '✓ Configuração salva!' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: Nova sessão ── */}
      {showSessionForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSessionForm(false)}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Nova sessão</div>
              <button className="modal-close" onClick={() => { setShowSessionForm(false); setSelectedSessions([]); setSessionMode('existing') }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Como deseja adicionar?</label>
                <div className="flex gap-2">
                  {[['existing', '📋 Sessão existente'], ['custom', '✏️ Nova sessão']].map(([k, l]) => (
                    <button key={k} onClick={() => { setSessionMode(k); setSessionForm({ title: '', type: 'treinamento', day: '' }) }}
                      style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, border: `1px solid ${sessionMode === k ? 'var(--auvo-border)' : 'var(--border)'}`, background: sessionMode === k ? 'var(--auvo-dim)' : 'transparent', color: sessionMode === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {sessionMode === 'existing' ? (
                <>
                  <div className="form-group">
                    <label>Selecionar do cronograma padrão</label>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 6 }}>
                      Clique para selecionar · {selectedSessions.length} selecionada{selectedSessions.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {TEAM_SESSIONS[activeTeam].map(s => {
                        const isSelected = selectedSessions.some(x => x.id === s.id)
                        return (
                          <div key={s.id} onClick={() => setSelectedSessions(prev => isSelected ? prev.filter(x => x.id !== s.id) : [...prev, s])}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: `1px solid ${isSelected ? 'var(--auvo-border)' : 'var(--border)'}`, background: isSelected ? 'var(--auvo-dim)' : 'var(--surface2)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: 'var(--auvo)', flexShrink: 0, width: 13, height: 13 }} />
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: s.type === 'treinamento' ? 'var(--auvo-dim)' : 'var(--green-dim)', color: s.type === 'treinamento' ? 'var(--auvo)' : 'var(--green)', fontWeight: 600 }}>Dia {s.day}</span>
                            <span style={{ fontSize: 12, flex: 1 }}>{s.title}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {selectedSessions.length > 0 && (
                    <div className="form-group">
                      <label>Em qual dia do cronograma?</label>
                      <input type="number" min="1" max="30" value={sessionForm.day} onChange={e => setSessionForm(f => ({ ...f, day: e.target.value }))} placeholder="Ex: 22" style={{ width: 120 }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tipo</label>
                    <div className="flex gap-2">
                      {[['treinamento', '📚 Treinamento'], ['simulacao', '🎯 Simulação']].map(([k, l]) => (
                        <button key={k} onClick={() => setSessionForm(f => ({ ...f, type: k }))}
                          style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, border: `1px solid ${sessionForm.type === k ? 'var(--auvo-border)' : 'var(--border)'}`, background: sessionForm.type === k ? 'var(--auvo-dim)' : 'transparent', color: sessionForm.type === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Título da sessão</label>
                    <input value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Módulo Financeiro Avançado" />
                  </div>
                  <div className="form-group">
                    <label>Dia do cronograma</label>
                    <input type="number" min="1" max="30" value={sessionForm.day} onChange={e => setSessionForm(f => ({ ...f, day: e.target.value }))} placeholder="Ex: 5" style={{ width: 100 }} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowSessionForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveSession} disabled={savingSession || (sessionMode === 'existing' ? selectedSessions.length === 0 || !sessionForm.day : !sessionForm.title || !sessionForm.day)}>
                {savingSession ? 'Salvando...' : 'Adicionar sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Cargo ── */}
      {showRoleForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRoleForm(false)}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-header">
              <div className="modal-title">{editingRole ? 'Editar cargo' : 'Novo cargo'}</div>
              <button className="modal-close" onClick={() => setShowRoleForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome do cargo</label>
                <input value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Analista de Ativação" />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ marginBottom: 0 }}>
                    Sessões deste cargo
                    <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 400, marginLeft: 6 }}>
                      ({roleForm.session_ids.length}/{allSessions.length} selecionadas)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)' }}
                      onClick={() => setRoleForm(f => ({ ...f, session_ids: allSessions.map(s => String(s.id)) }))}>
                      Todas
                    </button>
                    <button className="btn btn-sm" style={{ fontSize: 9 }}
                      onClick={() => setRoleForm(f => ({ ...f, session_ids: [] }))}>
                      Nenhuma
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 8 }}>
                  Ao cadastrar um analista com este cargo, essas sessões serão pré-selecionadas automaticamente.
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {allSessions.map(s => {
                    const sid = String(s.id)
                    const isChecked = roleForm.session_ids.includes(sid)
                    return (
                      <label key={s.id} onClick={() => toggleRoleSession(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${isChecked ? 'var(--auvo-border)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 0, background: isChecked ? 'var(--auvo-dim)' : 'transparent' }}>
                        <input type="checkbox" checked={isChecked} readOnly style={{ accentColor: 'var(--auvo)', flexShrink: 0 }} />
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: s.type === 'treinamento' ? 'var(--auvo-dim)' : 'var(--green-dim)', color: s.type === 'treinamento' ? 'var(--auvo)' : 'var(--green)', fontWeight: 600, flexShrink: 0 }}>Dia {s.day}</span>
                        <span style={{ fontSize: 11, flex: 1 }}>{s.title}</span>
                        <span style={{ fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>{s.type === 'treinamento' ? '📚' : '🎯'}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowRoleForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveRole} disabled={savingRole || !roleForm.name}>
                {savingRole ? 'Salvando...' : editingRole ? 'Salvar alterações' : 'Criar cargo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
