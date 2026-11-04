// Festa da Turma: praça ao vivo da Turma do Brasil. Só cuida de quem está na festa e onde cada boneco anda.
// Sem chat livre: as pessoas só mandam emoji e frase pronta, pelo número da lista (a página é que tem os textos).
//   node --env-file=.env server.js
import http from "node:http";
import fs from "node:fs";
import { WebSocketServer } from "ws";

const PORT = +(process.env.PORT || 3295);
const MAX_SALA = +(process.env.MAX_SALA || 150);
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

// ---------- salas ----------
const salas = [];
const todos = () => salas.flatMap((s) => [...s.pessoas.values()]);
const porUsuario = new Map();
let proxId = 1;
function acharSala() {
  const s = salas.find((x) => x.pessoas.size < MAX_SALA);
  if (s) return s;
  const nova = { n: salas.length + 1, pessoas: new Map(), fila: [], bola: { x: 38, z: 0, vx: 0, vz: 0, a: 0, b: 0, mudou: true } };
  salas.push(nova);
  return nova;
}
const manda = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const lugar = () => { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8; return [+(Math.cos(a) * r).toFixed(1), +(Math.sin(a) * r + 2).toFixed(1)]; };
const naPraca = (x, z) => { const d = Math.hypot(x, z); const k = d > RAIO ? RAIO / d : 1; return [+(x * k).toFixed(1), +(z * k).toFixed(1)]; };
function sair(p, avisoOutro) {
  if (!p.sala) return;
  somarPresenca(p);
  p.sala.pessoas.delete(p.id);
  p.sala.fila.push(["s", p.id]);
  if (porUsuario.get(norm(p.u)) === p) porUsuario.delete(norm(p.u));
  p.sala = null;
  if (avisoOutro) { manda(p.ws, { t: "fora", motivo: "outro" }); p.ws.close(); }
}

function entrar(ws, m) {
  const teste = Boolean(CHAVE && m.chave === CHAVE);
  const agora = Date.now();
  if (!teste && agora < INI) return manda(ws, { t: "fechado", abre: INI });
  if (!teste && agora >= FIM) return manda(ws, { t: "acabou" });
  const k = norm(m.u);
  let casa = casas.get(k);
  if (!casa && teste) casa = { u: String(m.u).replace(/^@/, "").slice(0, 30), cid: +m.cid || 3550308 };
  if (!casa) return manda(ws, { t: "semcasa" });
  const velho = porUsuario.get(k);
  if (velho) sair(velho, true);
  const sala = acharSala(), [x, z] = lugar();
  const p = { id: proxId++, u: casa.u, cid: casa.cid, x, z, ws, sala, teste, cor: Math.floor(Math.random() * 8), contaDesde: agora, t: [] };
  sala.pessoas.set(p.id, p); porUsuario.set(k, p); ws.pessoa = p;
  const b = sala.bola; manda(ws, { t: "ok", id: p.id, sala: sala.n, fim: FIM, b: [+b.x.toFixed(2), +b.z.toFixed(2), b.a, b.b], pessoas: [...sala.pessoas.values()].map((q) => [q.id, q.u, q.cid, q.x, q.z, q.cor]) });
  sala.fila.push(["e", p.id, p.u, p.cid, p.x, p.z, p.cor]);
}

// limite por pessoa: nada de encher a praça de emoji (por tipo: andar 4/s, emoji 1/s, frase 1 a cada 3 s)
const pode = (p, tipo, ms) => { const a = Date.now(); if (a - (p.t[tipo] || 0) < ms) return false; p.t[tipo] = a; return true; };
function mensagem(ws, txt) {
  let m; try { m = JSON.parse(txt); } catch { return; }
  ws.msgs = (ws.msgs || 0) + 1;
  if (m.t === "entrar") { if (!ws.pessoa) entrar(ws, m); return; }
  const p = ws.pessoa; if (!p?.sala) return;
  if (m.t === "andar" && pode(p, 0, 240)) { const [x, z] = naPraca(+m.x || 0, +m.z || 0); p.x = x; p.z = z; p.mudou = true; }
  else if (m.t === "chute" && pode(p, 3, 250)) { const d = Math.hypot(+m.x || 0, +m.z || 0) || 1, b = p.sala.bola; if (Math.hypot(p.x - b.x, p.z - b.z) < 9) { b.vx = (+m.x || 0) / d * 9; b.vz = (+m.z || 0) / d * 9; b.mudou = true; } }
  else if (m.t === "emoji" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_EMOJIS && pode(p, 1, 1000)) p.sala.fila.push(["j", p.id, m.i]);
  else if (m.t === "frase" && Number.isInteger(m.i) && m.i >= 0 && m.i < N_FRASES && pode(p, 2, 3000)) p.sala.fila.push(["f", p.id, m.i]);
}

// ---------- bola do campinho: o servidor é o juiz, todo mundo vê igual ----------
const CAMPO = { x0: 26, x1: 50, z0: -8, z1: 8, gol: 2.5 };
function moverBola(s) {
  const b = s.bola; if (!b.vx && !b.vz) return;
  const dt = TICK_MS / 1000;
  b.x += b.vx * dt; b.z += b.vz * dt; b.vx *= .9; b.vz *= .9; b.mudou = true;
  if (Math.hypot(b.vx, b.vz) < .15) b.vx = b.vz = 0;
  if (b.z < CAMPO.z0 || b.z > CAMPO.z1) { b.z = Math.max(CAMPO.z0, Math.min(CAMPO.z1, b.z)); b.vz *= -.7; }
  if (b.x < CAMPO.x0 || b.x > CAMPO.x1) {
    if (Math.abs(b.z) < CAMPO.gol) { if (b.x < CAMPO.x0) b.b++; else b.a++; b.x = 38; b.z = 0; b.vx = b.vz = 0; }
    else { b.x = Math.max(CAMPO.x0, Math.min(CAMPO.x1, b.x)); b.vx *= -.7; }
  }
}

// ---------- ritmo: junta o que mudou e manda de uma vez ----------
let tiques = 0;
setInterval(() => {
  tiques++;
  const total = porUsuario.size;
  for (const s of salas) {
    moverBola(s);
    const andou = [];
    for (const p of s.pessoas.values()) if (p.mudou) { andou.push([p.id, p.x, p.z]); p.mudou = false; }
    const mostrar = tiques % 13 === 0;
    const bolaMudou = s.bola.mudou; s.bola.mudou = false;
    if (!andou.length && !s.fila.length && !mostrar && !bolaMudou) continue;
    const txt = JSON.stringify({ t: "q", a: andou, f: s.fila, ...(mostrar ? { n: s.pessoas.size, total } : {}), ...(bolaMudou ? { b: [+s.bola.x.toFixed(2), +s.bola.z.toFixed(2), s.bola.a, s.bola.b] } : {}) });
    s.fila = [];
    for (const p of s.pessoas.values()) if (p.ws.readyState === 1 && p.ws.bufferedAmount < 256e3) p.ws.send(txt);
  }
}, TICK_MS);

// ---------- servidor ----------
const server = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  if (req.url === "/saude") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ok: true })); }
  if (req.url === "/status") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ online: porUsuario.size, salas: salas.filter((s) => s.pessoas.size).length, ini: INI, fim: FIM, casas: casas.size, ramMB: Math.round(process.memoryUsage().rss / 1048576) })); }
  res.statusCode = 404; res.end();
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 512, perMessageDeflate: false });
wss.on("connection", (ws) => {
  ws.vivo = true;
  ws.on("pong", () => { ws.vivo = true; });
  ws.on("message", (b) => mensagem(ws, b.toString()));
  ws.on("close", () => { if (ws.pessoa) sair(ws.pessoa); });
  ws.on("error", () => {});
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.vivo) { ws.terminate(); continue; } ws.vivo = false; ws.ping(); } }, 30e3);
// a festa acabou: avisa quem ainda está lá
setInterval(() => { if (Date.now() >= FIM) for (const p of todos()) if (!p.teste) { manda(p.ws, { t: "acabou" }); sair(p); p.ws.close(); } }, 10e3);
server.listen(PORT, () => console.log(`Festa da Turma na porta ${PORT}, salas de ${MAX_SALA}`));
