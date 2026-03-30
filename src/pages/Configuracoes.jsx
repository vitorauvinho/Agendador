import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Configuracoes({ activeTeam }) {
  const [form, setForm] = useState({ my_email: '', webhook_url: '', logo_url: '', company_name: 'Auvo' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef()

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

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Somente imagens são permitidas.'); return }
    if (file.size > 2 * 1024 * 1024) { setUploadError('Imagem deve ter menos de 2MB.'); return }

    setUploading(true)
    setUploadError('')

    const ext = file.name.split('.').pop()
    const fileName = `logo_${activeTeam}_${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('images').upload(fileName, file, { upsert: true })
    if (error) { setUploadError('Erro ao fazer upload. Tente novamente.'); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
    setForm(f => ({ ...f, logo_url: urlData.publicUrl }))
    setUploading(false)
  }

  async function removeLogo() {
    setForm(f => ({ ...f, logo_url: '' }))
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
              <label>Logo da empresa</label>

              {/* Upload area */}
              {!form.logo_url ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
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
                    <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--red)' }} onClick={removeLogo}>Remover</button>
                  </div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />

              {uploadError && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>⚠ {uploadError}</div>
              )}
            </div>

            {/* Preview */}
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
