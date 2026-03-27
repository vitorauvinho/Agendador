import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Configuracoes({ activeTeam }) {
  const [form, setForm] = useState({ my_email: '', webhook_url: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('team_settings').select('*').eq('team', activeTeam).single()
    if (data) setForm({ my_email: data.my_email || '', webhook_url: data.webhook_url || '' })
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('team_settings').upsert({ team: activeTeam, ...form, updated_at: new Date().toISOString() }, { onConflict: 'team' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Configurações <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Integração com n8n e Google Agenda</div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">n8n + Google Agenda</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 20, lineHeight: 1.7 }}>
              Configure abaixo para que o sistema agende automaticamente todas as sessões no Google Agenda ao cadastrar um novo analista.
            </div>

            <div className="form-group">
              <label>Seu e-mail (Google Calendar)</label>
              <input type="email" value={form.my_email} onChange={e => setForm(f => ({ ...f, my_email: e.target.value }))}
                placeholder="enablement@auvo.com.br" />
            </div>

            <div className="form-group">
              <label>URL do Webhook n8n</label>
              <input type="url" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                placeholder="https://...n8n.cloud/webhook/onboarding" style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>

            {form.webhook_url && (
              <div style={{ padding: '10px 12px', background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--green)', marginBottom: 16 }}>
                ✓ Webhook configurado. O Google Agenda será atualizado ao cadastrar analistas.
              </div>
            )}

            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : saved ? '✓ Configuração salva!' : 'Salvar configuração'}
            </button>
          </div>

          <div className="card">
            <div className="card-title">Como configurar o n8n</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>1. Abra seu n8n → crie um novo workflow</div>
              <div style={{ marginBottom: 8 }}>2. Adicione o nó <strong style={{ color: 'var(--text)' }}>Webhook</strong> como trigger</div>
              <div style={{ marginBottom: 8 }}>3. Copie a URL gerada e cole no campo acima</div>
              <div style={{ marginBottom: 8 }}>4. Adicione os nós do <strong style={{ color: 'var(--text)' }}>Google Calendar</strong> para criar os eventos</div>
              <div>5. Ative o workflow e teste cadastrando um analista</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
