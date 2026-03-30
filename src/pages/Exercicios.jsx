import { useState, useEffect } from 'react'
import { supabase, TEAM_SESSIONS } from '../lib/supabase'

const EMPTY_FORM = { title: '', description: '', form_url: '', session_keys: [], team: 'atendimento', order_index: 0 }

export default function Exercicios({ activeTeam }) {
  const [exercises, setExercises] = useState([])
  const [responses, setResponses] = useState([])
  const [analysts, setAnalysts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const allSessions = TEAM_SESSIONS[activeTeam]

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)
    const [{ data: ex }, { data: resp }, { data: ana }] = await Promise.all([
      supabase.from('exercise_forms').select('*')
        .or(`team.eq.${activeTeam},team.eq.ambos`)
        .order('order_index').order('created_at'),
      supabase.from('exercise_responses').select('*, analysts(name)'),
      supabase.from('analysts').select('id, name').eq('team', activeTeam).eq('status', 'ativo'),
    ])
    setExercises(ex || [])
    setResponses(resp || [])
    setAnalysts(ana || [])
    setLoading(false)
  }

  async function save() {
    if (!form.title || !form.form_url) return
    setSaving(true)
    if (editing) {
      await supabase.from('exercise_forms').update(form).eq('id', editing)
    } else {
      await supabase.from('exercise_forms').insert({ ...form, team: form.team || activeTeam, order_index: exercises.length })
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    load()
  }

  async function deleteEx(id) {
    await supabase.from('exercise_forms').delete().eq('id', id)
    setConfirmDelete(null)
    load()
  }

  function toggleSession(dayNum) {
    setForm(f => ({
      ...f,
      session_keys: f.session_keys?.includes(dayNum)
        ? f.session_keys.filter(k => k !== dayNum)
        : [...(f.session_keys || []), dayNum]
    }))
  }

  function openEdit(ex) {
    setForm({ ...ex })
    setEditing(ex.id)
    setShowForm(true)
  }

  function getResponsesFor(exId) {
    return responses.filter(r => r.exercise_id === exId && r.responded)
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Exercícios <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
            Formulários do Google Forms vinculados às sessões
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM, team: activeTeam }); setEditing(null); setShowForm(true) }}>
          + Novo exercício
        </button>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : exercises.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 6 }}>Nenhum exercício cadastrado ainda</div>
          <div style={{ fontSize: 12 }}>Crie exercícios e vincule-os às sessões do cronograma</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exercises.map(ex => {
            const exResponses = getResponsesFor(ex.id)
            const isExpanded = expanded === ex.id
            const linkedDays = [...new Set(ex.session_keys || [])].sort((a, b) => a - b)

            return (
              <div key={ex.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => setExpanded(isExpanded ? null : ex.id)}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📋</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ex.title}</div>
                    {ex.description && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{ex.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {linkedDays.length > 0 ? linkedDays.map(d => (
                        <span key={d} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: 'var(--auvo-dim)', color: 'var(--auvo)', fontWeight: 600 }}>Dia {d}</span>
                      )) : (
                        <span style={{ fontSize: 9, color: 'var(--muted)' }}>Sem sessão vinculada</span>
                      )}
                      <span style={{ fontSize: 10, color: exResponses.length > 0 ? 'var(--green)' : 'var(--muted2)', marginLeft: 4 }}>
                        {exResponses.length}/{analysts.length} responderam
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <a href={ex.form_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: 9, color: 'var(--auvo)', textDecoration: 'none' }}>Ver forms →</a>
                    <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => openEdit(ex)}>✏️</button>
                    {confirmDelete === ex.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteEx(ex.id)}>Sim</button>
                        <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                      </>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDelete(ex.id)}>🗑️</button>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded — responses */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Respostas dos analistas
                    </div>
                    {analysts.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum analista ativo</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {analysts.map(a => {
                          const resp = responses.find(r => r.exercise_id === ex.id && r.analyst_id === a.id && r.responded)
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${resp ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`, background: resp ? 'var(--green-dim)' : 'var(--surface)' }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: resp ? 'var(--green-dim)' : 'var(--auvo-dim)', color: resp ? 'var(--green)' : 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                                {a.name.charAt(0)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name.split(' ')[0]}</div>
                                <div style={{ fontSize: 9, color: resp ? 'var(--green)' : 'var(--muted)' }}>
                                  {resp ? `✓ ${new Date(resp.responded_at).toLocaleDateString('pt-BR')}` : 'Pendente'}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Novo/Editar exercício */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 500 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar exercício' : 'Novo exercício'}</div>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título do exercício</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Fixação — Módulo PMOC" />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Sobre o que é esse exercício?" />
              </div>
              <div className="form-group">
                <label>Link do Google Forms</label>
                <input value={form.form_url} onChange={e => setForm(f => ({ ...f, form_url: e.target.value }))}
                  placeholder="https://forms.google.com/..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
                {form.form_url && (
                  <div style={{ marginTop: 6 }}>
                    <a href={form.form_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--auvo)' }}>Testar link →</a>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Disponível para</label>
                <div className="flex gap-2">
                  {[['atendimento', '🎧 Atendimento'], ['vendas', '💼 Vendas'], ['ambos', '🌐 Ambos']].map(([k, l]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, team: k }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        border: `1px solid ${form.team === k ? 'var(--auvo-border)' : 'var(--border)'}`,
                        background: form.team === k ? 'var(--auvo-dim)' : 'transparent',
                        color: form.team === k ? 'var(--auvo)' : 'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Vincular às sessões</label>
                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {allSessions.map(s => (
                    <label key={`${s.day}-${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: `1px solid ${form.session_keys?.includes(s.day) ? 'var(--auvo-border)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 0, background: form.session_keys?.includes(s.day) ? 'var(--auvo-dim)' : 'transparent', fontSize: 11 }}>
                      <input type="checkbox" checked={form.session_keys?.includes(s.day) || false} onChange={() => toggleSession(s.day)} />
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--muted)', marginRight: 2, flexShrink: 0 }}>Dia {s.day}</span>
                      {s.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.title || !form.form_url}>
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar exercício'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
