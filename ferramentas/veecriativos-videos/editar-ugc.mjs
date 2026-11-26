// Edita FALA da Vee no estilo "anuncio UGC de Black" modelado na Cambly (grupo Modelagem 16/11/2026 15h09,
// dados/whatsapp-claude/modelagem/2026-11-16_15h09_4A594D/ESTILO.md):
// legenda por FRASE, italica creme no meio da tela; preco antigo riscado com X vermelho -> etiqueta do preco novo
// com pop; faixa com os produtos no topo nos primeiros segundos; selo da marca deslizando da direita;
// bloco de fundo PRETO com faixa 16:9 de produto (video ou cards) e legenda embaixo; cards de produto pipocando.
// Voz original, corte seco. Uso: node editar-ugc.mjs roteiro.json [--previa]
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const LAYOUT = path.join(RAIZ, "ferramentas/layout-post-instagram");
const require = createRequire(path.join(LAYOUT, "package.json"));
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const FFMPEG = process.env.FFMPEG || path.join(LAYOUT, "node_modules/ffmpeg-static/ffmpeg.exe");
const FONTES = path.join(import.meta.dirname, "fonts");
GlobalFonts.registerFromPath(path.join(FONTES, "Inter-SemiBold.ttf"), "U-texto");
GlobalFonts.registerFromPath(path.join(FONTES, "Inter-Bold.otf"), "U-forte");
GlobalFonts.registerFromPath(path.join(LAYOUT, "fonts/NotoColorEmoji.ttf"), "U-emoji");

const W = 1080, H = 1920, FPS = 30;
const HDR_PARA_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
const CREME = "#F5EBD7", ROSA = "#FF2E88", PRETO = "#0B0B0D", VERMELHO = "#E3242B";

const R = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const PREVIA = process.argv.includes("--previa");
const SRC = path.join(RAIZ, R.arquivo);
const SAIDA = path.join(RAIZ, R.saida || "dados/veecriativos/videos-novos");
const TMP = path.join(SAIDA, `.tmp-ugc-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });
const ffmpeg = a => { const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: "inherit" }); if (r.status !== 0) throw new Error("ffmpeg falhou"); };
const hdr = f => /arib-std-b67|smpte2084/.test(spawnSync(FFMPEG, ["-hide_banner", "-i", f], { encoding: "utf8" }).stderr);
const HDR = hdr(SRC);
const TOTAL = R.duracao, NQ = Math.floor(TOTAL * FPS), q = t => Math.round(t * FPS);

// ---------- imagens: cards recortados de uma prancha ----------
const IMG = {};
for (const [nome, arq] of Object.entries(R.imagens || {})) IMG[nome] = await loadImage(fs.readFileSync(path.join(RAIZ, arq)));
const card = (g, c, x, y, w, h) => { // c = {img, r:[x,y,w,h]} desenha cortado com cantos redondos
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) * 0.07); g.clip();
  const im = IMG[c.img]; let [sx, sy, sw, sh] = c.r || [0, 0, im.width, im.height];
  if (sw / sh > w / h) { const nw = sh * w / h; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw * h / w; sy += (sh - nh) * (c.ancoraY ?? 0.3); sh = nh; }
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h); g.restore();
};
const CARDS = R.cards || {};

// ---------- desenho ----------
const facil = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const pop = x => { x = Math.min(1, Math.max(0, x)); return x < 0.6 ? 0.8 + 0.25 * facil(x / 0.6) : 1.05 - 0.05 * facil((x - 0.6) / 0.4); };
function sombra(g, b = 12, a = 0.45) { g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = b; g.shadowOffsetY = 2; }
function semSombra(g) { g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0; }
const noBloco = t => (R.blocos || []).find(b => t >= b.de && t < b.ate);

function quebra(g, txt, max) {
  const out = [];
  for (const parte of txt.split("\n")) {
    let l = "";
    for (const w of parte.split(" ")) { const s = l ? l + " " + w : w; if (g.measureText(s).width > max && l) { out.push(l); l = w; } else l = s; }
    out.push(l);
  }
  return out;
}
function legenda(g, t) {
  const f = R.frases.find(f => t >= f.de && t < f.ate); if (!f) return null;
  const b = noBloco(t), y = b ? b.legendaY : (R.legendaY || 0.56) * H, tam = R.legendaTam || 64;
  g.font = `${tam}px "U-texto", "U-emoji"`; g.textBaseline = "middle"; g.textAlign = "left";
  const linhas = quebra(g, f.texto, 900), lh = tam * 1.2;
  linhas.forEach((l, i) => {
    const yy = y + (i - (linhas.length - 1) / 2) * lh;
    // destaque: palavra em CAIXA ALTA marcada com * fica rosa (ex.: *BLACK*)
    const pedacos = l.split(/(\*[^*]+\*)/).filter(Boolean).map(p => ({ s: p.replace(/\*/g, ""), d: p.startsWith("*") }));
    const larg = pedacos.reduce((s, p) => s + g.measureText(p.s).width, 0);
    let x = W / 2 - larg / 2;
    for (const p of pedacos) {
      g.save(); g.translate(x, yy); g.transform(1, 0, -0.19, 1, 0, 0); // italico
      if (!b) { sombra(g, 10, 0.85); g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = "rgba(40,28,20,0.55)"; g.strokeText(p.s, 0, 0); semSombra(g); }
      g.fillStyle = p.d ? ROSA : (b ? "#fff" : CREME); g.fillText(p.s, 0, 0); g.restore();
      x += g.measureText(p.s).width;
    }
  });
  return "L" + R.frases.indexOf(f);
}

const desenhar = {
  faixaTopo(g, t, e) { // "print" dos produtos no topo (picture-in-picture)
    const a = Math.min(1, (e.ate - t) / 0.12); g.globalAlpha = a;
    const x = 40, y = e.y || 60, w = W - 80, h = e.h || 290;
    sombra(g, 24, 0.35); g.fillStyle = "#141416"; g.beginPath(); g.roundRect(x, y, w, h, 26); g.fill(); semSombra(g);
    const n = e.cards.length, pad = 18, cw = (w - pad * (n + 1)) / n, ch = h - pad * 2;
    e.cards.forEach((c, i) => card(g, CARDS[c], x + pad + i * (cw + pad), y + pad, cw, ch));
    return "F" + Math.round(a * 10);
  },
  precoVelho(g, t, e) { // texto preto + X vermelho desenhado
    g.font = `bold ${e.tam || 104}px "U-forte"`; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#111"; sombra(g, 10, 0.25); g.fillText(e.texto, e.x, e.y); semSombra(g);
    const lw = g.measureText(e.texto).width, top = e.y - (e.tam || 104) * 0.78, bot = e.y + 8;
    const p = Math.min(1, Math.max(0, (t - e.x_de) / 0.32));
    if (p > 0) {
      g.strokeStyle = VERMELHO; g.lineWidth = 20; g.lineCap = "round";
      const k1 = Math.min(1, p * 2), k2 = Math.max(0, p * 2 - 1);
      const [ax, ay, bx, by] = [e.x - 14, top - 6, e.x + lw + 14, bot + 4];
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * k1, ay + (by - ay) * k1); g.stroke();
      if (k2 > 0) { g.beginPath(); g.moveTo(bx, ay + 8); g.lineTo(bx + (ax - bx) * k2, ay + 8 + (by - ay - 8) * k2); g.stroke(); }
    }
    return "P" + Math.round(p * 12);
  },
  etiqueta(g, t, e) { // preco novo numa etiqueta que entra com pop
    const k = pop((t - e.de) / 0.3);
    g.font = `bold ${e.tam || 112}px "U-forte"`; const tw = g.measureText(e.texto).width;
    const w = tw + 70, h = (e.tam || 112) * 1.35;
    g.save(); g.translate(e.x + w / 2, e.y - h / 2 + 22); g.rotate(-0.035); g.scale(k, k);
    sombra(g, 22, 0.35); g.fillStyle = ROSA; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 30); g.fill(); semSombra(g);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e.texto, 0, 6); g.restore();
    return "E" + Math.round(k * 100);
  },
  selo(g, t, e) { // selo da marca no canto superior direito, desliza da direita
    const dx = (1 - facil((t - e.de) / 0.35)) * 320, w = 250, h = 132, x = W - w - 36 + dx, y = e.y || 64;
    sombra(g, 18, 0.35); g.fillStyle = PRETO; g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill(); semSombra(g);
    g.strokeStyle = ROSA; g.lineWidth = 4; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 20); g.stroke();
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#fff"; g.font = `bold 58px "U-forte"`; g.fillText("BLACK", x + w / 2, y + 66);
    g.fillStyle = ROSA; g.font = `bold 31px "U-forte"`; g.fillText("MAGNÉTICA", x + w / 2, y + 106);
    return "S" + Math.round(dx);
  },
  grade(g, t, e) { // cards dentro da faixa do bloco, pipocando um a um
    const b = noBloco(t), [fx, fy, fw, fh] = [0, b.faixaY, W, b.faixaH];
    const col = e.colunas || 5, lin = Math.ceil(e.cards.length / col), pad = 14;
    const cw = (fw - pad * (col + 1)) / col, ch = (fh - pad * (lin + 1)) / lin;
    const chave = [];
    e.cards.forEach((c, i) => {
      const k = pop((t - e.de - i * (e.passo || 0.07)) / 0.25); if (t < e.de + i * (e.passo || 0.07)) return;
      const x = fx + pad + (i % col) * (cw + pad), y = fy + pad + Math.floor(i / col) * (ch + pad);
      g.save(); g.translate(x + cw / 2, y + ch / 2); g.scale(k, k); card(g, CARDS[c], -cw / 2, -ch / 2, cw, ch); g.restore();
      chave.push(Math.round(k * 50));
    });
    return "G" + chave.join(",");
  },
  emoji(g, t, e) { // emojis por cima da legenda, somem com fade
    const a = Math.min(facil((t - e.de) / 0.2), Math.min(1, (e.ate - t) / 0.3)); g.globalAlpha = a;
    g.font = `${e.tam || 78}px "U-emoji"`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(e.texto, W / 2, e.y); return "M" + Math.round(a * 10);
  },
  cardLado(g, t, e) { // card de produto flutuando num canto (sequencia de cards trocando)
    const i = Math.min(e.cards.length - 1, Math.floor((t - e.de) / ((e.ate - e.de) / e.cards.length)));
    const t0 = e.de + i * ((e.ate - e.de) / e.cards.length), k = pop((t - t0) / 0.25), sai = Math.min(1, (e.ate - t) / 0.12);
    const w = e.w || 300, h = w * 1.33;
    g.globalAlpha = sai; g.save(); g.translate(e.x + w / 2, e.y + h / 2); g.rotate(e.rot ?? -0.05); g.scale(k, k);
    sombra(g, 30, 0.45); g.fillStyle = "#fff"; g.beginPath(); g.roundRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 26); g.fill(); semSombra(g);
    card(g, CARDS[e.cards[i]], -w / 2, -h / 2, w, h); g.restore();
    return "C" + i + ":" + Math.round(k * 100) + ":" + Math.round(sai * 10);
  },
};

const TELA = createCanvas(W, H);
function overlay(t) {
  const g = TELA.getContext("2d"), chave = [];
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  for (const e of R.elementos) {
    const ate = e.ate ?? TOTAL; if (t < e.de || t >= ate) continue;
    g.save(); const k = desenhar[e.tipo](g, t, { ...e, ate }); g.restore(); if (k != null) chave.push(k);
  }
  g.save(); const k = legenda(g, t); g.restore(); if (k) chave.push(k);
  return chave.join(";");
}

// ---------- base: pessoa (zoom/recorte) ou bloco preto com faixa de video ----------
const cenas = [];
const marcos = [...new Set([0, ...R.zooms.map(z => z.de), ...(R.blocos || []).flatMap(b => [b.de, b.ate, ...(b.videos || []).map(v => v.de)]), TOTAL])]
  .map(t => Math.min(q(t), NQ)).filter((f, i, a) => a.indexOf(f) === i).sort((a, b) => a - b);
for (let i = 0; i < marcos.length - 1; i++) {
  const f0 = marcos[i], f1 = marcos[i + 1], t = f0 / FPS, b = noBloco(t + 0.001);
  if (b) cenas.push({ f0, f1, b, v: (b.videos || []).filter(v => v.de <= t + 0.001).at(-1) });
  else cenas.push({ f0, f1, z: R.zooms.filter(z => z.de <= t + 0.001).at(-1) });
}
const filtroPessoa = z => [HDR ? HDR_PARA_SDR : null,
  `scale=${Math.round(W * z.zoom)}:${Math.round(H * z.zoom)}:force_original_aspect_ratio=increase`,
  `crop=${W}:${H}:(iw-${W})*${z.ancoraX ?? 0.5}:(ih-${H})*${z.ancoraY ?? 0.3}`, `fps=${FPS}`, "setsar=1", "format=yuv420p"].filter(Boolean).join(",");
function clipe(c, out, quadros, ss) {
  const n = quadros ?? (c.f1 - c.f0), inicio = ss ?? c.f0 / FPS;
  if (!c.b) return ffmpeg(["-ss", inicio.toFixed(4), "-i", SRC, "-an", "-frames:v", String(n), "-vf", filtroPessoa(c.z), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out]);
  const fundo = ["-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:r=${FPS}`];
  if (!c.v?.arquivo) return ffmpeg([...fundo, "-frames:v", String(n), "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out]);
  const arq = path.join(RAIZ, c.v.arquivo), off = (c.v.ss || 0) + (inicio - c.v.de);
  ffmpeg([...fundo, "-ss", off.toFixed(4), "-i", arq, "-frames:v", String(n), "-filter_complex",
    `[1:v]${hdr(arq) ? HDR_PARA_SDR + "," : ""}scale=${W}:-2,crop=${W}:${c.b.faixaH}:0:${c.v.cropY},fps=${FPS},setsar=1[f];[0:v][f]overlay=0:${c.b.faixaY}:shortest=1,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out]);
}

if (PREVIA) {
  const tempos = (R.previa || []).filter(t => t < TOTAL);
  const qs = tempos.map((t, i) => {
    const c = cenas.filter(c => c.f0 <= q(t)).at(-1), base = path.join(TMP, `pb${i}.mp4`), ov = path.join(TMP, `po${i}.png`), out = path.join(TMP, `pq${i}.png`);
    clipe(c, base, 1, t); overlay(t); fs.writeFileSync(ov, TELA.toBuffer("image/png"));
    ffmpeg(["-i", base, "-i", ov, "-frames:v", "1", "-filter_complex", `[0:v][1:v]overlay=0:0,scale=270:-2,drawtext=text='${t.toFixed(1)}s':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black`, out]);
    return out;
  });
  const col = 6, lin = Math.ceil(qs.length / col); while (qs.length < col * lin) qs.push(qs.at(-1));
  const saida = path.join(SAIDA, `${R.nome}_previa.jpg`);
  ffmpeg([...qs.flatMap(x => ["-i", x]), "-filter_complex", `${qs.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${qs.length}:layout=${qs.map((_, i) => `${(i % col) * 270}_${Math.floor(i / col) * 480}`).join("|")}`, saida]);
  fs.rmSync(TMP, { recursive: true, force: true }); console.log("previa:", saida); process.exit(0);
}

// 1) camada de texto/graficos (so grava PNG quando muda)
let ult = null, lista = [], n = 0;
for (let f = 0; f < NQ; f++) {
  const chave = overlay(f / FPS);
  if (ult && chave === ult.chave) { ult.n++; continue; }
  const arq = path.join(TMP, `o${String(n++).padStart(5, "0")}.png`); fs.writeFileSync(arq, TELA.toBuffer("image/png"));
  ult = { chave, arq, n: 1 }; lista.push(ult);
}
fs.writeFileSync(path.join(TMP, "ov.txt"), lista.map(o => `file '${o.arq.replace(/\\/g, "/")}'\nduration ${(o.n / FPS).toFixed(6)}`).join("\n") + `\nfile '${lista.at(-1).arq.replace(/\\/g, "/")}'\n`);
console.log(`camada: ${n} desenhos em ${NQ} quadros`);
// 2) base
const clipes = cenas.map((c, i) => { const out = path.join(TMP, `c${String(i).padStart(2, "0")}.mp4`); clipe(c, out); console.log(`cena ${i + 1}/${cenas.length} ${(c.f0 / FPS).toFixed(2)}-${(c.f1 / FPS).toFixed(2)} ${c.b ? "bloco" : "pessoa " + c.z.zoom}`); return out; });
fs.writeFileSync(path.join(TMP, "base.txt"), clipes.map(c => `file '${c.replace(/\\/g, "/")}'`).join("\n"));
// 3) junta + voz original
const final = path.join(SAIDA, `${R.nome}.mp4`);
ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(TMP, "base.txt"), "-f", "concat", "-safe", "0", "-i", path.join(TMP, "ov.txt"), "-t", TOTAL.toFixed(3), "-i", SRC,
  "-filter_complex", "[1:v]fps=30,format=rgba[ov];[0:v][ov]overlay=0:0:eof_action=repeat,format=yuv420p[v]",
  "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high",
  "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-map_metadata", "-1", "-shortest", final]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("pronto:", final, TOTAL + "s");
