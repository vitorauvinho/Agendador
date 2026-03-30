import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Configuracoes({ activeTeam }) {
  const [form, setForm] = useState({ my_email: '', webhook_url: '', logo_url: '', company_name: 'Auvo' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [activeTeam])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('team_settings').select('*').eq('team', activeTeam).single()
    if (data) setForm({
      my_email: data.my_email || '',
      webhook_url: data.webhook_url || '',
      logo_url: data.logo_url || '',
      company_name: data.company_name || 'Auvo',
    })
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('team_settings').upsert(
      { team: activeTeam, ...form, updated_at: new Date().toISOString() },
      { onConflict: 'team' }
    )
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
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Identidade visual e integração com n8n</div>
      </div>

      {loading ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1 }}><div className="spinner" /></div>
      ) : (
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Identidade visual */}
          <div className="card">
            <div className="card-title">Identidade visual</div>

            <div className="form-group">
              <label>Nome da empresa</label>
              <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Ex: Auvo" />
            </div>

            <div className="form-group">
              <label>URL da logo</label>
              <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
                💡 Hospede sua logo no Google Drive (compartilhar → link público) ou Imgur e cole a URL aqui.
              </div>
            </div>

            {/* Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 9, marginTop: 4 }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }} />
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

          {/* n8n */}
          <div className="card">
            <div className="card-title">n8n + Google Agenda</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16, lineHeight: 1.7 }}>
              Configure para agendar automaticamente as sessões no Google Agenda ao cadastrar um analista.
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
              <div style={{ padding: '8px 12px', background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--green)' }}>
                ✓ Webhook configurado
              </div>
            )}
          </div>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : saved ? '✓ Configuração salva!' : 'Salvar configurações'}
          </button>
        </div>
      )}
    </div>
  )
}
