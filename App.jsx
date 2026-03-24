import { useState, useEffect } from "react";

// ── 31 SESSÕES DO PLAYBOOK (Treinamentos + Simulações) ───────────────────────
const SESSIONS_TEMPLATE = [
  // SEMANA 1
  { id: 1,  day: 1,  type: "treinamento", title: "Classroom RH",                           duration: 60 },
  { id: 2,  day: 2,  type: "treinamento", title: "Persona & Dores",                         duration: 60 },
  { id: 3,  day: 2,  type: "treinamento", title: "Rapport e Contorno de Objeção",           duration: 60 },
  { id: 4,  day: 3,  type: "treinamento", title: "Pré T1 e SLA",                           duration: 60 },
  { id: 5,  day: 4,  type: "treinamento", title: "Auvo Service",                            duration: 60 },
  { id: 6,  day: 4,  type: "treinamento", title: "Treinamento App",                         duration: 60 },
  { id: 7,  day: 5,  type: "treinamento", title: "Web T1 / Web Ongoing",                    duration: 60 },
  { id: 8,  day: 5,  type: "simulacao",   title: "Simulação 1 — T1 com Enablement",         duration: 60 },
  { id: 9,  day: 5,  type: "simulacao",   title: "Simulação 2 — Apresentação Service",      duration: 60 },
  // SEMANA 2
  { id: 10, day: 6,  type: "treinamento", title: "Módulo PMOC",                             duration: 60 },
  { id: 11, day: 6,  type: "treinamento", title: "Setup de PMOC",                           duration: 60 },
  { id: 12, day: 7,  type: "simulacao",   title: "Simulação 1 PMOC com Enablement",         duration: 60 },
  { id: 13, day: 7,  type: "simulacao",   title: "Simulação 2 PMOC com Coringa",            duration: 60 },
  { id: 14, day: 8,  type: "treinamento", title: "Módulo AuvoDesk",                         duration: 60 },
  { id: 15, day: 9,  type: "simulacao",   title: "Simulação 1 Desk com Enablement",         duration: 60 },
  { id: 16, day: 9,  type: "simulacao",   title: "Simulação 2 Desk com Coringa",            duration: 60 },
  { id: 17, day: 10, type: "treinamento", title: "Módulo Financeiro 1",                     duration: 60 },
  { id: 18, day: 10, type: "treinamento", title: "Módulo Financeiro 2",                     duration: 60 },
  // SEMANA 3
  { id: 19, day: 11, type: "simulacao",   title: "Simulação 1 Financeiro com Enablement",   duration: 60 },
  { id: 20, day: 11, type: "simulacao",   title: "Simulação 2 Financeiro com Enablement",   duration: 60 },
  { id: 21, day: 12, type: "treinamento", title: "Análise de Base",                         duration: 60 },
  { id: 22, day: 13, type: "treinamento", title: "Gestão de Carteira",                      duration: 60 },
  { id: 23, day: 13, type: "treinamento", title: "Treinamento Acompanhamento",              duration: 60 },
  { id: 24, day: 14, type: "simulacao",   title: "Simulação 1 Acompanhamento",              duration: 60 },
  { id: 25, day: 14, type: "simulacao",   title: "Simulação 2 Acompanhamento",              duration: 60 },
  { id: 26, day: 15, type: "simulacao",   title: "Simulação 3 Acompanhamento",              duration: 60 },
  { id: 27, day: 15, type: "simulacao",   title: "Simulação 4 Acompanhamento",              duration: 60 },
  // SEMANA 4
  { id: 28, day: 16, type: "treinamento", title: "Cancelamento e Reversão",                 duration: 60 },
  { id: 29, day: 16, type: "treinamento", title: "Contrato e Negociação",                   duration: 60 },
  { id: 30, day: 16, type: "simulacao",   title: "Simulação 1 Cancelamento com Enablement", duration: 60 },
  { id: 31, day: 20, type: "simulacao",   title: "Simulação 2 Cancelamento",                duration: 60 },
];

const WEEKS = [
  { label: "Semana 1", days: [1, 2, 3, 4, 5] },
  { label: "Semana 2", days: [6, 7, 8, 9, 10] },
  { label: "Semana 3", days: [11, 12, 13, 14, 15] },
  { label: "Semana 4", days: [16, 17, 18, 19, 20] },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
function addWorkdays(startDate, count) {
  const d = new Date(startDate);
  let added = 0;
  while (added < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function getSessionDate(startDate, dayNumber) {
  if (dayNumber === 1) {
    const d = new Date(startDate);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d;
  }
  const base = new Date(startDate);
  base.setMinutes(base.getMinutes() + base.getTimezoneOffset());
  return addWorkdays(base, dayNumber - 1);
}

function fmtShort(date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtWeekday(date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
function fmtLong(date) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [analysts, setAnalysts] = useState([]);
  const [settings, setSettings] = useState({ webhookUrl: "", myEmail: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", startDate: "" });
  const [settingsForm, setSettingsForm] = useState({ webhookUrl: "", myEmail: "" });
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    try { const r = localStorage.getItem("auvo-analysts"); if (r) setAnalysts(JSON.parse(r)); } catch {}
    try { const r = localStorage.getItem("auvo-settings"); if (r) { const p = JSON.parse(r); setSettings(p); setSettingsForm(p); } } catch {}
    setIsLoading(false);
  }, []);

  async function persist(list) {
    setAnalysts(list);
    try { localStorage.setItem("auvo-analysts", JSON.stringify(list)); } catch {}
  }

  async function saveSettings(s) {
    setSettings(s);
    try { localStorage.setItem("auvo-settings", JSON.stringify(s)); } catch {}
  }

  async function addAnalyst() {
    if (!form.name || !form.email || !form.startDate) return;
    const newA = {
      id: Date.now().toString(),
      name: form.name,
      email: form.email,
      startDate: form.startDate,
      sessions: SESSIONS_TEMPLATE.map(s => ({ ...s, completed: false })),
      createdAt: new Date().toISOString(),
    };
    const updated = [...analysts, newA];
    await persist(updated);
    setShowAdd(false);
    setForm({ name: "", email: "", startDate: "" });
    setSelectedId(newA.id);

    if (settings.webhookUrl) {
      setWebhookStatus("loading");
      try {
        await fetch(settings.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analystName: newA.name,
            analystEmail: newA.email,
            myEmail: settings.myEmail,
            startDate: newA.startDate,
            workdayStart: "08:00",
            workdayEnd: "18:00",
            sessions: SESSIONS_TEMPLATE.map(s => ({ day: s.day, type: s.type, title: s.title, durationMinutes: s.duration })),
          }),
        });
        setWebhookStatus("success");
      } catch {
        setWebhookStatus("error");
      }
      setTimeout(() => setWebhookStatus(null), 5000);
    }
  }

  async function toggleSession(analystId, sessionId) {
    const updated = analysts.map(a =>
      a.id !== analystId ? a : { ...a, sessions: a.sessions.map(s => s.id === sessionId ? { ...s, completed: !s.completed } : s) }
    );
    await persist(updated);
  }

  async function removeAnalyst(id) {
    const updated = analysts.filter(a => a.id !== id);
    await persist(updated);
    if (selectedId === id) setSelectedId(null);
  }

  const selected = analysts.find(a => a.id === selectedId);
  const totalDone = analysts.reduce((s, a) => s + a.sessions.filter(x => x.completed).length, 0);
  const totalSessions = analysts.length * SESSIONS_TEMPLATE.length;
  const avgProgress = analysts.length
    ? Math.round(analysts.reduce((s, a) => s + (a.sessions.filter(x => x.completed).length / a.sessions.length) * 100, 0) / analysts.length)
    : 0;

  const C = {
    bg: "#060A12",
    card: "#0E1420",
    cardBorder: "rgba(255,255,255,0.07)",
    amber: "#F59E0B",
    amberDim: "rgba(245,158,11,0.12)",
    blue: "#3B82F6",
    purple: "#8B5CF6",
    green: "#10B981",
    text: "#F1F5F9",
    muted: "#64748B",
    subtle: "#1E293B",
  };

  if (isLoading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: C.amber }}>
      carregando...
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 2px; }
        .srow:hover { background: rgba(245,158,11,0.04) !important; }
        .acard:hover { border-color: rgba(245,158,11,0.25) !important; background: rgba(245,158,11,0.04) !important; }
        .btn-amb { transition: background 0.15s; }
        .btn-amb:hover { background: #D97706 !important; }
        .btn-ghost:hover { background: rgba(255,255,255,0.06) !important; }
        input { outline: none; }
        input:focus { border-color: rgba(245,158,11,0.5) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.08); }
        input[type=checkbox] { accent-color: #F59E0B; cursor: pointer; }
        .pill.active { background: rgba(245,158,11,0.15) !important; color: #F59E0B !important; border-color: rgba(245,158,11,0.3) !important; }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Sora', sans-serif", color: C.text, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* ── TOP NAV ── */}
        <nav style={{ borderBottom: `1px solid ${C.cardBorder}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.015)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: "#000" }}>A</div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Auvo Enablement</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>onboarding tracker</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {webhookStatus === "loading" && <span style={{ fontSize: 11, color: C.amber, fontFamily: "monospace" }}>📅 Agendando no Google Agenda...</span>}
            {webhookStatus === "success" && <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>✓ Eventos criados com sucesso!</span>}
            {webhookStatus === "error"   && <span style={{ fontSize: 11, color: "#EF4444", fontFamily: "monospace" }}>✗ Webhook falhou — verifique as configs</span>}

            <button className="btn-ghost" onClick={() => { setSettingsForm(settings); setShowSettings(true); }}
              style={{ background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "7px 14px", color: C.muted, cursor: "pointer", fontSize: 12, transition: "background 0.15s" }}>
              ⚙ Configurar n8n
            </button>
            <button className="btn-amb" onClick={() => setShowAdd(true)}
              style={{ background: C.amber, border: "none", borderRadius: 8, padding: "7px 16px", color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              + Novo Analista
            </button>
          </div>
        </nav>

        {/* ── STATS STRIP ── */}
        <div style={{ padding: "10px 24px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", gap: 32, flexShrink: 0 }}>
          {[
            { v: analysts.length, l: "Analistas ativos" },
            { v: `${avgProgress}%`, l: "Progresso médio" },
            { v: `${totalDone}/${totalSessions}`, l: "Sessões concluídas" },
            { v: SESSIONS_TEMPLATE.length, l: "Sessões por analista" },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: C.amber }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── LEFT PANEL: Analyst List ── */}
          <div style={{ width: 280, borderRight: `1px solid ${C.cardBorder}`, overflowY: "auto", padding: "14px 12px", flexShrink: 0 }}>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["todos", "em progresso", "concluídos"].map(f => (
                <button key={f} className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}
                  style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.muted, cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize" }}>
                  {f}
                </button>
              ))}
            </div>

            {analysts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>
                  Nenhum analista ainda.<br />Clique em <strong style={{ color: C.text }}>+ Novo Analista</strong> para começar.
                </div>
              </div>
            ) : (
              analysts
                .filter(a => {
                  const pct = Math.round((a.sessions.filter(s => s.completed).length / a.sessions.length) * 100);
                  if (filter === "concluídos") return pct === 100;
                  if (filter === "em progresso") return pct > 0 && pct < 100;
                  return true;
                })
                .map(analyst => {
                  const done = analyst.sessions.filter(s => s.completed).length;
                  const pct = Math.round((done / analyst.sessions.length) * 100);
                  const isSel = selectedId === analyst.id;
                  return (
                    <div key={analyst.id} className="acard"
                      onClick={() => setSelectedId(isSel ? null : analyst.id)}
                      style={{
                        border: `1px solid ${isSel ? "rgba(245,158,11,0.35)" : C.cardBorder}`,
                        borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
                        background: isSel ? C.amberDim : C.card, transition: "all 0.15s",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{analyst.name}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{analyst.email}</div>
                        </div>
                        {confirmDelete === analyst.id ? (
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => { removeAnalyst(analyst.id); setConfirmDelete(null); }}
                              style={{ background: "#EF4444", border: "none", borderRadius: 5, padding: "3px 8px", color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Sim</button>
                            <button onClick={() => setConfirmDelete(null)}
                              style={{ background: "#1E293B", border: "none", borderRadius: 5, padding: "3px 8px", color: "#64748B", cursor: "pointer", fontSize: 10 }}>Não</button>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(analyst.id); }}
                            style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 13, padding: "0 0 0 8px", lineHeight: 1, flexShrink: 0 }}>✕</button>
                        )}
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Progresso</span>
                          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: pct === 100 ? C.green : C.amber, fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.6s ease",
                            background: pct === 100 ? `linear-gradient(90deg, ${C.green}, #059669)` : `linear-gradient(90deg, ${C.amber}, #D97706)`,
                          }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, color: C.muted }}>📅 {fmtLong(analyst.startDate).split(" de ")[0]} de {fmtLong(analyst.startDate).split(" de ")[1]}</span>
                        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{done}/{analyst.sessions.length}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* ── RIGHT PANEL: Session Detail ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
            {!selected ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 40 }}>👈</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Selecione um analista para ver o cronograma completo</div>
              </div>
            ) : (() => {
              const done = selected.sessions.filter(s => s.completed).length;
              const pct = Math.round((done / selected.sessions.length) * 100);
              return (
                <>
                  {/* Analyst Header */}
                  <div style={{ padding: "20px 0 18px", borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: C.amberDim, border: `1px solid rgba(245,158,11,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: C.amber }}>
                        {selected.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text }}>{selected.name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                          {selected.email} &nbsp;·&nbsp; Início em {fmtLong(selected.startDate)}
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600, color: pct === 100 ? C.green : C.amber }}>{pct}%</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{done} de {selected.sessions.length} sessões</div>
                      </div>
                    </div>
                    {/* Big progress bar */}
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: 6, transition: "width 0.7s ease",
                        background: pct === 100 ? `linear-gradient(90deg, ${C.green}, #059669)` : `linear-gradient(90deg, #F59E0B, #D97706, #B45309)`,
                      }} />
                    </div>
                  </div>

                  {/* Sessions by Week */}
                  {WEEKS.map(week => {
                    const weekSessions = selected.sessions.filter(s => week.days.includes(s.day));
                    if (weekSessions.length === 0) return null;
                    const weekDone = weekSessions.filter(s => s.completed).length;

                    return (
                      <div key={week.label} style={{ marginBottom: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>{week.label}</div>
                            <div style={{ height: 1, width: 40, background: C.cardBorder }} />
                          </div>
                          <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{weekDone}/{weekSessions.length}</span>
                        </div>

                        {week.days.map(day => {
                          const daySessions = weekSessions.filter(s => s.day === day);
                          if (daySessions.length === 0) return null;
                          const sessionDate = getSessionDate(selected.startDate, day);

                          return (
                            <div key={day} style={{ marginBottom: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <div style={{ background: C.subtle, borderRadius: 5, padding: "3px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Dia {day}</span>
                                  <span style={{ color: "#1E293B" }}>·</span>
                                  <span style={{ fontSize: 10, color: C.muted, textTransform: "capitalize" }}>{fmtWeekday(sessionDate)}, {fmtShort(sessionDate)}</span>
                                </div>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {daySessions.map(session => (
                                  <div key={session.id} className="srow"
                                    style={{
                                      display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 8,
                                      border: `1px solid ${session.completed ? "rgba(16,185,129,0.15)" : C.cardBorder}`,
                                      background: session.completed ? "rgba(16,185,129,0.04)" : C.card,
                                      cursor: "pointer", transition: "all 0.1s",
                                    }}
                                    onClick={() => toggleSession(selected.id, session.id)}>

                                    <input type="checkbox" checked={session.completed} onChange={() => toggleSession(selected.id, session.id)} style={{ width: 15, height: 15, flexShrink: 0 }} />

                                    <span style={{ flex: 1, fontSize: 13, color: session.completed ? C.muted : C.text, textDecoration: session.completed ? "line-through" : "none", transition: "all 0.2s" }}>
                                      {session.title}
                                    </span>

                                    <span style={{
                                      fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 500, whiteSpace: "nowrap",
                                      background: session.type === "treinamento" ? "rgba(59,130,246,0.12)" : "rgba(139,92,246,0.12)",
                                      color: session.type === "treinamento" ? "#93C5FD" : "#C4B5FD",
                                      border: `1px solid ${session.type === "treinamento" ? "rgba(59,130,246,0.18)" : "rgba(139,92,246,0.18)"}`,
                                    }}>
                                      {session.type === "treinamento" ? "Treinamento" : "Simulação"}
                                    </span>

                                    <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", whiteSpace: "nowrap" }}>60 min</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD ANALYST ── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(6px)" }}>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 28, width: 400, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Cadastrar</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 22 }}>Novo Analista</div>

            {[
              { label: "Nome completo", key: "name", type: "text", ph: "João Silva" },
              { label: "E-mail do analista", key: "email", type: "email", ph: "joao@empresa.com" },
              { label: "Data de início do onboarding", key: "startDate", type: "date", ph: "" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.ph}
                  onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, transition: "border 0.15s, box-shadow 0.15s", colorScheme: "dark" }} />
              </div>
            ))}

            {settings.webhookUrl ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11, color: C.green }}>
                ✓ Webhook configurado. O Google Agenda será atualizado automaticamente.
              </div>
            ) : (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11, color: "#D97706" }}>
                ⚠ Webhook n8n não configurado. Configure em ⚙ para ativar o agendamento automático.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-ghost" onClick={() => { setShowAdd(false); setForm({ name: "", email: "", startDate: "" }); }}
                style={{ flex: 1, background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "10px", color: C.muted, cursor: "pointer", fontSize: 13, transition: "background 0.15s" }}>
                Cancelar
              </button>
              <button className="btn-amb" onClick={addAnalyst}
                style={{ flex: 1, background: C.amber, border: "none", borderRadius: 8, padding: "10px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SETTINGS ── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(6px)" }}>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 28, width: 440, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Integração</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>n8n + Google Agenda</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 22, lineHeight: 1.7 }}>
              Configure abaixo para que o sistema agende automaticamente todas as sessões no Google Agenda ao cadastrar um novo analista.
            </div>

            {[
              { label: "Seu e-mail (Google Calendar)", key: "myEmail", type: "email", ph: "enablement@suaempresa.com" },
              { label: "URL do Webhook n8n", key: "webhookUrl", type: "url", ph: "https://seu-n8n.com/webhook/auvo-onboarding", mono: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={settingsForm[f.key]} placeholder={f.ph}
                  onChange={e => setSettingsForm(x => ({ ...x, [f.key]: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: f.mono ? 11 : 13, fontFamily: f.mono ? "monospace" : "inherit", transition: "border 0.15s, box-shadow 0.15s", colorScheme: "dark" }} />
              </div>
            ))}

            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "12px 14px", marginBottom: 22, fontSize: 11, color: "#93C5FD", lineHeight: 1.8 }}>
              <strong>Como obter o Webhook URL do n8n:</strong><br />
              1. Abra seu n8n → crie um novo workflow<br />
              2. Adicione o nó <strong>Webhook</strong> como trigger<br />
              3. Copie a URL gerada e cole no campo acima<br />
              4. No mesmo workflow, adicione os nós do <strong>Google Calendar</strong>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setShowSettings(false)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "10px", color: C.muted, cursor: "pointer", fontSize: 13, transition: "background 0.15s" }}>
                Cancelar
              </button>
              <button className="btn-amb" onClick={async () => { await saveSettings(settingsForm); setShowSettings(false); }}
                style={{ flex: 1, background: C.amber, border: "none", borderRadius: 8, padding: "10px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Salvar configuração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
