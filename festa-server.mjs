// Festa da Turma: praça ao vivo da Turma do Brasil. Só cuida de quem está na festa e onde cada boneco anda.
// Sem chat livre: as pessoas só mandam emoji e frase pronta, pelo número da lista (a página é que tem os textos).
//   node --env-file=.env server.js
import http from "node:http";
import fs from "node:fs";
import { WebSocketServer } from "ws";

const PORT = +(process.env.PORT || 3295);
const LOTACAO = +(process.env.LOTACAO || 1000); // mais que isso espera na fila
const VER = +(process.env.VER || 150), VER_RAIO = +(process.env.VER_RAIO || 34); // cada celular recebe no máximo VER bonecos, os mais perto
const RAIO = 56, TICK_MS = 150, N_EMOJIS = 6, N_FRASES = 6;
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

// ---------- presença (vale pontos no fim) ----------
const estado = (() => { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return { presenca: {}, pago: false }; } })();
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
  if (!casa) return manda(ws, { t: "semcasa" });
  if (!teste && agora < INI) return esperar(ws, casa, k);
  const velho = porUsuario.get(k);
  if (velho) sair(velho, true);
  else if (!teste && pessoas.size >= LOTACAO) { if (!fila.some((f) => f.ws === ws)) fila.push({ ws, casa, k }); return manda(ws, { t: "fila", pos: fila.findIndex((f) => f.ws === ws) + 1, total: fila.length }); }
  admitir(ws, casa, k, teste);
}
function admitir(ws, casa, k, teste) {
  const agora = Date.now();
  const [x, z] = lugar();
  const p = { id: proxId++, u: casa.u, cid: casa.cid, x, z, ws, teste, cor: Math.floor(Math.random() * 8), contaDesde: agora, t: [], vis: new Set() };
  pessoas.set(p.id, p); porUsuario.set(k, p); ws.pessoa = p;
  manda(ws, { t: "ok", id: p.id, sala: 1, fim: FIM, b: bolaArr(), pessoas: [[p.id, p.u, p.cid, p.x, p.z, p.cor]] });
}

// limite por pessoa: nada de encher a praça de emoji (por tipo: andar 4/s, emoji 1/s, frase 1 a cada 3 s)
const pode = (p, tipo, ms) => { const a = Date.now(); if (a - (p.t[tipo] || 0) < ms) return false; p.t[tipo] = a; return true; };
function mensagem(ws, txt) {
  let m; try { m = JSON.parse(txt); } catch { return; }
  ws.msgs = (ws.msgs || 0) + 1;
  if (m.t === "entrar") { if (!ws.pessoa) entrar(ws, m); return; }
  const p = ws.pessoa; if (!p || !pessoas.has(p.id)) return;
  if (m.t === "andar" && pode(p, 0, 240)) { const [x, z] = naPraca(+m.x || 0, +m.z || 0); p.x = x; p.z = z; p.mudou = true; }
  else if (m.t === "chute" && pode(p, 3, 250)) { const d = Math.hypot(+m.x || 0, +m.z || 0) || 1, b = bola; if (Math.hypot(p.x - b.x, p.z - b.z) < 9) { b.vx = (+m.x || 0) / d * 9; b.vz = (+m.z || 0) / d * 9; b.mudou = true; } }
  else if (m.t === "emoji" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_EMOJIS && pode(p, 1, 1000)) eventos.push(["j", p.id, m.i]);
  else if (m.t === "frase" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_FRASES && pode(p, 2, 3000)) eventos.push(["f", p.id, m.i]);
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
    if (Math.abs(b.z) < CAMPO.gol) { if (b.x < CAMPO.x0) b.b++; else b.a++; b.x = 38; b.z = 0; b.vx = b.vz = 0; }
    else { b.x = Math.max(CAMPO.x0, Math.min(CAMPO.x1, b.x)); b.vx *= -.7; }
  }
}

// ---------- ritmo: cada um recebe só o que acontece perto dele ----------
// grade de 10 m pra achar os vizinhos sem comparar todo mundo com todo mundo
const CEL = 10, chave = (cx, cz) => cx * 1000 + cz;
let tiques = 0;
setInterval(() => {
  tiques++;
  moverBola();
  const grade = new Map();
  for (const p of pessoas.values()) { const k = chave(Math.floor(p.x / CEL), Math.floor(p.z / CEL)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(p); }
  const porId = new Map(eventos.map((e) => [e[1], true])), evs = eventos; eventos = [];
  const mostrar = tiques % 13 === 0, total = porUsuario.size, bolaMudou = bola.mudou; bola.mudou = false;
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
    for (const [, q] of perto) { if (!p.vis.has(q.id)) f.push(["e", q.id, q.u, q.cid, q.x, q.z, q.cor]); else if (q.mudou) a.push([q.id, q.x, q.z]); }
    for (const e of evs) if (e[1] === p.id || agora.has(e[1])) f.push(e);
    p.vis = agora;
    if (!f.length && !a.length && !mostrar && !bolaMudou) continue;
    p.ws.send(JSON.stringify({ t: "q", a, f, ...(mostrar ? { total, fila: fila.length } : {}), ...(bolaMudou || mostrar ? { b: bolaArr() } : {}) }));
  }
  for (const p of pessoas.values()) p.mudou = false;
}, TICK_MS);

// ---------- servidor ----------
const server = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  if (req.url === "/saude") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ok: true })); }
  if (req.url === "/status") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ online: porUsuario.size, fila: fila.length, espera: listaEspera().length, lotacao: LOTACAO, salas: 1, ini: INI, fim: FIM, casas: casas.size, ramMB: Math.round(process.memoryUsage().rss / 1048576) })); }
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
