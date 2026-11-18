// GTA SABENDO? com takes de VIDEO. Roda SO no GitHub Actions (workflow takes-video.yml).
//   node takes-render.mjs <video> [crop|blur|ambos]
// Precisa em <video>/: tempos.json, voz.wav, cenas-takes.json. E na raiz: takes/catalogo.json, takes/fontes.json, fontes/<id>.mp4
// Saida: saida/<video>-crop.mp4 e/ou saida/<video>-blur.mp4
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const [video, modoArg = "crop"] = process.argv.slice(2);
if (!video) { console.error("uso: node takes-render.mjs <video> [crop|blur|ambos]"); process.exit(1); }
const FPS = 30, W = 1080, H = 1920;
const rd = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), "utf8"));
const T = rd(`${video}/tempos.json`), CFG = rd(`${video}/cenas-takes.json`), CAT = rd("takes/catalogo.json"), FONTES = rd("takes/fontes.json");
const porId = Object.fromEntries(CAT.map((t) => [t.id, t]));
const TMP = path.join(RAIZ, "tmp-takes"); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.join(RAIZ, "saida"), { recursive: true });
const run = (args) => { const r = spawnSync(FFMPEG, args, { encoding: "utf8" }); if (r.status !== 0) throw new Error("ffmpeg falhou: " + args.join(" ").slice(0, 300) + "\n" + (r.stderr || "").slice(-800)); return r.stderr; };

// ---- 1) barras pretas (letterbox) de cada fonte: cropdetect em varios pontos, fica o maior retangulo
const CROP = {};
function cropDe(id) {
  if (CROP[id]) return CROP[id];
  const arq = path.join(RAIZ, "fontes", id + ".mp4"); const dur = FONTES.find((f) => f.id === id)?.duracao || 30;
  let melhor = null;
  for (const ts of [dur * 0.2, dur * 0.4, dur * 0.6, dur * 0.8]) {
    const r = spawnSync(FFMPEG, ["-ss", String(ts), "-t", "2", "-i", arq, "-vf", "cropdetect=24:2:0", "-f", "null", "-"], { encoding: "utf8" });
    const m = [...(r.stderr || "").matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop(); if (!m) continue;
    const [w, h, x, y] = m.slice(1).map(Number); if (!melhor || w * h > melhor.w * melhor.h) melhor = { w, h, x, y };
  }
  CROP[id] = melhor ? `crop=${melhor.w}:${melhor.h}:${melhor.x}:${melhor.y}` : "null"; console.log("crop", id, CROP[id]); return CROP[id];
}

// ---- 2) linha do tempo: cada cena = [ini, fim); a cena 1 comeca em 0 e a ultima vai ate total + 0.5 (igual ao molde dos videos de imagem)
const CENAS = T.cenas;
const limites = CENAS.map((c, i) => [i === 0 ? 0 : c.ini, i + 1 < CENAS.length ? CENAS[i + 1].ini : T.total + 0.5]);
const TOTAL = limites[limites.length - 1][1];
const usados = new Set();
const dur = (t) => t.fim - t.ini;
function escolheAuto(tags, tAtual) { // takes do catalogo pelas tags, sem repetir, sem texto na tela, sem violencia nos 7 primeiros segundos
  const cand = CAT.filter((t) => !usados.has(t.id) && !t.texto_na_tela && !(t.violencia && tAtual < 7) && t.tags.some((g) => tags.includes(g)));
  cand.sort((a, b) => b.tags.filter((g) => tags.includes(g)).length - a.tags.filter((g) => tags.includes(g)).length || dur(b) - dur(a));
  return cand[0];
}
const segmentos = [];
CENAS.forEach((c, i) => {
  const [a, b] = limites[i], D = b - a, cfg = CFG.cenas[i] || {};
  const lista = (cfg.takes || []).map((id) => { const t = porId[id]; if (!t) throw new Error("take nao existe: " + id); return t; });
  lista.forEach((t) => usados.add(t.id));
  let soma = lista.reduce((s, t) => s + dur(t), 0), guarda = 0;
  while (soma < D && guarda++ < 30) { const t = escolheAuto(cfg.tags || [], a + soma); if (!t) throw new Error(`cena ${i + 1}: acabaram os takes pras tags ${(cfg.tags || []).join(",")}`); usados.add(t.id); lista.push(t); soma += dur(t); }
  // cada take dura uma fracao do seu tamanho (nunca mais que ele): a soma fecha exatamente com a frase
  let t0 = a; const nq = Math.round(D * FPS); let usadosQ = 0;
  lista.forEach((t, k) => { const q = k === lista.length - 1 ? nq - usadosQ : Math.round(nq * dur(t) / soma); usadosQ += q; segmentos.push({ t, q, cena: i + 1, ini: t0 }); t0 += q / FPS; });
});
const totalQ = segmentos.reduce((s, x) => s + x.q, 0);
console.log(`cenas ${CENAS.length}, takes ${segmentos.length}, total ${(totalQ / FPS).toFixed(2)}s`);
fs.writeFileSync(path.join(RAIZ, "saida", `${video}-takes-usados.json`), JSON.stringify(segmentos.map((s) => ({ cena: s.cena, take: s.t.id, de: +s.ini.toFixed(2), dur: +(s.q / FPS).toFixed(2), desc: s.t.descricao })), null, 1));

// ---- 3) texto transparente (Playwright) — gera os PNGs unicos por estado (frase/palavra ativa)
function servidor() {
  return http.createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split("?")[0]));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    const tipos = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
    r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
  }).listen(0);
}
async function textoPNGs() {
  const { chromium } = await import("playwright");
  const srv = servidor(); const porta = srv.address().port;
  const nav = await chromium.launch(); const pg = await nav.newPage({ viewport: { width: W, height: H } });
  pg.on("pageerror", (e) => console.error("ERRO NA PAGINA:", e.message));
  await pg.goto(`http://localhost:${porta}/takes/texto.html?v=${video}`);
  await pg.waitForFunction(() => window.pronto === true, null, { timeout: 90000 });
  const cache = new Map(), quadros = [];
  for (let i = 0; i < totalQ; i++) {
    const t = i / FPS; const chave = await pg.evaluate((x) => window.chave(x), t);
    if (!cache.has(chave)) { await pg.evaluate((x) => window.renderFrame(x), t); cache.set(chave, await pg.screenshot({ type: "png", omitBackground: true })); }
    quadros.push(cache.get(chave));
  }
  console.log("estados de texto:", cache.size); await nav.close(); srv.close(); return quadros;
}

// ---- 4) corta e enquadra os takes (1080x1920)
function filtroModo(modo, take) {
  const id = take.fonte, foco = take.foco ?? 0.5;
  const base = `${cropDe(id)}`;
  if (modo === "crop") return `${base},scale=-2:${H}:flags=lanczos,crop=${W}:${H}:(iw-${W})*${foco}:0,fps=${FPS},setsar=1,format=yuv420p`;
  // blur: video inteiro 1080 de largura no meio, fundo = o mesmo video ampliado e desfocado
  return `${base},split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:6,eq=brightness=-0.12:saturation=1.1[bg];[b]scale=${W}:-2:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${FPS},setsar=1,format=yuv420p`;
}
function montaBase(modo) {
  const lista = [];
  segmentos.forEach((s, k) => {
    const out = path.join(TMP, `${modo}-${String(k).padStart(3, "0")}.mp4`);
    run(["-y", "-v", "error", "-ss", String(s.t.ini), "-i", path.join(RAIZ, "fontes", s.t.fonte + ".mp4"), "-an", "-frames:v", String(s.q), "-vf", filtroModo(modo, s.t), "-c:v", "libx264", "-crf", "15", "-preset", "veryfast", out]);
    lista.push(`file '${out}'`);
  });
  const txt = path.join(TMP, `${modo}-lista.txt`); fs.writeFileSync(txt, lista.join("\n"));
  const base = path.join(TMP, `${modo}-base.mp4`); run(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", txt, "-c", "copy", base]); return base;
}

// ---- 5) junta: base + texto (PNG com alfa por stdin) + voz
async function finaliza(modo, base, quadros) {
  const saida = path.join(RAIZ, "saida", `${video}-${modo}.mp4`);
  const ff = spawn(FFMPEG, ["-y", "-v", "error", "-i", base, "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "-", "-i", path.join(RAIZ, video, "voz.wav"),
    "-filter_complex", "[1:v]format=rgba[t];[0:v][t]overlay=0:0:format=auto,format=yuv420p[v]", "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-t", (totalQ / FPS).toFixed(3), saida], { stdio: ["pipe", "ignore", "inherit"] });
  const fechou = new Promise((ok) => ff.on("close", ok));
  for (const b of quadros) { if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once("drain", r)); }
  ff.stdin.end(); const code = await fechou; if (code !== 0) throw new Error("ffmpeg final falhou " + modo);
  console.log("pronto", saida);
}

const modos = modoArg === "ambos" ? ["crop", "blur"] : [modoArg];
const t0 = Date.now();
const quadros = await textoPNGs();
for (const m of modos) { const base = montaBase(m); await finaliza(m, base, quadros); }
console.log(`render em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
