import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ITEM_TYPES = [
  { key: 'treinamento', label: 'Treinamento', icon: '📚' },
  { key: 'simulacao',   label: 'Simulação',   icon: '🎯' },
  { key: 'leitura',     label: 'Leitura',     icon: '📄' },
  { key: 'outro',       label: 'Outro',        icon: '📌' },
]

const REASONS = [
  'Performance abaixo da meta',
  'Retorno após afastamento',
  'Mudança de função/time',
  'Atualização de processos',
  'Solicitação do analista',
  'Outro',
]

export default function Requalificacao({ activeTeam }) {
  const [plans, setPlans] = useState([])
  const [analysts, setAnalysts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [items, setItems] = useState([])
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [planForm, setPlanForm] = useState({ analyst_id: '', analyst_name_free: '', title: 'Plano de Requalificação', reason: '' })
  const [analystMode, setAnalystMode] = useState('existing') // 'existing' | 'free'
  const [showReasons, setShowReasons] = useState(false)
  const [itemForm, setItemForm] = useState({ title: '', type: 'treinamento', description: '', order_index: 0 })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filter, setFilter] = useState('todos')

  useEffect(() => { load() }, [activeTeam])
  useEffect(() => { if (selectedPlan) loadItems(selectedPlan.id) }, [selectedPlan])

  async function load() {
    setLoading(true)
    const [{ data: pl }, { data: ana }] = await Promise.all([
      supabase.from('requalification_plans').select('*, analysts(name, email)')
        .eq('team', activeTeam).order('created_at', { ascending: false }),
      // Note: analysts with requalificacao_ prefix emails are internal only
      supabase.from('analysts').select('id, name, email').eq('team', activeTeam).eq('status', 'ativo'),
    ])
    setPlans(pl || [])
    setAnalysts(ana || [])
    setLoading(false)
  }

  async function loadItems(planId) {
    const { data } = await supabase.from('requalification_items').select('*')
      .eq('plan_id', planId).order('order_index').order('created_at')
    setItems(data || [])
  }

  async function savePlan() {
    const hasAnalyst = analystMode === 'existing' ? !!planForm.analyst_id : !!planForm.analyst_name_free
    if (!hasAnalyst || !planForm.title) return
    setSaving(true)

    let analystId = planForm.analyst_id
    // Se nome livre, cria um registro mínimo na tabela analysts
    if (analystMode === 'free' && planForm.analyst_name_free) {
      const { data: newA } = await supabase.from('analysts').insert({
        name: planForm.analyst_name_free,
        email: `requalificacao_${Date.now()}@interno`,
        team: activeTeam,
        start_date: new Date().toISOString().split('T')[0],
        status: 'requalificacao',
        access_token: null,
      }).select().single()
      analystId = newA?.id
    }

    if (!analystId) { setSaving(false); return }

    const { data } = await supabase.from('requalification_plans')
      .insert({ ...planForm, analyst_id: analystId, team: activeTeam, created_by: 'enablement' })
      .select('*, analysts(name, email)').single()
    setSaving(false)
    setShowPlanForm(false)
    setAnalystMode('existing')
    setPlanForm({ analyst_id: '', analyst_name_free: '', title: 'Plano de Requalificação', reason: '' })
    await load()
    if (data) {
      setSelectedPlan(data)
      // Recarrega os itens se o plano foi selecionado
      loadItems(data.id)
    }
  }

  async function saveItem() {
    if (!itemForm.title || !selectedPlan) return
    setSaving(true)
    if (editingItem) {
      await supabase.from('requalification_items').update(itemForm).eq('id', editingItem)
    } else {
      await supabase.from('requalification_items').insert({ ...itemForm, plan_id: selectedPlan.id, order_index: items.length })
    }
    setSaving(false)
    setShowItemForm(false)
    setEditingItem(null)
    setItemForm({ title: '', type: 'treinamento', description: '', order_index: 0 })
    loadItems(selectedPlan.id)
  }

  async function toggleItem(item) {
    const completed = !item.completed
    await supabase.from('requalification_items').update({
      completed, completed_at: completed ? new Date().toISOString() : null
    }).eq('id', item.id)
    loadItems(selectedPlan.id)
    // Check if all items completed
    const { data: allItems } = await supabase.from('requalification_items').select('completed').eq('plan_id', selectedPlan.id)
    if (allItems?.every(i => i.completed || i.id === item.id ? completed : i.completed)) {
      await supabase.from('requalification_plans').update({ status: 'concluido', concluded_at: new Date().toISOString() }).eq('id', selectedPlan.id)
      load()
    }
  }

  async function updatePlanStatus(planId, status) {
    await supabase.from('requalification_plans').update({ status, concluded_at: status === 'concluido' ? new Date().toISOString() : null }).eq('id', planId)
    load()
  }

  async function deletePlan(id) {
    await supabase.from('requalification_plans').delete().eq('id', id)
    setConfirmDelete(null)
    if (selectedPlan?.id === id) setSelectedPlan(null)
    load()
  }

  async function deleteItem(id) {
    await supabase.from('requalification_items').delete().eq('id', id)
    setConfirmDelete(null)
    loadItems(selectedPlan.id)
  }

  const filtered = plans.filter(p => {
    if (filter === 'em_andamento') return p.status === 'em_andamento'
    if (filter === 'concluido') return p.status === 'concluido'
    return true
  })

  const planProgress = (planId) => {
    if (selectedPlan?.id !== planId) return null
    const total = items.length
    const done = items.filter(i => i.completed).length
    return { total, done, pct: total ? Math.round(done / total * 100) : 0 }
  }

  const STATUS_COLORS = {
    em_andamento: { bg: 'var(--amber-dim)', color: 'var(--amber)', label: 'Em andamento' },
    concluido:    { bg: 'var(--green-dim)', color: 'var(--green)', label: 'Concluído' },
    cancelado:    { bg: 'rgba(255,255,255,0.05)', color: 'var(--muted)', label: 'Cancelado' },
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Requalificação <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Planos de retreinamento para analistas veteranos</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setPlanForm({ analyst_id: '', title: 'Plano de Requalificação', reason: '' }); setShowPlanForm(true) }}>
          + Novo plano
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        {[['todos','Todos'],['em_andamento','Em andamento'],['concluido','Concluídos']].map(([k,l]) => (
          <button key={k} className={`pill ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, flex: 1, overflow: 'hidden' }}>

          {/* Plans list */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔄</div>
                <div style={{ fontSize: 12 }}>Nenhum plano ainda</div>
              </div>
            ) : filtered.map(plan => {
              const sc = STATUS_COLORS[plan.status] || STATUS_COLORS.em_andamento
              const isSel = selectedPlan?.id === plan.id
              return (
                <div key={plan.id} onClick={() => setSelectedPlan(plan)}
                  style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                    border: `1px solid ${isSel ? 'var(--auvo-border)' : 'var(--border)'}`,
                    background: isSel ? 'var(--auvo-dim)' : 'var(--surface2)', transition: 'all 0.15s' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {plan.analysts?.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.analysts?.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{new Date(plan.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{sc.label}</span>
                  </div>
                  {plan.reason && <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 6 }}>{plan.reason}</div>}
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {plan.status === 'em_andamento' && (
                      <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--green)' }} onClick={() => updatePlanStatus(plan.id, 'concluido')}>✓ Concluir</button>
                    )}
                    {confirmDelete === plan.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deletePlan(plan.id)}>Sim</button>
                        <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                      </>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setConfirmDelete(plan.id)}>🗑️</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Plan detail */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedPlan ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
                <div style={{ fontSize: 36 }}>👈</div>
                <div style={{ fontSize: 13 }}>Selecione um plano</div>
              </div>
            ) : (
              <>
                {/* Plan header */}
                <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedPlan.analysts?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{selectedPlan.title}</div>
                      {selectedPlan.reason && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>⚠ {selectedPlan.reason}</div>}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setItemForm({ title: '', type: 'treinamento', description: '', order_index: items.length }); setEditingItem(null); setShowItemForm(true) }}>
                      + Adicionar item
                    </button>
                  </div>
                  {/* Progress */}
                  {items.length > 0 && (() => {
                    const done = items.filter(i => i.completed).length
                    const pct = Math.round(done / items.length * 100)
                    return (
                      <div>
                        <div className="flex justify-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{done} de {items.length} itens concluídos</span>
                          <span style={{ fontSize: 11, color: pct===100?'var(--green)':'var(--auvo)', fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: pct===100?'var(--green)':'var(--auvo)', width: `${pct}%`, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 12 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                      Nenhum item adicionado ainda
                    </div>
                  ) : items.map((item, idx) => {
                    const t = ITEM_TYPES.find(x => x.key === item.type) || ITEM_TYPES[0]
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 9, marginBottom: 6,
                        border: `1px solid ${item.completed ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                        background: item.completed ? 'rgba(16,185,129,0.04)' : 'var(--surface2)' }}>
                        <input type="checkbox" checked={item.completed}
                          onChange={() => toggleItem(item)}
                          style={{ accentColor: 'var(--green)', flexShrink: 0, marginTop: 2, cursor: 'pointer' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--muted)' : 'var(--text)' }}>
                            {item.title}
                          </div>
                          {item.description && <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{item.description}</div>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--auvo-dim)', color: 'var(--auvo)' }}>{t.icon} {t.label}</span>
                            {item.completed && item.completed_at && (
                              <span style={{ fontSize: 9, color: 'var(--green)' }}>✓ {new Date(item.completed_at).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => { setItemForm({...item}); setEditingItem(item.id); setShowItemForm(true) }}>✏️</button>
                          {confirmDelete === item.id ? (
                            <>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteItem(item.id)}>Sim</button>
                              <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDelete(null)}>Não</button>
                            </>
                          ) : (
                            <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDelete(item.id)}>🗑️</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Novo plano */}
      {showPlanForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPlanForm(false)}>
          <div className="modal" style={{ width: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Novo plano de requalificação</div>
              <button className="modal-close" onClick={() => setShowPlanForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Analista */}
              <div className="form-group">
                <label>Analista</label>
                <div className="flex gap-2" style={{ marginBottom: 8 }}>
                  {[['existing','Analista cadastrado'],['free','Novo nome livre']].map(([k,l]) => (
                    <button key={k} onClick={() => setAnalystMode(k)}
                      style={{ flex: 1, padding: '7px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        border: `1px solid ${analystMode===k?'var(--auvo-border)':'var(--border)'}`,
                        background: analystMode===k?'var(--auvo-dim)':'transparent',
                        color: analystMode===k?'var(--auvo)':'var(--muted2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {analystMode === 'existing' ? (
                  <select value={planForm.analyst_id} onChange={e => setPlanForm(f => ({ ...f, analyst_id: e.target.value }))}>
                    <option value="">Selecione o analista...</option>
                    {analysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : (
                  <input value={planForm.analyst_name_free} onChange={e => setPlanForm(f => ({ ...f, analyst_name_free: e.target.value }))}
                    placeholder="Nome do analista veterano" />
                )}
              </div>
              <div className="form-group">
                <label>Título do plano</label>
                <input value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Requalificação — Módulo PMOC" />
              </div>
              <div className="form-group">
                <label>Motivo da requalificação</label>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowReasons(!showReasons)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${planForm.reason ? 'var(--auvo-border)' : 'var(--border2)'}`, background: planForm.reason ? 'var(--auvo-dim)' : 'var(--surface2)', color: planForm.reason ? 'var(--auvo)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                    <span>{planForm.reason || 'Selecione o motivo...'}</span>
                    <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showReasons ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {showReasons && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      {REASONS.map((r, i) => (
                        <div key={r} onClick={() => { setPlanForm(f => ({ ...f, reason: r })); setShowReasons(false) }}
                          style={{ padding: '10px 14px', fontSize: 12, cursor: 'pointer', color: planForm.reason===r ? 'var(--auvo)' : 'var(--text)', background: planForm.reason===r ? 'var(--auvo-dim)' : 'transparent', borderBottom: i < REASONS.length-1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (planForm.reason !== r) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { if (planForm.reason !== r) e.currentTarget.style.background = 'transparent' }}>
                          {planForm.reason===r && <span style={{ marginRight: 6 }}>✓</span>}{r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowPlanForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePlan} disabled={saving || (analystMode==='existing' ? !planForm.analyst_id : !planForm.analyst_name_free)}>
                {saving ? 'Criando...' : 'Criar plano'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo/Editar item */}
      {showItemForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowItemForm(false)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <div className="modal-title">{editingItem ? 'Editar item' : 'Adicionar item'}</div>
              <button className="modal-close" onClick={() => setShowItemForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {ITEM_TYPES.map(t => (
                    <button key={t.key} onClick={() => setItemForm(f => ({ ...f, type: t.key }))}
                      style={{ padding: '8px 4px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        border: `1px solid ${itemForm.type===t.key?'var(--auvo-border)':'var(--border)'}`,
                        background: itemForm.type===t.key?'var(--auvo-dim)':'transparent',
                        color: itemForm.type===t.key?'var(--auvo)':'var(--muted2)', textAlign: 'center' }}>
                      <div>{t.icon}</div><div style={{ fontSize: 9, marginTop: 2 }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Título do treinamento</label>
                <input value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Revisão do módulo PMOC" />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes do treinamento..." style={{ minHeight: 60, resize: 'none' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowItemForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={saving || !itemForm.title}>
                {saving ? 'Salvando...' : editingItem ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
