import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://crmxtphnflomtbwdhafu.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybXh0cGhuZmxvbXRid2RoYWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzAzMDEsImV4cCI6MjA5MDIwNjMwMX0.1sNlfmIFSm7_aZ80tR6py0pdOnbsvMdHghS4gPzA-qs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── SESSÕES DO CRONOGRAMA ─────────────────────────────────────
export const SESSIONS_ATENDIMENTO = [
  { id: 1,  day: 1,  type: 'treinamento', title: 'Classroom RH' },
  { id: 2,  day: 2,  type: 'treinamento', title: 'Persona & Dores' },
  { id: 3,  day: 2,  type: 'treinamento', title: 'Rapport e Contorno de Objeção' },
  { id: 4,  day: 3,  type: 'treinamento', title: 'Pré T1 e SLA' },
  { id: 5,  day: 4,  type: 'treinamento', title: 'Auvo Service' },
  { id: 6,  day: 4,  type: 'treinamento', title: 'Treinamento App' },
  { id: 7,  day: 5,  type: 'treinamento', title: 'Web T1 / Web Ongoing' },
  { id: 8,  day: 5,  type: 'simulacao',   title: 'Simulação 1 — T1 com Enablement' },
  { id: 9,  day: 5,  type: 'simulacao',   title: 'Simulação 2 — Apresentação Service' },
  { id: 10, day: 6,  type: 'treinamento', title: 'Módulo PMOC' },
  { id: 11, day: 6,  type: 'treinamento', title: 'Setup de PMOC' },
  { id: 12, day: 7,  type: 'simulacao',   title: 'Simulação 1 PMOC com Enablement' },
  { id: 13, day: 7,  type: 'simulacao',   title: 'Simulação 2 PMOC com Coringa' },
  { id: 14, day: 8,  type: 'treinamento', title: 'Módulo AuvoDesk' },
  { id: 15, day: 9,  type: 'simulacao',   title: 'Simulação 1 Desk com Enablement' },
  { id: 16, day: 9,  type: 'simulacao',   title: 'Simulação 2 Desk com Coringa' },
  { id: 17, day: 10, type: 'treinamento', title: 'Módulo Financeiro 1' },
  { id: 18, day: 10, type: 'treinamento', title: 'Módulo Financeiro 2' },
  { id: 19, day: 11, type: 'simulacao',   title: 'Simulação 1 Financeiro com Enablement' },
  { id: 20, day: 11, type: 'simulacao',   title: 'Simulação 2 Financeiro com Enablement' },
  { id: 21, day: 12, type: 'treinamento', title: 'Análise de Base' },
  { id: 22, day: 13, type: 'treinamento', title: 'Gestão de Carteira' },
  { id: 23, day: 13, type: 'treinamento', title: 'Treinamento Acompanhamento' },
  { id: 24, day: 14, type: 'simulacao',   title: 'Simulação 1 Acompanhamento' },
  { id: 25, day: 14, type: 'simulacao',   title: 'Simulação 2 Acompanhamento' },
  { id: 26, day: 15, type: 'simulacao',   title: 'Simulação 3 Acompanhamento' },
  { id: 27, day: 15, type: 'simulacao',   title: 'Simulação 4 Acompanhamento' },
  { id: 28, day: 16, type: 'treinamento', title: 'Cancelamento e Reversão' },
  { id: 29, day: 16, type: 'treinamento', title: 'Contrato e Negociação' },
  { id: 30, day: 16, type: 'simulacao',   title: 'Simulação 1 Cancelamento com Enablement' },
  { id: 31, day: 20, type: 'simulacao',   title: 'Simulação 2 Cancelamento' },
]

export const SESSIONS_VENDAS = [
  { id: 1,  day: 2,  type: 'treinamento', title: 'Playbook — Mercado & ICP' },
  { id: 2,  day: 3,  type: 'treinamento', title: 'Playbook — Produto Basic' },
  { id: 3,  day: 5,  type: 'simulacao',   title: 'Simulação 1 — Apresentação Basic com Enablement' },
  { id: 4,  day: 5,  type: 'simulacao',   title: 'Simulação 2 — Apresentação Basic com Coringa' },
  { id: 5,  day: 6,  type: 'treinamento', title: 'Playbook — Produto: Financeiro' },
  { id: 6,  day: 7,  type: 'treinamento', title: 'Playbook — Produto: Auvo Desk' },
  { id: 7,  day: 8,  type: 'treinamento', title: 'Playbook — Produto: PMOC' },
  { id: 8,  day: 9,  type: 'treinamento', title: 'Playbook — Módulos Upsell + Integrações' },
  { id: 9,  day: 10, type: 'simulacao',   title: 'Simulação 2 — Apresentação Auvo Gestão com Enablement' },
  { id: 10, day: 10, type: 'simulacao',   title: 'Simulação 3 — Basic, Desk e PMOC com Enablement' },
  { id: 11, day: 11, type: 'treinamento', title: 'Playbook — Negociação' },
  { id: 12, day: 12, type: 'treinamento', title: 'Playbook — Processos, Regras e SLA' },
  { id: 13, day: 13, type: 'treinamento', title: 'Playbook — Execução Comercial, CRM e Formalizações' },
  { id: 14, day: 14, type: 'treinamento', title: 'Aula Prática — Módulo 7' },
  { id: 15, day: 16, type: 'treinamento', title: 'Playbook — Boas Práticas Pós-Vendas' },
  { id: 16, day: 17, type: 'treinamento', title: 'Playbook — Metas e Comissionamento' },
  { id: 17, day: 18, type: 'treinamento', title: 'Playbook — Produtividade e Organização' },
  { id: 18, day: 19, type: 'treinamento', title: 'Análise de Uso do CRM com Enablement' },
]

export const TEAM_SESSIONS = { atendimento: SESSIONS_ATENDIMENTO, vendas: SESSIONS_VENDAS }

export const WEEKS = [
  { label: 'Semana 1', days: [1,2,3,4,5] },
  { label: 'Semana 2', days: [6,7,8,9,10] },
  { label: 'Semana 3', days: [11,12,13,14,15] },
  { label: 'Semana 4', days: [16,17,18,19,20] },
]

// ── XP por ação ───────────────────────────────────────────────
export const XP_VALUES = {
  treinamento_concluido: 10,
  simulacao_concluida: 25,
  exercicio_enviado: 15,
  video_enviado: 20,
  csat_respondido: 5,
  streak_5_dias: 50,
  streak_7_dias: 75,
  streak_14_dias: 150,
  semana_perfeita: 80,
}

export const LEVEL_NAMES = [
  { min: 0,    max: 100,  level: 1, name: 'Novato' },
  { min: 100,  max: 300,  level: 2, name: 'Aprendiz' },
  { min: 300,  max: 600,  level: 3, name: 'Praticante' },
  { min: 600,  max: 1000, level: 4, name: 'Especialista' },
  { min: 1000, max: Infinity, level: 5, name: 'Auvonauta' },
]

export function getLevelInfo(xp) {
  return LEVEL_NAMES.find(l => xp >= l.min && xp < l.max) || LEVEL_NAMES[4]
}

// ── Helpers de data ───────────────────────────────────────────
export function addWorkdays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z')
  if (days === 0) return d
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

export function getSessionDate(startDate, dayNumber) {
  if (dayNumber === 1) {
    const d = new Date(startDate + 'T12:00:00Z')
    return d
  }
  return addWorkdays(startDate, dayNumber - 1)
}

export function fmtDate(date) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function fmtDateLong(date) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function fmtWeekday(date) {
  return new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

export const EXIT_REASONS = [
  'Pediu demissão voluntariamente',
  'Proposta de outro empregador',
  'Não se adaptou à função',
  'Dificuldade técnica com a plataforma',
  'Problema pessoal ou familiar',
  'Outro',
]
