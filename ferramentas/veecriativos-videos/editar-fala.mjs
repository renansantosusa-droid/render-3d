// Edita um video de FALA da Veecriativos no estilo CapCut da referencia (@vittoriagalvao):
// legenda palavra por palavra no alto, punch-in de zoom, titulo cursivo dourado, lista com marcador,
// fundo desfocado com palavra grande, cartao, CTA "EU QUERO" e @ no fim. Mantem a voz original
// (musica o Renan escolhe no app).
// Uso: node editar-fala.mjs roteiro.json [--previa]
//   --previa: gera so um JPG com quadros nos momentos de cada efeito, pra conferir rosto/pes/texto
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const LAYOUT = path.join(RAIZ, "ferramentas/layout-post-instagram");
const require = createRequire(path.join(LAYOUT, "package.json"));
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const FFMPEG = process.env.FFMPEG || path.join(LAYOUT, "node_modules/ffmpeg-static/ffmpeg.exe"); // FFMPEG = no GitHub (Linux)

const FONTES = path.join(import.meta.dirname, "fonts");
GlobalFonts.registerFromPath(path.join(FONTES, "Inter-SemiBold.ttf"), "VC-texto");
GlobalFonts.registerFromPath(path.join(FONTES, "Inter-Bold.otf"), "VC-forte");
GlobalFonts.registerFromPath(path.join(FONTES, "GreatVibes-Regular.ttf"), "VC-cursiva");
GlobalFonts.registerFromPath(path.join(LAYOUT, "fonts/NotoColorEmoji.ttf"), "VC-emoji");

const W = 1080, H = 1920, FPS = 30;
const HDR_PARA_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
const DOURADO = ["#fbedc8", "#e2bf72", "#b98a3a"];
const ROSA = "#ff4f9a";

const roteiro = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const PREVIA = process.argv.includes("--previa");
const SRC = path.join(RAIZ, roteiro.arquivo);
const SAIDA = path.join(RAIZ, roteiro.saida || "dados/veecriativos/videos-novos");
const TMP = path.join(SAIDA, `.tmp-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg falhou");
}
const info = spawnSync(FFMPEG, ["-hide_banner", "-i", SRC], { encoding: "utf8" }).stderr;
const HDR = /arib-std-b67|smpte2084/.test(info);
const [, hh, mm, ss] = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
const TOTAL = roteiro.duracao ?? (+hh * 3600 + +mm * 60 + +ss);
const NQ = Math.floor(TOTAL * FPS);
const q = t => Math.round(t * FPS); // segundos -> quadro

// ---------- palavras (whisper -ml 1 -oj: pedaco que comeca com espaco = palavra nova) ----------
const palavras = [];
for (const s of JSON.parse(fs.readFileSync(path.join(RAIZ, roteiro.palavras), "utf8")).transcription) {
  const txt = s.text; if (!txt.trim() || /^\[/.test(txt.trim())) continue;
  const de = s.offsets.from / 1000, ate = s.offsets.to / 1000;
  if (/^\s/.test(txt) || !palavras.length) palavras.push({ w: txt.trim(), de, ate });
  else { const p = palavras.at(-1); p.w += txt; p.ate = ate; }
}
for (const p of palavras) {
  const limpa = p.w.replace(/[.,;:]+$/, "");
  p.w = roteiro.legenda?.correcoes?.[limpa.toLowerCase()] ?? limpa;
}
palavras.forEach((p, i) => { const prox = palavras[i + 1]; p.fim = prox ? Math.min(prox.de, p.ate + 0.6) : p.ate + 0.6; });

// ---------- desenho ----------
const facil = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
function sombra(g, blur = 14, a = 0.55) { g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur; g.shadowOffsetY = 3; }
function semSombra(g) { g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0; }
function dourado(g, y, tam) {
  const gr = g.createLinearGradient(0, y - tam * 0.6, 0, y + tam * 0.3);
  DOURADO.forEach((c, i) => gr.addColorStop(i / (DOURADO.length - 1), c)); return gr;
}
function espacado(g, txt, x, y, esp) { // texto centralizado com espacamento entre letras
  const larg = [...txt].reduce((s, c) => s + g.measureText(c).width + esp, -esp);
  let cx = x - larg / 2; g.textAlign = "left";
  for (const c of txt) { g.fillText(c, cx, y); cx += g.measureText(c).width + esp; }
  g.textAlign = "center"; return larg;
}
// entra subindo e aparecendo (0.25s), sai sumindo (0.15s)
function entrada(t, de, ate) { return { a: Math.min(facil((t - de) / 0.25), Math.min(1, (ate - t) / 0.15)), dy: (1 - facil((t - de) / 0.25)) * 40 }; }

const desenhar = {
  legenda(g, t, e) {
    const p = palavras.find(p => t >= p.de && t < p.fim);
    if (!p) return null;
    const k = 0.82 + 0.18 * facil((t - p.de) / 0.1);
    g.save(); g.translate(W / 2, H * e.y); g.scale(k, k);
    g.font = `${e.tamanho || 62}px "VC-texto", "VC-emoji"`; g.textAlign = "center"; g.textBaseline = "middle";
    sombra(g, 16, 0.7); g.fillStyle = "#fff"; g.fillText(p.w, 0, 0); g.restore();
    return p.w + Math.round(k * 20);
  },
  titulo(g, t, e) { // cursiva dourada grande com texto forte branco por cima (efeito "Sabe fazer / esse tipo")
    const { a, dy } = entrada(t, e.de, e.ate); g.globalAlpha = a;
    const y = H * e.y + dy; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = `${e.tamCursiva || 170}px "VC-cursiva"`; sombra(g, 18, 0.5);
    g.fillStyle = dourado(g, y, e.tamCursiva || 170); g.fillText(e.cursiva, W / 2 - 40, y);
    if (e.texto) {
      g.font = `${e.tamTexto || 78}px "VC-forte", "VC-emoji"`; sombra(g, 14, 0.6); g.fillStyle = "#fff";
      g.fillText(e.texto, W / 2 + 70, y + (e.tamTexto || 78) * 0.95);
    }
    return Math.round(a * 20) + "|" + Math.round(dy);
  },
  lista(g, t, e) { // itens surgem um a um com marcador e linha; mostra no maximo `max` (os antigos sobem e somem)
    const max = e.max || 4, gap = e.gap || 150, vis = e.itens.filter(i => t >= i.de);
    if (!vis.length) return null;
    const fimA = Math.min(1, (e.ate - t) / 0.15), ult = vis.at(-1), anim = facil((t - ult.de) / 0.28);
    const out = [];
    vis.forEach((it, i) => {
      const slot = i - Math.max(0, vis.length - max), slotAnt = i - Math.max(0, vis.length - 1 - max);
      const s = it === ult ? slot : slotAnt + (slot - slotAnt) * anim;
      let a = it === ult ? anim : (s < 0 ? Math.max(0, 1 + s) : 1);
      a *= fimA; if (a <= 0.01) return;
      const y = H * e.y + s * gap + (it === ult ? (1 - anim) * 30 : 0);
      g.globalAlpha = a; semSombra(g);
      g.font = `${e.tamanho || 46}px "VC-forte"`;
      const lw = [...it.texto].reduce((s, c) => s + g.measureText(c).width + 3, 0) + 56;
      g.fillStyle = "rgba(0,0,0,0.42)"; g.beginPath(); g.roundRect((W - lw) / 2, y - 36, lw, it.sub ? 98 : 72, 18); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2.5;
      g.beginPath(); g.arc(W / 2, y - 64, 7, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(W / 2, y - 57); g.lineTo(W / 2, y - 36); g.stroke();
      sombra(g, 14, 0.75); g.fillStyle = "#fff"; g.textBaseline = "middle";
      g.font = `${e.tamanho || 46}px "VC-forte"`; espacado(g, it.texto, W / 2, y, 3);
      if (it.sub) { g.font = `28px "VC-texto"`; g.fillStyle = "rgba(255,255,255,0.92)"; g.fillText(it.sub, W / 2, y + 40); }
      out.push(Math.round(s * 30) + ":" + Math.round(a * 20));
    });
    return out.join(",");
  },
  grande(g, t, e) { // vai junto com o desfoque do fundo: palavra enorme no meio
    const { a } = entrada(t, e.de, e.ate), k = 0.9 + 0.1 * facil((t - e.de) / 0.3);
    g.globalAlpha = a; g.save(); g.translate(W / 2, H * e.y); g.scale(k, k);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = `${e.tamanho || 210}px "VC-forte"`; sombra(g, 24, 0.5); g.fillStyle = "#fff"; g.fillText(e.texto, 0, 90);
    if (e.cursiva) { g.font = `150px "VC-cursiva"`; g.fillStyle = dourado(g, -60, 150); g.fillText(e.cursiva, -120, -90); }
    if (e.sub) { g.font = `46px "VC-texto"`; sombra(g, 12, 0.6); g.fillStyle = "#fff"; g.fillText(e.sub, 0, 175); }
    g.restore(); return Math.round(a * 20) + "|" + Math.round(k * 100);
  },
  cartao(g, t, e) { // cartao escuro arredondado (estilo "TITLE HERE")
    const { a, dy } = entrada(t, e.de, e.ate); g.globalAlpha = a;
    g.font = `${e.tamanho || 62}px "VC-forte"`; const lt = g.measureText(e.texto).width;
    const lw = Math.max(lt + 90, 360), lh = e.rotulo ? 170 : 130, x = (W - lw) / 2, y = H * e.y - lh / 2 + dy;
    sombra(g, 30, 0.45); g.fillStyle = "rgba(24,30,34,0.92)"; g.beginPath(); g.roundRect(x, y, lw, lh, 26); g.fill();
    semSombra(g); g.textAlign = "center"; g.textBaseline = "middle";
    if (e.rotulo) { g.font = `24px "VC-forte"`; g.fillStyle = ROSA; espacado(g, e.rotulo, W / 2, y + 44, 4); }
    g.font = `${e.tamanho || 62}px "VC-forte", "VC-emoji"`; g.fillStyle = "#fff"; g.fillText(e.texto, W / 2, y + lh - 62);
    return Math.round(a * 20) + "|" + Math.round(dy);
  },
  cta(g, t, e) { // "Comenta" cursivo + pilula rosa EU QUERO pulsando
    const { a, dy } = entrada(t, e.de, e.ate); g.globalAlpha = a;
    const y = H * e.y + dy, pulso = 1 + 0.04 * Math.sin((t - e.de) * Math.PI * 2 * 1.6);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = `130px "VC-cursiva"`; sombra(g, 18, 0.5); g.fillStyle = dourado(g, y - 70, 130); g.fillText(e.acima || "Comenta", W / 2, y - 70);
    g.save(); g.translate(W / 2, y + 30); g.scale(pulso, pulso);
    g.font = `92px "VC-forte"`; const lw = g.measureText(e.texto).width + 110;
    sombra(g, 26, 0.45); g.fillStyle = ROSA; g.beginPath(); g.roundRect(-lw / 2, -70, lw, 140, 70); g.fill();
    semSombra(g); g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(e.texto, 0, 6); g.restore();
    return Math.round(a * 20) + "|" + Math.round(dy) + "|" + Math.round(pulso * 200);
  },
  arroba(g, t, e) { // selo branco com icone do Instagram + @
    const { a, dy } = entrada(t, e.de, e.ate); g.globalAlpha = a;
    g.font = `42px "VC-forte"`; const lt = g.measureText(e.texto).width, lw = lt + 140, lh = 86;
    const x = (W - lw) / 2, y = H * e.y - lh / 2 + dy;
    sombra(g, 20, 0.35); g.fillStyle = "#fff"; g.beginPath(); g.roundRect(x, y, lw, lh, 22); g.fill(); semSombra(g);
    const ix = x + 22, iy = y + 15, is = 56, gr = g.createLinearGradient(ix, iy + is, ix + is, iy);
    gr.addColorStop(0, "#feda75"); gr.addColorStop(0.35, "#fa7e1e"); gr.addColorStop(0.6, "#d62976"); gr.addColorStop(1, "#4f5bd5");
    g.fillStyle = gr; g.beginPath(); g.roundRect(ix, iy, is, is, 15); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 4.5;
    g.beginPath(); g.roundRect(ix + 11, iy + 11, is - 22, is - 22, 9); g.stroke();
    g.beginPath(); g.arc(ix + is / 2, iy + is / 2, 8, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ix + is - 17, iy + 17, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1a1a1a"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(e.texto, ix + is + 20, y + lh / 2 + 2);
    return Math.round(a * 20) + "|" + Math.round(dy);
  },
};

const elementos = roteiro.elementos || [];
const legenda = { tipo: "legenda", y: 0.125, esconder: [], ...roteiro.legenda };
const TELA = createCanvas(W, H);
function quadroOverlay(t) {
  // uma tela so, limpa a cada quadro (criar uma por quadro esgota a memoria do notebook)
  const c = TELA, g = c.getContext("2d"), chave = [];
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  for (const e of elementos) {
    const ate = e.ate ?? TOTAL;
    if (t < e.de || t >= ate) continue;
    g.save(); const k = desenhar[e.tipo](g, t, { ...e, ate }); g.restore();
    if (k != null) chave.push(e.tipo + k);
  }
  if (!legenda.esconder.some(([de, ate]) => t >= de && t < ate)) {
    g.save(); const k = desenhar.legenda(g, t, legenda); g.restore(); if (k != null) chave.push(k);
  }
  return { c, chave: chave.join(";") };
}

// ---------- base: cortes por zoom/desfoque (cada um vira um clipe com numero exato de quadros) ----------
const zooms = (roteiro.zooms || [{ de: 0, zoom: 1 }]).slice().sort((a, b) => a.de - b.de);
const desfoques = roteiro.desfoque || [];
const cortes = [...new Set([0, ...zooms.map(z => q(z.de)), ...desfoques.flatMap(d => [q(d.de), q(d.ate)]), NQ])]
  .filter(f => f >= 0 && f <= NQ).sort((a, b) => a - b);
const pedacos = cortes.slice(0, -1).map((f0, i) => {
  const f1 = cortes[i + 1], t = f0 / FPS;
  const z = zooms.filter(z => q(z.de) <= f0).at(-1) || { zoom: 1 };
  return { f0, f1, z, blur: desfoques.some(d => q(d.de) <= f0 && f0 < q(d.ate)) };
});
function filtroBase(p) {
  const zoom = p.z.zoom || 1;
  return [HDR ? HDR_PARA_SDR : null,
    `scale=${Math.round(W * zoom)}:${Math.round(H * zoom)}:force_original_aspect_ratio=increase`,
    // ancoraY: 0 = corta so embaixo (tira os pes), 0.5 = centro; ancoraX idem na horizontal
    `crop=${W}:${H}:(iw-${W})*${p.z.ancoraX ?? 0.5}:(ih-${H})*${p.z.ancoraY ?? 0.35}`,
    p.blur ? "boxblur=28:2" : null, `fps=${FPS}`, "setsar=1", "format=yuv420p"].filter(Boolean).join(",");
}

if (PREVIA) {
  const tempos = roteiro.previa || [...new Set([0.5, ...elementos.map(e => +(((e.de + (e.ate ?? TOTAL)) / 2)).toFixed(2)), ...zooms.map(z => z.de + 0.4)])]
    .filter(t => t < TOTAL).sort((a, b) => a - b);
  const quadros = tempos.map((t, i) => {
    const p = pedacos.filter(p => p.f0 <= q(t)).at(-1), ov = path.join(TMP, `po${i}.png`), out = path.join(TMP, `pq${i}.png`);
    fs.writeFileSync(ov, quadroOverlay(t).c.toBuffer("image/png"));
    ffmpeg(["-ss", String(t), "-i", SRC, "-i", ov, "-frames:v", "1", "-filter_complex",
      `[0:v]${filtroBase(p)}[b];[b][1:v]overlay=0:0,scale=270:-2,drawtext=text='${t.toFixed(1)}s':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black`, out]);
    return out;
  });
  const col = 6, lin = Math.ceil(quadros.length / col);
  while (quadros.length < col * lin) quadros.push(quadros.at(-1));
  const saida = path.join(SAIDA, `${roteiro.nome}_previa.jpg`);
  ffmpeg([...quadros.flatMap(x => ["-i", x]), "-filter_complex",
    `${quadros.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${quadros.length}:layout=${quadros.map((_, i) => `${(i % col) * 270}_${Math.floor(i / col) * 480}`).join("|")}`, saida]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("previa:", path.relative(RAIZ, saida), `(${tempos.length} quadros: ${tempos.join(", ")})`);
  process.exit(0);
}

// 1) camada de texto: so grava PNG quando o desenho muda; o resto vira "duracao" no concat
let ultimo = null, listaOv = [], nPng = 0;
for (let f = 0; f < NQ; f++) {
  const { c, chave } = quadroOverlay(f / FPS);
  if (ultimo && chave === ultimo.chave) { ultimo.n++; continue; }
  const arq = path.join(TMP, `o${String(nPng++).padStart(5, "0")}.png`);
  fs.writeFileSync(arq, c.toBuffer("image/png"));
  ultimo = { chave, arq, n: 1 }; listaOv.push(ultimo);
}
fs.writeFileSync(path.join(TMP, "ov.txt"), listaOv.map(o => `file '${o.arq.replace(/\\/g, "/")}'\nduration ${(o.n / FPS).toFixed(6)}`).join("\n")
  + `\nfile '${listaOv.at(-1).arq.replace(/\\/g, "/")}'\n`);
console.log(`camada de texto: ${nPng} desenhos diferentes em ${NQ} quadros`);

// 2) base com zoom/desfoque por pedaco
const clipes = pedacos.map((p, i) => {
  const out = path.join(TMP, `c${String(i).padStart(2, "0")}.mp4`);
  ffmpeg(["-ss", (p.f0 / FPS).toFixed(4), "-i", SRC, "-an", "-frames:v", String(p.f1 - p.f0), "-vf", filtroBase(p),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out]);
  console.log(`pedaco ${i + 1}/${pedacos.length} ok (${(p.f0 / FPS).toFixed(2)}-${(p.f1 / FPS).toFixed(2)}s zoom ${p.z.zoom || 1}${p.blur ? " desfoque" : ""})`);
  return out;
});
fs.writeFileSync(path.join(TMP, "base.txt"), clipes.map(c => `file '${c.replace(/\\/g, "/")}'`).join("\n"));

// 3) junta base + texto + voz original
const final = path.join(SAIDA, `${roteiro.nome}.mp4`);
ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(TMP, "base.txt"),
  "-f", "concat", "-safe", "0", "-i", path.join(TMP, "ov.txt"), "-t", TOTAL.toFixed(3), "-i", SRC,
  "-filter_complex", "[1:v]fps=30,format=rgba[ov];[0:v][ov]overlay=0:0:eof_action=repeat,format=yuv420p[v]",
  "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high",
  "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-map_metadata", "-1", "-shortest", final]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("pronto:", path.relative(RAIZ, final), `${TOTAL.toFixed(1)}s`);
