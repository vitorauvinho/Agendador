import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const PLAYBOOK_CONTEXT = `
Você é um avaliador especialista em implantação de software SaaS (Auvo), avaliando analistas de CS e Implantação.

HABILIDADES ESPERADAS DO ANALISTA (baseado no Playbook de Implantação Auvo 2026):

1. COMPREENSÃO DE CENÁRIO DO CLIENTE: Capacidade de validar dores, processos e objetivos através de perguntas corretas de qualificação. O analista deve entender o processo atual do cliente, quem são os usuários técnicos, qual a principal dor que motivou a contratação e qual o objetivo principal a ser atingido com o Auvo.

2. CONEXÃO DE VALOR: Habilidade técnica de conectar funcionalidades específicas do Auvo às dores levantadas pelo cliente durante o processo comercial. O analista deve identificar a funcionalidade principal que resolve a dor do cliente e demonstrar isso de forma prática.

3. RAPPORT E CONEXÃO HUMANA: Capacidade de criar conexão genuína com o cliente, gerando confiança e engajamento. O analista deve ser empático, personalizar a abordagem e criar um ambiente de colaboração.

4. ESTRUTURA DA REUNIÃO: Saber realizar treinamentos práticos seguindo a metodologia Auvo:
   - ENTENDER: Compreender processo, dor e objetivo do cliente ANTES de ensinar
   - DEMONSTRAR: Mostrar como o Auvo atende às expectativas conectando funcionalidades aos objetivos
   - EXECUTAR: Criar tarefas REAIS para o cliente começar a usar imediatamente
   
5. REUNIÕES ESTRUTURADAS: O analista deve conseguir conduzir tanto treinamentos para gestores (Web/Service) quanto para técnicos de campo (App), garantindo que o cliente crie pelo menos 2 tarefas operacionais reais até D+5.

CRITÉRIOS DE AVALIAÇÃO:
- Nota de 0 a 10 por habilidade avaliada
- Identificar pontos fortes específicos com exemplos da resposta
- Identificar pontos de melhoria com sugestões práticas e acionáveis
- Ser construtivo e encorajador, focado no desenvolvimento do analista
`

const WEEKLY_CRITERIA = {
  1: [
    { key: 'engajamento', label: 'Engajamento e Proatividade', desc: 'Participação ativa, iniciativa própria, pontualidade' },
    { key: 'produto', label: 'Conhecimento do Produto', desc: 'Domínio básico do Auvo Service e App' },
    { key: 'postura', label: 'Postura e Atitude', desc: 'Abertura para feedback, comprometimento, comunicação interna' },
  ],
  2: [
    { key: 'cenario', label: 'Validação de Cenário', desc: 'Consegue entender o contexto, dor e objetivo do cliente com perguntas corretas' },
    { key: 'conexao', label: 'Conexão Dor → Funcionalidade', desc: 'Conecta as dores do cliente às funcionalidades do Auvo de forma clara' },
    { key: 'rapport', label: 'Rapport e Conexão Humana', desc: 'Cria conexão genuína, é empático e gera confiança no cliente' },
    { key: 'estrutura', label: 'Estrutura da Reunião', desc: 'Segue a metodologia Entender → Demonstrar → Executar' },
  ],
  3: [
    { key: 'carteira', label: 'Gestão de Carteira', desc: 'Organização, priorização e acompanhamento proativo dos clientes' },
    { key: 'hubspot', label: 'Uso do HubSpot', desc: 'Registro correto de atividades, tickets e atualizações' },
    { key: 'indicadores', label: 'Leitura de Indicadores', desc: 'Identifica riscos e gargalos de ativação pelos dados' },
  ],
  4: [
    { key: 'autonomia', label: 'Autonomia no T1', desc: 'Consegue conduzir o primeiro treinamento sem apoio do enablement' },
    { key: 'ativacao', label: 'Taxa de Ativação', desc: 'Resultados dos primeiros clientes reais — engajamento e uso' },
    { key: 'autoconfianca', label: 'Autoconfiança e Postura', desc: 'Segurança na condução das reuniões e tomada de decisão' },
  ],
}

export default function Avaliacoes({ activeTeam }) {
  const [analysts, setAnalysts] = useState([])

  const [selectedAnalyst, setSelectedAnalyst] = useState(null)
  const [exercises, setExercises] = useState([])
  const [formResponses, setFormResponses] = useState([])
  const [weeklyEvals, setWeeklyEvals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ia') // 'ia' | 'semanal'

  // Upload CSV
  const [showUpload, setShowUpload] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [uploading, setUploading] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [confirmDeleteEx, setConfirmDeleteEx] = useState(null) // exerciseId a apagar
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const fileInputRef = useRef()

  // Avaliação semanal
  const [showWeeklyForm, setShowWeeklyForm] = useState(false)
  const [weeklyForm, setWeeklyForm] = useState({ week: 1, scores: {}, comment: '' })
  const [savingWeekly, setSavingWeekly] = useState(false)

  useEffect(() => { loadAll() }, [activeTeam])
  useEffect(() => { if (selectedAnalyst) loadAnalystData(selectedAnalyst.id) }, [selectedAnalyst])

  async function loadAll() {
    setLoading(true)
    const [{ data: ana }, { data: ex }] = await Promise.all([
      supabase.from('analysts').select('*').eq('team', activeTeam).eq('status', 'ativo').order('name'),
      supabase.from('exercise_forms').select('*').or(`team.eq.${activeTeam},team.eq.ambos`),
    ])
    setAnalysts(ana || [])
    setExercises(ex || [])
    setLoading(false)
  }

  async function loadAnalystData(analystId) {
    const [{ data: resp }, { data: weekly }] = await Promise.all([
      supabase.from('form_responses').select('*').eq('analyst_id', analystId).order('created_at', { ascending: false }),
      supabase.from('weekly_evaluations').select('*').eq('analyst_id', analystId).order('week'),
    ])
    setFormResponses(resp || [])
    setWeeklyEvals(weekly || [])
  }

  // ── Alerta de avaliação pendente ─────────────────────────────────────────
  function getWeeklyAlert(analyst) {
    if (!analyst.start_date) return null
    const start = new Date(analyst.start_date + 'T12:00:00Z')
    const today = new Date()
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24))
    const weeksDue = Math.min(Math.floor(diffDays / 7) + 1, 4)
    // Verifica quais semanas já foram avaliadas
    const { data: evals } = { data: weeklyEvals.filter(e => e.analyst_id === analyst.id) }
    const evaluated = (evals || []).map(e => e.week)
    for (let w = 1; w <= weeksDue; w++) {
      if (!evaluated.includes(w)) return w
    }
    return null
  }

  // ── Upload e parse de CSV ─────────────────────────────────────────────────
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const XLSX = window.XLSX
        if (!XLSX) { alert('Biblioteca não carregada. Recarregue a página.'); return }

        const data = new Uint8Array(ev.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rows.length) { alert('Planilha vazia ou sem dados.'); return }

        const headers = Object.keys(rows[0])
        const emailKey = headers.find(h =>
          h.toLowerCase().includes('e-mail') ||
          h.toLowerCase() === 'email' ||
          h.toLowerCase().includes('endere')
        )

        if (!emailKey) {
          alert('Coluna de e-mail não encontrada.\nVerifique se o Google Forms está configurado para coletar endereços de e-mail.')
          return
        }

        const valid = rows
          .map(r => ({ ...r, _emailKey: emailKey }))
          .filter(r => String(r[emailKey] || '').includes('@'))

        if (!valid.length) { alert('Nenhuma linha com e-mail válido encontrada.'); return }

        setCsvData(valid)
      } catch (err) {
        console.error('Erro ao ler arquivo:', err)
        alert('Erro ao ler o arquivo. Use .xlsx exportado do Google Sheets.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function processAndEvaluate() {
    if (!csvData.length || !selectedExercise) return
setEvaluating(true)
    setUploadError('')

    const skipCols = [
      'endereço de e-mail', 'email', 'e-mail',
      'carimbo de data/hora', 'timestamp', 'marca temporal',
      '_emailkey'
    ]

    // Conta total de perguntas a avaliar
    let totalQuestions = 0
    const validRows = []
    for (const row of csvData) {
      const emailKey = row['_emailKey'] || 'Endereço de e-mail'
      const email = (row[emailKey] || '').toLowerCase()
      const analyst = analysts.find(a => a.email?.toLowerCase() === email)
      if (!analyst) continue
      const questions = Object.entries(row).filter(([k, v]) =>
        !skipCols.includes(k.toLowerCase()) && v && String(v).length >= 5
      )
      if (questions.length) {
        validRows.push({ analyst, questions })
        totalQuestions += questions.length
      }
    }

    if (validRows.length === 0) {
      setUploadError('Nenhum analista encontrado no arquivo. Verifique se os e-mails do arquivo batem com os e-mails cadastrados no sistema.')
      setEvaluating(false)
      return
    }

    setUploadProgress({ current: 0, total: totalQuestions })
    let current = 0
    let hasError = false

    for (const { analyst, questions } of validRows) {
      for (const [question, answer] of questions) {
        try {
          const aiResult = await evaluateWithGemini(question, String(answer), selectedExercise)
          await supabase.from('form_responses').insert({
            analyst_id: analyst.id,
            exercise_id: selectedExercise.id,
            question,
            answer: String(answer),
            ai_score: aiResult.score,
            ai_feedback: aiResult.feedback,
            evaluated_at: new Date().toISOString(),
          })
          current++
          setUploadProgress({ current, total: totalQuestions })
          // Delay de 4s entre chamadas para respeitar limite de 15 req/min do Gemini gratuito
          await new Promise(res => setTimeout(res, 4000))
        } catch (err) {
          console.error('Erro ao avaliar:', err)
          hasError = true
          // Em caso de 429, espera 10s antes de continuar
          await new Promise(res => setTimeout(res, 10000))
        }
      }
    }

    setEvaluating(false)
    setUploadProgress({ current: 0, total: 0 })

    if (hasError) {
      setUploadError('Algumas respostas não puderam ser avaliadas pela IA. As demais foram salvas normalmente.')
    } else {
      setShowUpload(false)
      setCsvData([])
      setSelectedExercise(null)
      setUploadError('')
    }

    if (selectedAnalyst) loadAnalystData(selectedAnalyst.id)
    loadAll()
  }

  async function evaluateWithGemini(question, answer, exercise) {
    const prompt = `${PLAYBOOK_CONTEXT}

EXERCÍCIO: ${exercise.title}
${exercise.description ? `DESCRIÇÃO: ${exercise.description}` : ''}

PERGUNTA AVALIADA: ${question}

RESPOSTA DO ANALISTA: ${answer}

Avalie APENAS esta resposta específica. Retorne SOMENTE um JSON válido no formato:
{"score": <número de 0 a 10>, "feedback": "<feedback construtivo em português, máximo 3 frases>", "strengths": "<ponto forte específico>", "improvements": "<sugestão de melhoria específica>"}`


    // Chama via Edge Function — chave nunca exposta no frontend
    const { data, error } = await supabase.functions.invoke('swift-function', {
      body: { prompt }
    })

    console.log('Edge Function retornou:', JSON.stringify(data))
    if (error) { console.error('Edge Function error:', error); throw new Error(error.message) }

    // Edge Function já retorna o texto limpo em data.text
    const clean = (data?.text || '{}').trim()
    console.log('Clean text:', clean)
    try {
      const parsed = JSON.parse(clean)
      console.log('Parsed:', parsed)
      if (!parsed.score && parsed.score !== 0) throw new Error('Invalid score')
      return parsed
    } catch (e) {
      console.error('Parse error:', e.message, 'Raw:', clean)
      return { score: 0, feedback: 'Não foi possível avaliar automaticamente.', strengths: '', improvements: '' }
    }
  }

  // ── Avaliação semanal ─────────────────────────────────────────────────────
  async function saveWeeklyEval() {
    if (!selectedAnalyst) return
    setSavingWeekly(true)
    const criteria = WEEKLY_CRITERIA[weeklyForm.week] || []
    const scores = criteria.map(c => ({ key: c.key, label: c.label, score: weeklyForm.scores[c.key] || 0 }))
    const avg = scores.reduce((s, c) => s + c.score, 0) / scores.length

    await supabase.from('weekly_evaluations').upsert({
      analyst_id: selectedAnalyst.id,
      week: weeklyForm.week,
      scores,
      avg_score: Math.round(avg * 10) / 10,
      comment: weeklyForm.comment,
      evaluated_at: new Date().toISOString(),
    }, { onConflict: 'analyst_id,week' })

    setSavingWeekly(false)
    setShowWeeklyForm(false)
    setWeeklyForm({ week: 1, scores: {}, comment: '' })
    loadAnalystData(selectedAnalyst.id)
  }

  // ── Exclusão de avaliações por IA ────────────────────────────────────────
  async function deleteExerciseResponses(exId) {
    const ids = formResponses.filter(r => (r.exercise_id || 'sem_exercicio') === exId).map(r => r.id)
    if (!ids.length) return
    await supabase.from('form_responses').delete().in('id', ids)
    setConfirmDeleteEx(null)
    if (selectedAnalyst) loadAnalystData(selectedAnalyst.id)
  }

  async function deleteAllResponses() {
    const ids = formResponses.map(r => r.id)
    if (!ids.length) return
    await supabase.from('form_responses').delete().in('id', ids)
    setConfirmDeleteAll(false)
    if (selectedAnalyst) loadAnalystData(selectedAnalyst.id)
  }

  // ── Helpers visuais ───────────────────────────────────────────────────────
  function scoreColor(s) {
    if (s >= 8) return 'var(--green)'
    if (s >= 6) return 'var(--amber)'
    return 'var(--red)'
  }

  function scoreEmoji(s) {
    if (s >= 8) return '🟢'
    if (s >= 6) return '🟡'
    return '🔴'
  }

  // Alertas globais de avaliação pendente
  const pendingAlerts = analysts.filter(a => {
    const start = new Date(a.start_date + 'T12:00:00Z')
    const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24))
    const weeksDue = Math.min(Math.floor(diffDays / 7) + 1, 4)
    const evaluated = weeklyEvals.filter(e => e.analyst_id === a.id).map(e => e.week)
    for (let w = 1; w <= weeksDue; w++) {
      if (!evaluated.includes(w)) return true
    }
    return false
  })

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '22px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Avaliações <span style={{ color: 'var(--auvo)' }}>{activeTeam === 'atendimento' ? 'Atendimento' : 'Vendas'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>Avaliações por IA e avaliações semanais dos analistas</div>
      </div>

      {/* Alerta global de pendências */}
      {pendingAlerts.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, marginBottom: 16, fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span><strong>{pendingAlerts.length} analista{pendingAlerts.length > 1 ? 's' : ''}</strong> com avaliação semanal pendente: {pendingAlerts.map(a => a.name.split(' ')[0]).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, flex: 1, overflow: 'hidden' }}>

        {/* Lista de analistas */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Analistas ativos</div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
          ) : analysts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--muted)' }}>Nenhum analista ativo</div>
          ) : analysts.map(a => {
            const isSel = selectedAnalyst?.id === a.id
            const start = new Date(a.start_date + 'T12:00:00Z')
            const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24))
            const weeksDue = Math.min(Math.floor(diffDays / 7) + 1, 4)
            const evaluated = weeklyEvals.filter(e => e.analyst_id === a.id).map(e => e.week)
            const hasPending = Array.from({ length: weeksDue }, (_, i) => i + 1).some(w => !evaluated.includes(w))

            return (
              <div key={a.id} onClick={() => setSelectedAnalyst(a)}
                style={{ padding: '10px 11px', borderRadius: 8, cursor: 'pointer', marginBottom: 5, border: `1px solid ${isSel ? 'var(--auvo-border)' : 'var(--border)'}`, background: isSel ? 'var(--auvo-dim)' : 'var(--surface2)', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--auvo-dim)', color: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {a.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Semana {Math.min(Math.ceil(diffDays / 7), 4)} do onboarding</div>
                  </div>
                  {hasPending && <span style={{ fontSize: 14 }} title="Avaliação semanal pendente">⚠️</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Painel direito */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedAnalyst ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
              <div style={{ fontSize: 36 }}>👈</div>
              <div style={{ fontSize: 13 }}>Selecione um analista</div>
            </div>
          ) : (
            <>
              {/* Header do analista */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'var(--auvo)' }}>
                    {selectedAnalyst.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedAnalyst.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{selectedAnalyst.role || selectedAnalyst.team}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowUpload(true)}>
                      📤 Upload respostas
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={() => {
                      const start = new Date(selectedAnalyst.start_date + 'T12:00:00Z')
                      const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24))
                      const week = Math.min(Math.ceil(diffDays / 7) || 1, 4)
                      setWeeklyForm({ week, scores: {}, comment: '' })
                      setShowWeeklyForm(true)
                    }}>
                      📋 Avaliar semana
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0', flexShrink: 0 }}>
                {[['ia', '🤖 Avaliações por IA'], ['semanal', '📊 Avaliações semanais']].map(([k, l]) => (
                  <button key={k} onClick={() => setActiveTab(k)}
                    style={{ padding: '7px 14px', borderRadius: '7px 7px 0 0', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: activeTab === k ? 600 : 400, background: activeTab === k ? 'var(--auvo)' : 'transparent', color: activeTab === k ? '#fff' : 'var(--muted2)' }}>
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                {/* ── ABA: Avaliações por IA ── */}
                {activeTab === 'ia' && (
                  <div>
                    {formResponses.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                        <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>Nenhuma avaliação por IA ainda</div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>📤 Fazer upload de respostas</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Botão apagar tudo */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {confirmDeleteAll ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 11 }}>
                              <span style={{ color: 'var(--red)' }}>Apagar todas as avaliações de IA?</span>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={deleteAllResponses}>Sim, apagar</button>
                              <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDeleteAll(false)}>Cancelar</button>
                            </div>
                          ) : (
                            <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--red)' }} onClick={() => setConfirmDeleteAll(true)}>
                              🗑️ Apagar todas as avaliações
                            </button>
                          )}
                        </div>
                        {/* Agrupa por exercício */}
                        {Object.entries(
                          formResponses.reduce((acc, r) => {
                            const key = r.exercise_id || 'sem_exercicio'
                            if (!acc[key]) acc[key] = []
                            acc[key].push(r)
                            return acc
                          }, {})
                        ).map(([exId, responses]) => {
                          const ex = exercises.find(e => e.id === exId)
                          const avgScore = responses.filter(r => r.ai_score).reduce((s, r) => s + r.ai_score, 0) / responses.filter(r => r.ai_score).length
                          return (
                            <div key={exId} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                              <div style={{ padding: '12px 14px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ex?.title || 'Exercício'}</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>
                                    {new Date(responses[0].created_at).toLocaleDateString('pt-BR')} · {responses.length} perguntas avaliadas
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {avgScore > 0 && (
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(avgScore) }}>{avgScore.toFixed(1)}</div>
                                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>média geral</div>
                                    </div>
                                  )}
                                  {confirmDeleteEx === exId ? (
                                    <div style={{ display: 'flex', gap: 5 }}>
                                      <button className="btn btn-danger btn-sm" style={{ fontSize: 9 }} onClick={() => deleteExerciseResponses(exId)}>Sim</button>
                                      <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => setConfirmDeleteEx(null)}>Não</button>
                                    </div>
                                  ) : (
                                    <button className="btn btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => setConfirmDeleteEx(exId)} title="Apagar respostas deste exercício">🗑️</button>
                                  )}
                                </div>
                              </div>
                              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {responses.map((r, idx) => (
                                  <div key={r.id || idx} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted2)', flex: 1 }}>{r.question}</div>
                                      {r.ai_score > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                          <span>{scoreEmoji(r.ai_score)}</span>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(r.ai_score) }}>{r.ai_score}/10</span>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: '2px solid var(--border)' }}>
                                      {r.answer}
                                    </div>
                                    {r.ai_feedback && (
                                      <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6, padding: '6px 10px', background: 'var(--auvo-dim)', borderRadius: 6, borderLeft: '2px solid var(--auvo-border)' }}>
                                        🤖 {r.ai_feedback}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── ABA: Avaliações semanais ── */}
                {activeTab === 'semanal' && (
                  <div>
                    {weeklyEvals.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                        <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>Nenhuma avaliação semanal ainda</div>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setWeeklyForm({ week: 1, scores: {}, comment: '' })
                          setShowWeeklyForm(true)
                        }}>📋 Fazer primeira avaliação</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[1, 2, 3, 4].map(week => {
                          const eval_ = weeklyEvals.find(e => e.week === week)
                          const criteria = WEEKLY_CRITERIA[week] || []
                          return (
                            <div key={week} style={{ border: `1px solid ${eval_ ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 12, overflow: 'hidden', opacity: eval_ ? 1 : 0.5 }}>
                              <div style={{ padding: '12px 14px', background: eval_ ? 'var(--surface2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>Semana {week}</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>
                                    {eval_ ? `Avaliado em ${new Date(eval_.evaluated_at).toLocaleDateString('pt-BR')}` : 'Pendente'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {eval_ && (
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(eval_.avg_score) }}>{eval_.avg_score}</div>
                                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>média</div>
                                    </div>
                                  )}
                                  <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => {
                                    setWeeklyForm({ week, scores: eval_ ? Object.fromEntries((eval_.scores || []).map(s => [s.key, s.score])) : {}, comment: eval_?.comment || '' })
                                    setShowWeeklyForm(true)
                                  }}>
                                    {eval_ ? '✏️ Editar' : '+ Avaliar'}
                                  </button>
                                </div>
                              </div>
                              {eval_ && (
                                <div style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: eval_.comment ? 10 : 0 }}>
                                    {(eval_.scores || []).map(s => (
                                      <div key={s.key} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 7, border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 4 }}>{s.label}</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}<span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>/5</span></div>
                                      </div>
                                    ))}
                                  </div>
                                  {eval_.comment && (
                                    <div style={{ fontSize: 11, color: 'var(--muted2)', padding: '8px 10px', background: 'var(--surface2)', borderRadius: 7, borderLeft: '2px solid var(--auvo-border)', lineHeight: 1.6 }}>
                                      💬 {eval_.comment}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: Upload CSV ── */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="modal" style={{ width: 500 }}>
            <div className="modal-header">
              <div className="modal-title">Upload de respostas</div>
              <button className="modal-close" onClick={() => { setShowUpload(false); setCsvData([]) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Exercício correspondente</label>
                <select value={selectedExercise?.id || ''} onChange={e => setSelectedExercise(exercises.find(ex => ex.id === e.target.value) || null)} style={{ fontFamily: 'inherit', fontSize: 12 }}>
                  <option value="">Selecionar exercício</option>
                  {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Planilha de respostas (.xlsx ou .csv)</label>
                <div onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--border2)', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface2)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--auvo)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                >
                  {csvData.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>{csvData.length} resposta{csvData.length > 1 ? 's' : ''} carregada{csvData.length > 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4 }}>
                        Analistas identificados: {csvData.map(r => r['Email'] || r['email'] || r['E-mail']).filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)' }}>Clique para selecionar o arquivo</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>.xlsx exportado do Google Sheets · também aceita .csv</div>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
              </div>

              {csvData.length > 0 && (
                <div style={{ padding: '8px 12px', background: 'var(--auvo-dim)', border: '1px solid var(--auvo-border)', borderRadius: 8, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: 'var(--auvo)', marginBottom: 4 }}>O que vai acontecer:</div>
                  <div style={{ color: 'var(--muted2)', lineHeight: 1.7 }}>
                    • O Gemini vai avaliar cada resposta individualmente<br/>
                    • Cada pergunta recebe uma nota de 0 a 10 + feedback<br/>
                    • Analistas são identificados automaticamente pelo e-mail<br/>
                    • Pode levar alguns segundos por resposta
                  </div>
                </div>
              )}
            </div>
            {/* Barra de progresso */}
            {evaluating && uploadProgress.total > 0 && (
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted2)' }}>🤖 Avaliando com IA — pode levar alguns minutos...</span>
                  <span style={{ fontSize: 11, color: 'var(--auvo)', fontWeight: 600 }}>{uploadProgress.current}/{uploadProgress.total}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: 'var(--auvo)', width: `${Math.round(uploadProgress.current / uploadProgress.total * 100)}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}

            {/* Alerta de erro */}
            {uploadError && (
              <div style={{ margin: '0 20px 12px', padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 11, color: 'var(--red)' }}>
                ⚠️ {uploadError}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowUpload(false); setCsvData([]); setUploadError('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={processAndEvaluate}
                disabled={evaluating || csvData.length === 0 || !selectedExercise}
                style={{ opacity: (csvData.length === 0 || !selectedExercise) ? 0.5 : 1 }}>
                {evaluating
                  ? `🤖 Avaliando ${uploadProgress.current}/${uploadProgress.total}...`
                  : csvData.length === 0
                    ? '🔒 Selecione o arquivo primeiro'
                    : '🤖 Avaliar com IA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Avaliação semanal ── */}
      {showWeeklyForm && selectedAnalyst && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowWeeklyForm(false)}>
          <div className="modal" style={{ width: 500 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 10, color: 'var(--auvo)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  {selectedAnalyst.name.split(' ')[0]}
                </div>
                <div className="modal-title">Avaliação — Semana {weeklyForm.week}</div>
              </div>
              <button className="modal-close" onClick={() => setShowWeeklyForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Seletor de semana */}
              <div className="form-group">
                <label>Semana</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4].map(w => (
                    <button key={w} onClick={() => setWeeklyForm(f => ({ ...f, week: w, scores: {} }))}
                      style={{ flex: 1, padding: '7px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, border: `1px solid ${weeklyForm.week === w ? 'var(--auvo-border)' : 'var(--border)'}`, background: weeklyForm.week === w ? 'var(--auvo-dim)' : 'transparent', color: weeklyForm.week === w ? 'var(--auvo)' : 'var(--muted2)', fontWeight: weeklyForm.week === w ? 600 : 400 }}>
                      Semana {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Critérios da semana selecionada */}
              {(WEEKLY_CRITERIA[weeklyForm.week] || []).map(criterion => (
                <div key={criterion.key} className="form-group">
                  <label>{criterion.label}</label>
                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8 }}>{criterion.desc}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(score => {
                      const selected = weeklyForm.scores[criterion.key] === score
                      const colors = { 1: 'var(--red)', 2: '#f97316', 3: 'var(--amber)', 4: '#84cc16', 5: 'var(--green)' }
                      const labels = { 1: 'Ruim', 2: 'Regular', 3: 'OK', 4: 'Bom', 5: 'Ótimo' }
                      return (
                        <button key={score} onClick={() => setWeeklyForm(f => ({ ...f, scores: { ...f.scores, [criterion.key]: score } }))}
                          style={{ flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, border: `2px solid ${selected ? colors[score] : 'var(--border)'}`, background: selected ? `${colors[score]}22` : 'var(--surface2)', color: selected ? colors[score] : 'var(--muted)', fontWeight: selected ? 700 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 16 }}>{score}</span>
                          <span>{labels[score]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="form-group">
                <label>Comentário geral (opcional)</label>
                <textarea value={weeklyForm.comment} onChange={e => setWeeklyForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Observações, pontos de destaque ou plano de ação para o analista..."
                  style={{ minHeight: 80, resize: 'none', fontSize: 12 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowWeeklyForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveWeeklyEval} disabled={savingWeekly ||
                (WEEKLY_CRITERIA[weeklyForm.week] || []).some(c => !weeklyForm.scores[c.key])}>
                {savingWeekly ? 'Salvando...' : 'Salvar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
