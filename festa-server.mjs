// Festa da Turma: praça ao vivo da Turma do Brasil. Só cuida de quem está na festa e onde cada boneco anda.
// Sem chat livre: as pessoas só mandam emoji e frase pronta, pelo número da lista (a página é que tem os textos).
//   node --env-file=.env server.js
import http from "node:http";
import fs from "node:fs";
import { WebSocketServer } from "ws";
import { monitorEventLoopDelay } from "node:perf_hooks";

const PORT = +(process.env.PORT || 3295);
const LOTACAO = +(process.env.LOTACAO || 1000); // mais que isso espera na fila
const VER = +(process.env.VER || 150), VER_RAIO = +(process.env.VER_RAIO || 34); // cada celular recebe no máximo VER bonecos, os mais perto
const RAIO = 56, TICK_MS = 150, N_EMOJIS = 6, N_FRASES = 16;
const INI = Date.parse(process.env.FESTA_INI || "2026-11-05T21:00:00-03:00");
const FIM = Date.parse(process.env.FESTA_FIM || "2026-11-05T22:00:00-03:00");
const CHAVE = process.env.TESTE_CHAVE || ""; // com a chave entra fora do horário e sem casa (só pra teste)
const MIN_PRESENCA = +(process.env.MIN_PRESENCA || 15) * 60e3;
const PONTOS = +(process.env.PONTOS || 20);
const ARQ = new URL("./presenca.json", import.meta.url);

const norm = (s) => String(s || "").trim().replace(/^@/, "").toLowerCase();

// ---------- quem tem casa no mapa ----------
let casas = new Map();
async function lerCasas() {
  try {
    const r = await fetch("https://brasildaturma-renan.squareweb.app/dados/casas.json", { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    casas = new Map(d.casas.map((c) => [norm(c[0]), { u: c[0], cid: c[1] }]));
    console.log(`mapa lido: ${casas.size} casas`);
  } catch (e) { console.log("não li o mapa:", e.message); }
}
lerCasas(); setInterval(lerCasas, 60e3);
// ---------- skins compradas (o robô guarda; aqui só lê). Skin é só visual: nunca dá ponto ----------
let donos = {};
async function lerSkins() { try { const r = await fetch((process.env.ROBO_URL || "https://brasildaturma-renan.squareweb.app") + "/skins/donos", { signal: AbortSignal.timeout(15000) }); if (r.ok) donos = await r.json(); } catch {} }
lerSkins(); setInterval(lerSkins, 20e3);
const N_SKINS = 12; // 0-5 comuns · 6-11 Farmador de Aura (6 cores)
const minhas = (u) => donos[norm(u)] || [];

// ---------- presença (vale pontos no fim) ----------
let estado = (() => { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return { presenca: {}, pago: false }; } })();
// festa nova (outra data no .env): presença, pontos pagos e placares começam do zero
if (estado.ini !== INI) { estado = { presenca: {}, pago: false, ini: INI }; }
const salvar = () => { try { fs.writeFileSync(ARQ, JSON.stringify(estado)); } catch {} };
function somarPresenca(p) {
  if (p.teste || !p.contaDesde) return;
  const fim = Math.min(Date.now(), FIM), ini = Math.max(p.contaDesde, INI);
  if (fim > ini) estado.presenca[norm(p.u)] = (estado.presenca[norm(p.u)] || 0) + fim - ini;
  p.contaDesde = Date.now();
}
async function pagarPontos() {
  if (estado.pago || Date.now() < FIM + 60e3 || !process.env.ROBO_SENHA) return;
  for (const p of todos()) somarPresenca(p);
  const us = Object.entries(estado.presenca).filter(([, ms]) => ms >= MIN_PRESENCA).map(([u]) => u);
  try {
    const r = await fetch(`https://brasildaturma-renan.squareweb.app/admin/festa-pontos?senha=${encodeURIComponent(process.env.ROBO_SENHA)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ us, pts: PONTOS, marca: process.env.FESTA_MARCA || "festa1" }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    estado.pago = true; salvar();
    console.log("pontos pagos:", JSON.stringify(await r.json()));
  } catch (e) { console.log("não paguei os pontos, tento de novo:", e.message); }
}
setInterval(() => { for (const p of todos()) somarPresenca(p); salvar(); pagarPontos(); }, 60e3);

// ---------- OLIMPÍADAS: pontos por estado e por @ (corrida, pênaltis, vôlei) ----------
const UF_COD = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
const ufDe = (cid) => UF_COD[Math.floor((+cid || 0) / 1e5)] || null;
estado.ol ||= { est: {}, pes: {}, ufP: {}, corridas: 0, gols: 0, volei: 0 };
const OL = estado.ol; let olMudou = true, olMsg = "";
const aberto = () => Date.now() >= INI && Date.now() < FIM;
function marcar(p, pts) {
  if (!p || (p.teste && !process.env.CICLO_TESTE)) return;
  const k = norm(p.u), uf = ufDe(p.cid); OL.pes[k] = (OL.pes[k] || 0) + pts; if (uf) { OL.est[uf] = (OL.est[uf] || 0) + pts; OL.ufP[k] = uf; } olMudou = true;
}
const topEst = (n = 27) => Object.entries(OL.est).sort((a, b) => b[1] - a[1]).slice(0, n);
const podio = () => Object.entries(OL.pes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, pts]) => [u, pts, OL.ufP[u] || ""]);
// corrida: pista reta; quem está na LARGADA quando aparece "VAI!" corre. O servidor anda com cada corredor (7,5 m/s): ninguém teleporta.
const PISTA_C = { x0: -38, x1: -12, z0: 28, z1: 36, lx0: -43, vel: 7.5 };
const naLargada = (p) => p.x >= PISTA_C.lx0 && p.x <= PISTA_C.x0 && p.z >= PISTA_C.z0 && p.z <= PISTA_C.z1;
const COR = { fase: "espera", ate: 0, corredores: new Set(), chegada: [] };
const CICLO = { espera: 55e3, chamada: 25e3, pronto: 3e3, vai: 20e3, fim: 9e3 }; if (process.env.CICLO_TESTE) for (const k in CICLO) CICLO[k] /= 5;
function faseCorrida(f) { COR.fase = f; COR.ate = Date.now() + CICLO[f]; olMudou = true; }
function passoCorrida() {
  if (!aberto() && !todos().some((p) => p.teste)) { if (COR.fase !== "espera") faseCorrida("espera"); return; }
  const agora = Date.now();
  if (COR.fase === "vai") {
    const dt = TICK_MS / 1000;
    for (const id of COR.corredores) {
      const p = pessoas.get(id); if (!p) { COR.corredores.delete(id); continue; }
      const dx = p.ax - p.x, dz = p.az - p.z, d = Math.hypot(dx, dz);
      if (d > .01) { const k = Math.min(1, PISTA_C.vel * dt / d); p.x = +(p.x + dx * k).toFixed(2); p.z = +(p.z + dz * k).toFixed(2); p.mudou = true; }
      if (p.x >= PISTA_C.x1 && p.z >= PISTA_C.z0 - 1 && p.z <= PISTA_C.z1 + 1) { COR.chegada.push(p); COR.corredores.delete(id); delete p.corre; }
    }
    if (COR.chegada.length >= 3 || !COR.corredores.size || agora >= COR.ate) {
      for (const id of COR.corredores) { const p = pessoas.get(id); if (p) delete p.corre; } COR.corredores.clear();
      const md = ["🥇", "🥈", "🥉"], pts = [5, 3, 1];
      COR.chegada.slice(0, 3).forEach((p, i) => marcar(p, pts[i]));
      OL.corridas++;
      olMsg = COR.chegada.length ? "🏁 " + COR.chegada.slice(0, 3).map((p, i) => `${md[i]} @${p.u}${ufDe(p.cid) ? " (" + ufDe(p.cid) + ")" : ""}`).join("  ") : "🏁 Ninguém chegou dessa vez!";
      COR.chegada = []; faseCorrida("fim");
    }
    return;
  }
  if (agora < COR.ate) return;
  if (COR.fase === "espera") faseCorrida("chamada");
  else if (COR.fase === "chamada") faseCorrida("pronto");
  else if (COR.fase === "pronto") {
    COR.corredores = new Set(todos().filter(naLargada).slice(0, 80).map((p) => p.id));
    for (const id of COR.corredores) { const p = pessoas.get(id); p.corre = true; p.ax = p.x; p.az = p.z; }
    COR.chegada = []; faseCorrida("vai"); olMsg = "";
  } else if (COR.fase === "fim") faseCorrida("espera");
}
// vôlei: bola de quadra; quem encosta manda pro outro lado. Caiu do outro lado = ponto de quem mandou.
const QV = { x0: 16, x1: 36, z0: 28, z1: 40, rede: 26 };
const vb = { x: 21, z: 34, vx: 0, vz: 0, a: 0, b: 0, ultP: null, lado: 0, mudou: true };
const vbArr = () => [+vb.x.toFixed(2), +vb.z.toFixed(2), vb.a, vb.b, +Math.hypot(vb.vx, vb.vz).toFixed(1)];
function toque(p) {
  if (Math.hypot(p.x - vb.x, p.z - vb.z) > 2.6) return;
  const lado = p.x < QV.rede ? -1 : 1; vb.vx = -lado * (5.2 + Math.random() * 1.6); vb.vz = (Math.random() - .5) * 5; vb.ultP = p; vb.lado = lado; vb.mudou = true;
}
function moverVolei() {
  if (!vb.vx && !vb.vz) return;
  const dt = TICK_MS / 1000; vb.x += vb.vx * dt; vb.z += vb.vz * dt; vb.vx *= .9; vb.vz *= .9; vb.mudou = true;
  if (vb.z < QV.z0 || vb.z > QV.z1) { vb.z = Math.max(QV.z0, Math.min(QV.z1, vb.z)); vb.vz *= -.6; }
  const fora = vb.x < QV.x0 || vb.x > QV.x1;
  if (fora || Math.hypot(vb.vx, vb.vz) < .15) {
    const lado = vb.x < QV.rede ? -1 : 1;
    if (!fora && vb.ultP && lado !== vb.lado) { marcar(vb.ultP, 1); OL.volei++; if (lado > 0) vb.a++; else vb.b++; olMsg = `🏐 Ponto de @${vb.ultP.u}!`; }
    if (fora) { vb.x = vb.lado < 0 ? 31 : 21; vb.z = 34; } else if (vb.ultP && lado !== vb.lado) { /* fica onde caiu: quem está ali saca */ }
    vb.vx = vb.vz = 0; vb.ultP = null;
  }
}
// ---------- PINTA O CHÃO: cada um pinta o piso com a cor do estado; a cada rodada o estado com mais piso ganha +5 ----------
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const PG = { cx: -38, cz: 0, n: 12, tam: 2.2 }, RODADA = process.env.CICLO_TESTE ? 20e3 : 90e3, PREMIO = 5;
const PT = new Array(PG.n * PG.n).fill(0); let ptMud = [], ptZerou = false, ptAte = Date.now() + RODADA, ptMsg = "";
const tileDe = (x, z) => { const i = Math.floor((x - PG.cx) / PG.tam + PG.n / 2), j = Math.floor((z - PG.cz) / PG.tam + PG.n / 2); return i >= 0 && j >= 0 && i < PG.n && j < PG.n ? j * PG.n + i : -1; };
const corDe = (p) => { const uf = ufDe(p.cid); return uf ? UFS.indexOf(uf) + 1 : 28; };
const placarPinta = () => { const c = {}; for (const v of PT) if (v && v <= 27) c[UFS[v - 1]] = (c[UFS[v - 1]] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]); };
const pinta1 = (k, v) => { if (k >= 0 && PT[k] !== v) { PT[k] = v; ptMud.push(k, v); } };
// o boneco anda em linha reta até onde tocou: pinta o caminho todo (de 1 em 1 m), não só onde parou
function pintarCaminho(p, x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.min(80, Math.ceil(d)), v = corDe(p);
  for (let s = 1; s <= n; s++) { const f = s / n; pinta1(tileDe(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f), v); }
}
function passoPinta() {
  // quem está parado num piso segura a cor dele; dois estados no mesmo piso: fica a cor que já estava
  const ali = new Map();
  for (const p of pessoas.values()) { const k = tileDe(p.x, p.z); if (k < 0) continue; if (!ali.has(k)) ali.set(k, new Set()); ali.get(k).add(corDe(p)); }
  for (const [k, cs] of ali) if (!cs.has(PT[k])) pinta1(k, cs.values().next().value);
  if (Date.now() < ptAte) return;
  ptAte = Date.now() + RODADA;
  const top = placarPinta();
  if (top.length && (aberto() || todos().some((p) => p.teste))) {
    const [uf, n] = top[0];
    if (!(todos().every((p) => p.teste) && !process.env.CICLO_TESTE)) { OL.est[uf] = (OL.est[uf] || 0) + PREMIO; olMudou = true; }
    ptMsg = `🎨 ${uf} pintou mais o chão (${n} pisos)! +${PREMIO} pro estado`; olMsg = ptMsg;
  }
  PT.fill(0); ptMud = []; ptZerou = true; olMudou = true;
}
function vestir(p, i) {
  if (i === -1 || minhas(p.u).includes(i)) { p.sk = i; eventos.push(["k", p.id, i]); return; }
  // acabou de comprar: confere no robô antes de negar
  lerSkins().then(() => { if (minhas(p.u).includes(i) && pessoas.has(p.id)) { p.sk = i; eventos.push(["k", p.id, i]); manda(p.ws, { t: "sks", sks: minhas(p.u) }); } });
}

const simpatico = () => { const c = Object.entries(OL.conv || {}).sort((a, b) => b[1] - a[1]).slice(0, 3); return c.length ? "\n\n😄 *Mais simpáticos da noite* (quem mais puxou conversa):\n" + c.map(([u, n], i) => `${["🥇", "🥈", "🥉"][i]} @${u} · ${n} conversas`).join("\n") : ""; };
// no fim: resultado no grupo da Turma (pela Feirinha) e campeão gravado
async function anunciarResultado() {
  if (OL.anunciado || Date.now() < FIM + 30e3 || !process.env.FEIRINHA_SENHA || !Object.keys(OL.est).length) return;
  const md = ["🥇", "🥈", "🥉"], t = topEst(3), pd = podio();
  OL.campeao = t[0]?.[0] || null;
  const NOME = process.env.FESTA_NOME || "FESTA DA TURMA";
  const texto = `🏆 *RESULTADO DA ${NOME}!* 🇧🇷

*Estados campeões:*
${t.map(([uf, pts], i) => `${md[i]} ${uf} · ${pts} pts`).join("\n")}

*Pódio da turma:*
${pd.map(([u, pts, uf], i) => `${md[i]} @${u}${uf ? " (" + uf + ")" : ""} · ${pts} pts`).join("\n")}

🗺️ ${OL.campeao} ganhou a medalha de ouro no mapa: brasildaturma.online
🎨 Pinta o Chão: o estado que pintou mais em cada rodada levou +5${simpatico()}
👑 Quem ficou 15 minutos já ganhou +20 pontos na casa

Valeu demais, turma! Vem mais jogo por aí 🔥`;
  try {
    const r = await fetch("https://feirinhaturma-renan.squareweb.app/api/grupo/mensagem", { method: "POST", headers: { Authorization: "Basic " + Buffer.from("x:" + process.env.FEIRINHA_SENHA).toString("base64"), "Content-Type": "application/json" }, body: JSON.stringify({ texto }), signal: AbortSignal.timeout(120e3) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    OL.anunciado = true; salvar(); console.log("resultado enviado no grupo");
  } catch (e) { OL.tentativas = (OL.tentativas || 0) + 1; if (OL.tentativas > 5) OL.anunciado = true; console.log("não mandei o resultado:", e.message); }
}
setInterval(anunciarResultado, 60e3);

// ---------- uma festa só: todo mundo no mesmo lugar ----------
const pessoas = new Map(), porUsuario = new Map();
const todos = () => [...pessoas.values()];
const bola = { x: 38, z: 0, vx: 0, vz: 0, a: 0, b: 0, mudou: true };
let eventos = []; // emoji/frase do tique: [tipo, id, i]
// fila de espera: quem chega com a festa lotada fica na tela de entrada e entra sozinho quando abre vaga
const fila = [];
function liberarFila() {
  while (fila.length && pessoas.size < LOTACAO) { const f = fila.shift(); if (f.ws.readyState !== 1 || porUsuario.has(f.k)) continue; admitir(f.ws, f.casa, f.k, false); }
}
function avisarFila() { for (let i = fila.length - 1; i >= 0; i--) if (fila[i].ws.readyState !== 1) fila.splice(i, 1); fila.forEach((f, i) => manda(f.ws, { t: "fila", pos: i + 1, total: fila.length })); }
setInterval(avisarFila, 5000);
// espera antes de abrir: a posição é do @ (quem cai e volta não perde o lugar); às INI todo mundo entra na ordem de chegada
const espera = new Map(); // @ -> { ts, ws, casa, k }
const listaEspera = () => [...espera.values()].filter((e) => e.ws?.readyState === 1).sort((a, b) => a.ts - b.ts);
function esperar(ws, casa, k) {
  const e = espera.get(k);
  if (e) { if (e.ws && e.ws !== ws && e.ws.readyState === 1) { manda(e.ws, { t: "fora", motivo: "outro" }); e.ws.close(); } e.ws = ws; }
  else espera.set(k, { ts: Date.now(), ws, casa, k });
  ws.esperaK = k;
  const l = listaEspera(); manda(ws, { t: "espera", pos: l.findIndex((x) => x.ws === ws) + 1, total: l.length, abre: INI });
}
setInterval(() => { const l = listaEspera(); l.forEach((e, i) => manda(e.ws, { t: "espera", pos: i + 1, total: l.length, abre: INI })); }, 5000);
setInterval(() => {
  if (Date.now() < INI || !espera.size) return;
  const l = listaEspera(); espera.clear();
  for (const e of l) { delete e.ws.esperaK; if (porUsuario.has(e.k)) continue; if (pessoas.size < LOTACAO) admitir(e.ws, e.casa, e.k, false); else fila.push({ ws: e.ws, casa: e.casa, k: e.k }); }
  avisarFila();
  console.log(`festa aberta: ${pessoas.size} entraram, ${fila.length} na fila`);
}, 1000);
let proxId = 1;
const manda = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const lugar = () => { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8; return [+(Math.cos(a) * r).toFixed(1), +(Math.sin(a) * r + 2).toFixed(1)]; };
const naPraca = (x, z) => { const d = Math.hypot(x, z); const k = d > RAIO ? RAIO / d : 1; return [+(x * k).toFixed(1), +(z * k).toFixed(1)]; };
const bolaArr = () => [+bola.x.toFixed(2), +bola.z.toFixed(2), bola.a, bola.b];
function sair(p, avisoOutro) {
  if (!pessoas.has(p.id)) return;
  somarPresenca(p);
  pessoas.delete(p.id);
  if (porUsuario.get(norm(p.u)) === p) porUsuario.delete(norm(p.u));
  liberarFila();
  if (avisoOutro) { manda(p.ws, { t: "fora", motivo: "outro" }); p.ws.close(); }
}

function entrar(ws, m) {
  const teste = Boolean(CHAVE && m.chave === CHAVE);
  const agora = Date.now();
  if (!teste && agora >= FIM) return manda(ws, { t: "acabou" });
  const k = norm(m.u);
  let casa = casas.get(k);
  if (!casa && teste) casa = { u: String(m.u).replace(/^@/, "").slice(0, 30), cid: +m.cid || 3550308 };
  if (!casa) { // Olimpíadas: entra mesmo sem casa (sem estado, não soma pra estado nenhum)
    const u = String(m.u || "").replace(/^@/, "").replace(/[^\w.]/g, "").slice(0, 30);
    if (!u) return manda(ws, { t: "semcasa" });
    cont.semcasa++; casa = { u, cid: 0 };
  }
  if (!teste && agora < INI) return esperar(ws, casa, k);
  const velho = porUsuario.get(k);
  if (velho) sair(velho, true);
  else if (!teste && pessoas.size >= LOTACAO) { if (!fila.some((f) => f.ws === ws)) fila.push({ ws, casa, k }); return manda(ws, { t: "fila", pos: fila.findIndex((f) => f.ws === ws) + 1, total: fila.length }); }
  admitir(ws, casa, k, teste);
}
function admitir(ws, casa, k, teste) {
  const agora = Date.now();
  if (!teste) { cont.entradas++; unicos.add(k); }
  const [x, z] = lugar();
  const ms = minhas(casa.u), p = { id: proxId++, u: casa.u, cid: casa.cid, x, z, ws, teste, cor: Math.floor(Math.random() * 8), sk: ms.length ? ms[ms.length - 1] : -1, contaDesde: agora, t: [], vis: new Set() };
  pessoas.set(p.id, p); porUsuario.set(k, p); ws.pessoa = p;
  manda(ws, { t: "ok", id: p.id, sala: 1, fim: FIM, b: bolaArr(), v: vbArr(), pt0: PT.join(","), sks: ms, pessoas: [[p.id, p.u, p.cid, p.x, p.z, p.cor, p.sk]] });
}

// ---------- métricas: uma linha a cada 15 s em metricas.jsonl (o relatório da festa sai daqui) ----------
const ARQ_MET = new URL("./metricas.jsonl", import.meta.url);
const AREAS = [["praca", 0, 0, 15], ["palco", 0, -36, 21], ["campinho", 38, 0, 17], ["pinta", -38, 0, 17], ["corrida", -26, 32, 16], ["volei", 26, 34, 15]];
const areaDe = (x, z) => { let m = null, dm = 1e9; for (const [id, ax, az, r] of AREAS) { const d = Math.hypot(x - ax, z - az); if (d <= r && d < dm) { dm = d; m = id; } } return m || "caminho"; };
const cont = { entradas: 0, semcasa: 0, emojis: 0, frases: 0, chutes: 0, gols: 0, kb: 0, tickMs: 0, tickN: 0, tickMax: 0, quedas: 0 };
const unicos = new Set(); let picoOnline = 0, picoEm = 0, cpuAntes = process.cpuUsage(), tAntes = Date.now();
const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable();
let ult = null; const tempo = new Map(); // bloco de 5 min -> [início, pico, cpu]
function marcarTempo(m) { if (m.ts < INI || m.ts > FIM) return; const k = Math.floor((m.ts - INI) / 3e5), t = tempo.get(k) || [INI + k * 3e5, 0, 0]; t[1] = Math.max(t[1], m.online); t[2] = Math.max(t[2], m.cpuPct); tempo.set(k, t); }
// voltou de um reinício: recupera o pico e os contadores gravados
try {
  for (const l of fs.readFileSync(ARQ_MET, "utf8").split("\n")) { if (!l) continue; const m = JSON.parse(l); if (m.ts < INI - 72e5) continue; ult = m; marcarTempo(m); if (m.online > picoOnline) { picoOnline = m.online; picoEm = m.ts; } }
  if (ult) for (const k of ["entradas", "semcasa", "emojis", "frases", "chutes", "gols"]) cont[k] = ult[k] || 0;
} catch {}
setInterval(() => {
  const reais = todos().filter((p) => !p.teste), online = reais.length, areas = {};
  for (const p of reais) { const a = areaDe(p.x, p.z); areas[a] = (areas[a] || 0) + 1; }
  if (online > picoOnline) { picoOnline = online; picoEm = Date.now(); }
  const c = process.cpuUsage(cpuAntes), dt = Date.now() - tAntes; cpuAntes = process.cpuUsage(); tAntes = Date.now();
  const linha = { ts: Date.now(), online, teste: pessoas.size - online, fila: fila.length, espera: listaEspera().length, ramMB: Math.round(process.memoryUsage().rss / 1048576), cpuPct: Math.round((c.user + c.system) / 10 / dt), lagMs: +(lag.percentile(99) / 1e6).toFixed(1), tickMs: cont.tickN ? +(cont.tickMs / cont.tickN).toFixed(1) : 0, tickMax: +cont.tickMax.toFixed(1), kbps: Math.round(cont.kb / 1024 / (dt / 1000)), conexoes: wss.clients.size, entradas: cont.entradas, unicos: Math.max(unicos.size, ult?.unicos || 0), semcasa: cont.semcasa, emojis: cont.emojis, frases: cont.frases, chutes: cont.chutes, gols: cont.gols, quedas: cont.quedas, areas };
  cont.kb = cont.tickMs = cont.tickN = cont.tickMax = 0; lag.reset(); ult = linha; marcarTempo(linha);
  // só grava com gente (ou perto da hora), pra não encher o arquivo
  if (pessoas.size || linha.espera || linha.fila || Math.abs(Date.now() - INI) < 36e5) { try { fs.appendFileSync(ARQ_MET, JSON.stringify(linha) + "\n"); } catch {} }
}, 15e3);

// limite por pessoa: nada de encher a praça de emoji (por tipo: andar 4/s, emoji 1/s, frase 1 a cada 3 s)
const pode = (p, tipo, ms) => { const a = Date.now(); if (a - (p.t[tipo] || 0) < ms) return false; p.t[tipo] = a; return true; };
function mensagem(ws, txt) {
  let m; try { m = JSON.parse(txt); } catch { return; }
  ws.msgs = (ws.msgs || 0) + 1;
  if (m.t === "entrar") { if (!ws.pessoa) entrar(ws, m); return; }
  const p = ws.pessoa; if (!p || !pessoas.has(p.id)) return;
  if (m.t === "andar" && pode(p, 0, 240)) { const [x, z] = naPraca(+m.x || 0, +m.z || 0); if (p.corre) { p.ax = x; p.az = z; } else if (COR.fase === "vai" && naLargada(p)) { /* largou atrasado: anda normal, mas não conta */ p.x = x; p.z = z; p.mudou = true; } else { if (Math.hypot(x - p.x, z - p.z) <= 26) pintarCaminho(p, p.x, p.z, x, z); p.x = x; p.z = z; p.mudou = true; } }
  else if (m.t === "chute" && pode(p, 3, 250)) { const d = Math.hypot(+m.x || 0, +m.z || 0) || 1, b = bola; if (Math.hypot(p.x - b.x, p.z - b.z) < 9) { b.vx = (+m.x || 0) / d * 9; b.vz = (+m.z || 0) / d * 9; b.ultP = p; b.mudou = true; cont.chutes++; } }
  else if (m.t === "toque" && pode(p, 4, 400)) toque(p);
  else if (m.t === "vestir" && Number.isInteger(m.i) && m.i >= -1 && m.i < N_SKINS && pode(p, 5, 1500)) vestir(p, m.i);
  else if (m.t === "emoji" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_EMOJIS && pode(p, 1, 1000)) { cont.emojis++; eventos.push(["j", p.id, m.i]); }
  else if (m.t === "frase" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_FRASES && pode(p, 2, 2500)) {
    cont.frases++; const a = Number.isInteger(m.a) && m.a !== p.id && pessoas.has(m.a) ? m.a : 0;
    eventos.push(a ? ["f", p.id, m.i, a] : ["f", p.id, m.i]);
    // placar do "mais simpático": quem fala e quem recebe conversa (falar COM alguém vale 2)
    if (!p.teste) { OL.conv ||= {}; const k = norm(p.u); OL.conv[k] = (OL.conv[k] || 0) + (a ? 2 : 1); if (a) { const q = pessoas.get(a), kq = norm(q.u); if (!q.teste) OL.conv[kq] = (OL.conv[kq] || 0) + 2; } }
  }
}

// ---------- bola do campinho: o servidor é o juiz, todo mundo vê igual ----------
const CAMPO = { x0: 26, x1: 50, z0: -8, z1: 8, gol: 2.5 };
function moverBola() {
  const b = bola; if (!b.vx && !b.vz) return;
  const dt = TICK_MS / 1000;
  b.x += b.vx * dt; b.z += b.vz * dt; b.vx *= .9; b.vz *= .9; b.mudou = true;
  if (Math.hypot(b.vx, b.vz) < .15) b.vx = b.vz = 0;
  if (b.z < CAMPO.z0 || b.z > CAMPO.z1) { b.z = Math.max(CAMPO.z0, Math.min(CAMPO.z1, b.z)); b.vz *= -.7; }
  if (b.x < CAMPO.x0 || b.x > CAMPO.x1) {
    if (Math.abs(b.z) < CAMPO.gol) { cont.gols++; if (b.x < CAMPO.x0) b.b++; else b.a++; if (b.ultP && pessoas.has(b.ultP.id)) { marcar(b.ultP, 1); OL.gols++; olMsg = `⚽ GOL de @${b.ultP.u}!`; } b.ultP = null; b.x = 38; b.z = 0; b.vx = b.vz = 0; }
    else { b.x = Math.max(CAMPO.x0, Math.min(CAMPO.x1, b.x)); b.vx *= -.7; }
  }
}

// ---------- ritmo: cada um recebe só o que acontece perto dele ----------
// grade de 10 m pra achar os vizinhos sem comparar todo mundo com todo mundo
const CEL = 10, chave = (cx, cz) => cx * 1000 + cz;
let tiques = 0;
setInterval(() => {
  const t0 = performance.now();
  tiques++;
  moverBola(); moverVolei(); passoCorrida(); passoPinta();
  const ptEnv = ptZerou ? { pt0: PT.join(",") } : ptMud.length ? { pt: ptMud } : null; ptZerou = false; ptMud = [];
  const grade = new Map();
  for (const p of pessoas.values()) { const k = chave(Math.floor(p.x / CEL), Math.floor(p.z / CEL)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(p); }
  const porId = new Map(eventos.map((e) => [e[1], true])), evs = eventos; eventos = [];
  const mostrar = tiques % 13 === 0, total = porUsuario.size, bolaMudou = bola.mudou; bola.mudou = false;
  const vMudou = vb.mudou; vb.mudou = false;
  const oEnv = olMudou || tiques % 20 === 0; olMudou = false;
  const oObj = oEnv ? { f: COR.fase, ate: COR.ate - Date.now(), est: topEst(8), pod: podio(), msg: olMsg, n: COR.corredores.size, pc: { ate: ptAte - Date.now(), top: placarPinta().slice(0, 3) } } : null;
  const alc = Math.ceil(VER_RAIO / CEL);
  for (const p of pessoas.values()) {
    if (p.ws.readyState !== 1 || p.ws.bufferedAmount > 256e3) continue;
    // quem está perto: até VER pessoas dentro de VER_RAIO, as mais próximas primeiro
    const cx = Math.floor(p.x / CEL), cz = Math.floor(p.z / CEL), perto = [];
    for (let i = -alc; i <= alc; i++) for (let j = -alc; j <= alc; j++) for (const q of grade.get(chave(cx + i, cz + j)) || []) { if (q === p) continue; const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d <= VER_RAIO * VER_RAIO) perto.push([d, q]); }
    // fica quem já estava na tela (até 25% além do raio); vaga que sobrar vai pros mais perto
    const fica = [], novos = [], lim = (VER_RAIO * 1.25) ** 2;
    for (const id of p.vis) { const q = pessoas.get(id); if (q) { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d <= lim) fica.push([d, q]); } }
    if (fica.length > VER) fica.sort((x, y) => x[0] - y[0]).length = VER;
    if (fica.length < VER) { for (const par of perto) if (!p.vis.has(par[1].id)) novos.push(par); if (novos.length > VER - fica.length) novos.sort((x, y) => x[0] - y[0]).length = VER - fica.length; }
    perto.length = 0; perto.push(...fica, ...novos);
    const agora = new Set(perto.map(([, q]) => q.id)), f = [], a = [];
    for (const id of p.vis) if (!agora.has(id)) f.push(["s", id]);
    for (const [, q] of perto) { if (!p.vis.has(q.id)) f.push(["e", q.id, q.u, q.cid, q.x, q.z, q.cor, q.sk]); else if (q.mudou) a.push([q.id, q.x, q.z]); }
    for (const e of evs) if (e[1] === p.id || agora.has(e[1])) f.push(e);
    p.vis = agora;
    if (!f.length && !a.length && !mostrar && !bolaMudou && !vMudou && !oObj && !ptEnv) continue;
    const txt = JSON.stringify({ t: "q", a, f, ...(mostrar ? { total, fila: fila.length } : {}), ...(bolaMudou || mostrar ? { b: bolaArr() } : {}), ...(vMudou || mostrar ? { v: vbArr() } : {}), ...(oObj ? { o: { ...oObj, eu: !!p.corre, pts: OL.pes[norm(p.u)] || 0 } } : {}), ...(ptEnv || {}) });
    cont.kb += txt.length; p.ws.send(txt);
  }
  for (const p of pessoas.values()) p.mudou = false;
  const ms = performance.now() - t0; cont.tickMs += ms; cont.tickN++; if (ms > cont.tickMax) cont.tickMax = ms;
}, TICK_MS);

// ---------- servidor ----------
const server = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  if (req.url === "/saude") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ok: true })); }
  if (req.url === "/status") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ult, tempo: [...tempo.values()], pico: picoOnline, picoEm, online: porUsuario.size, fila: fila.length, espera: listaEspera().length, lotacao: LOTACAO, salas: 1, ini: INI, fim: FIM, casas: casas.size, ramMB: Math.round(process.memoryUsage().rss / 1048576), ol: { est: topEst(), pod: podio(), campeao: Date.now() >= FIM ? (OL.campeao || topEst(1)[0]?.[0] || null) : null, corridas: OL.corridas, gols: OL.gols, volei: OL.volei } })); }
  res.statusCode = 404; res.end();
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 512, perMessageDeflate: false });
wss.on("connection", (ws) => {
  ws.vivo = true;
  ws.on("pong", () => { ws.vivo = true; });
  ws.on("message", (b) => mensagem(ws, b.toString()));
  ws.on("close", () => { if (ws.esperaK) { const e = espera.get(ws.esperaK); if (e?.ws === ws) e.ws = null; } const i = fila.findIndex((f) => f.ws === ws); if (i >= 0) fila.splice(i, 1); if (ws.pessoa) sair(ws.pessoa); });
  ws.on("error", () => {});
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.vivo) { ws.terminate(); continue; } ws.vivo = false; ws.ping(); } }, 30e3);
// a festa acabou: avisa quem ainda está lá
setInterval(() => { if (Date.now() < FIM) return; for (const f of fila.splice(0)) { manda(f.ws, { t: "acabou" }); f.ws.close(); } for (const p of todos()) if (!p.teste) { manda(p.ws, { t: "acabou" }); sair(p); p.ws.close(); } }, 10e3);
server.listen(PORT, () => console.log(`Festa da Turma na porta ${PORT}, sala única (cada um vê até ${VER})`));
