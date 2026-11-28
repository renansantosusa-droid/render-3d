// Pos-edicao no estilo "GP Multimedia" (grupo Modelagem 03/11/2026 11:52,
// dados/whatsapp-claude/modelagem/2026-11-03_11h52_D70154/ESTILO.md), adaptado pras cores da Vee:
// - destaques em 2 tamanhos (palavra pequena em cima + palavra GIGANTE embaixo), entram com desfoque de movimento
//   + escala e saem dissolvendo; opcional "recheado" (gradiente rosa dentro da letra) e "atras" (texto atras da Vee,
//   com recorte da pessoa quadro a quadro pelo rembg)
// - legenda de UMA palavra por vez, branca, na altura do peito, quando nao tem destaque
// - "pancada" de zoom em cada corte e em cada destaque; trechos em preto e branco; flash branco
// - contador rolando (+300 CIDADES), coracoes de live subindo, pilula de vidro com o @
// - sons: whoosh em cada destaque, tick no contador, pop nos coracoes, riser antes do CTA
// Uso: node estilo-gp.mjs estilo.json   (base = video ja montado pelo montar.mjs, SEM textos)
import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";

const AQUI = import.meta.dirname, RAIZ = path.resolve(AQUI, "../..");
const LAYOUT = path.join(RAIZ, "ferramentas/layout-post-instagram");
const NO_PC = fs.existsSync(LAYOUT);
const require = createRequire(NO_PC ? path.join(LAYOUT, "package.json") : import.meta.filename);
const { createCanvas, GlobalFonts, loadImage, ImageData } = require("@napi-rs/canvas");
const FFMPEG = process.env.FFMPEG || path.join(LAYOUT, "node_modules/ffmpeg-static/ffmpeg.exe");
GlobalFonts.registerFromPath(path.join(AQUI, "fonts/Montserrat-Black.ttf"), "GP-black");
GlobalFonts.registerFromPath(path.join(AQUI, "fonts/Montserrat-SemiBold.ttf"), "GP-semi");
if (process.env.VC_EMOJI || NO_PC) GlobalFonts.registerFromPath(process.env.VC_EMOJI || path.join(LAYOUT, "fonts/NotoColorEmoji.ttf"), "GP-emoji");

const W = 1080, H = 1920, FPS = 30;
const COR = { rosa: "#FF2E88", rosaClaro: "#FF7AB6", branco: "#FFFFFF", preto: "#0B0B0D", creme: "#FFD6E7" };
const E = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const SO = process.argv.find(a => a.startsWith("--quadros="))?.slice(10).split(",").map(Number); // teste: so esses segundos
const BASE = path.join(RAIZ, E.base), AUDIO = path.join(RAIZ, E.audio);
const SAIDA = path.join(RAIZ, E.saida);
const TMP = path.join(path.dirname(SAIDA), `.tmp-gp-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

const ff = args => { const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); if (r.status !== 0) throw new Error("ffmpeg falhou: " + args.join(" ")); };
const dur = (() => { const r = spawnSync(FFMPEG, ["-hide_banner", "-i", BASE], { encoding: "utf8" }); const m = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3]; })();
const NQ = Math.round(dur * FPS);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 2);

// ---------- linha do tempo ----------
const destaques = (E.destaques || []).map(d => ({ ...d, tam: d.tam || 190 }));
// contador: um objeto ou uma lista ({de, ate, valor, prefixo, rotulo, y, rolar})
const contadores = [E.contadores || [], E.contador ? [E.contador] : []].flat();
const ativoTexto = t => destaques.some(d => t >= d.de && t < d.ate) || contadores.some(c => t >= c.de && t < c.ate);
// prints (depoimentos): {de, ate, img, x, y, w, rot} -> imagem com cantos arredondados que pipoca na tela
const prints = await Promise.all((E.prints || []).map(async p => ({ ...p, im: await loadImage(path.join(RAIZ, p.img)) })));
// legenda: palavras do whisper ({w, de, ate}); cada uma fica ate a proxima (max 0,7 s)
const palavras = (E.palavras || []).map((p, i, a) => ({ ...p, fim: Math.min(a[i + 1]?.de ?? p.ate + 0.3, p.de + 0.7) }));
const pancadas = [...(E.cortes || []), ...destaques.map(d => d.de), ...contadores.map(c => c.de)].sort((a, b) => a - b);

// ---------- recorte da pessoa (texto atras) ----------
const quadrosAtras = new Set();
for (const d of destaques.filter(d => d.efeito === "atras"))
  for (let n = Math.floor(d.de * FPS); n <= Math.ceil(d.ate * FPS); n++) if (!SO || SO.some(s => Math.round(s * FPS) === n)) quadrosAtras.add(n);
const MASC = path.join(TMP, "masc");
if (quadrosAtras.size) {
  fs.mkdirSync(path.join(TMP, "qa"), { recursive: true }); fs.mkdirSync(MASC, { recursive: true });
  // extrai em blocos continuos, ja pequeno (540x960) pra mascara sair rapida
  const lista = [...quadrosAtras].sort((a, b) => a - b), blocos = [];
  for (const n of lista) { const b = blocos.at(-1); if (b && n === b[1] + 1) b[1] = n; else blocos.push([n, n]); }
  for (const [a, b] of blocos) ff(["-ss", (a / FPS).toFixed(4), "-i", BASE, "-frames:v", String(b - a + 1), "-vf", "scale=540:960", "-start_number", String(a), path.join(TMP, "qa/%06d.png")]);
  const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const r = spawnSync(py, [path.join(AQUI, "mascara.py"), path.join(TMP, "qa"), MASC], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("mascara.py falhou");
  console.log("mascaras:", quadrosAtras.size);
}

// ---------- desenho ----------
const cv = createCanvas(W, H), g = cv.getContext("2d");
const quadroCv = createCanvas(W, H), qg = quadroCv.getContext("2d");
const pessoaCv = createCanvas(W, H), pg = pessoaCv.getContext("2d");
const avatar = E.avatar ? await loadImage(path.join(RAIZ, E.avatar)) : null;

function zoomEm(t) {
  let z = 1;
  for (const p of pancadas) { const dt = t - p; if (dt >= 0 && dt < 0.35) z = Math.max(z, 1 + 0.075 * (1 - easeOut(dt / 0.35))); }
  return z;
}
function pbEm(t) {
  let f = 0;
  for (const [a, b] of E.pb || []) if (t >= a - 0.2 && t < b + 0.2) f = Math.max(f, Math.min(clamp((t - a + 0.2) / 0.2), clamp((b + 0.2 - t) / 0.2)));
  return f;
}
function desenhaBase(dest, ctx, t) {
  const z = zoomEm(t), w = W * z, h = H * z;
  ctx.drawImage(dest, (W - w) / 2, (H - h) / 2, w, h);
}
function fonteQueCabe(texto, fam, tam, largura) {
  g.font = `${tam}px ${fam}`;
  const w = g.measureText(texto).width;
  return w > largura ? Math.floor(tam * largura / w) : tam;
}
function preenchimento(ctx, d, y, tam) {
  if (d.efeito !== "recheado") return COR[d.cor || "rosa"] || d.cor;
  const gr = ctx.createLinearGradient(0, y - tam, W, y + tam * 0.2);
  gr.addColorStop(0, "#FF2E88"); gr.addColorStop(0.5, "#FFD6E7"); gr.addColorStop(1, "#FF7AB6");
  return gr;
}
// desenha um destaque inteiro (linha pequena + linhas gigantes) com a animacao do tempo t
function desenhaDestaque(ctx, d, t) {
  const p = t - d.de, q = d.ate - t;
  const ent = easeOut(p / 0.22), sai = clamp(q / 0.16);
  const alfa = ent * sai;
  if (alfa <= 0) return;
  const linhas = d.grande.split("/").map(s => s.trim());
  const yBase = (d.y ?? 0.62) * H;
  // tamanho gigante: o que couber em 92% da largura, igual pra todas as linhas
  let tam = d.tam;
  for (const l of linhas) tam = Math.min(tam, fonteQueCabe(l, "GP-black", d.tam, W * 0.92));
  const tamPeq = Math.max(52, Math.round(tam * 0.34));
  const alt = tam * 0.92;
  const total = (d.peq ? tamPeq * 1.1 : 0) + alt * linhas.length;
  let y = yBase - total / 2;
  const dy = (1 - ent) * 70, esc = 1 + (1 - ent) * 0.14 + (1 - sai) * 0.06;
  // letra por letra (opcional): revela os caracteres na 1a metade do tempo
  const nLet = d.digitar ? Math.ceil(clamp(p / Math.min(0.6, (d.ate - d.de) * 0.5)) * linhas.join("").length) : Infinity;
  const fantasmas = ent < 1 ? [[3, 0.12], [2, 0.18], [1, 0.25]] : [];
  const passo = (k, a) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, yBase + dy + k * 22); ctx.scale(esc, esc); ctx.translate(-W / 2, -yBase);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.shadowColor = d.cor === "preto" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.38)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 4;
    let yy = y, usados = 0;
    if (d.peq) {
      ctx.font = `${tamPeq}px GP-semi`; ctx.fillStyle = COR[d.corPeq || "branco"];
      yy += tamPeq; ctx.fillText(d.peq, W / 2, yy); yy += tamPeq * 0.1;
    }
    ctx.font = `${tam}px GP-black`;
    for (const l of linhas) {
      yy += alt;
      const vis = l.slice(0, Math.max(0, nLet - usados)); usados += l.length;
      ctx.fillStyle = preenchimento(ctx, d, yy, tam);
      ctx.fillText(vis, W / 2, yy);
    }
    ctx.restore();
  };
  for (const [k, a] of fantasmas) passo(k, alfa * a);
  passo(0, alfa);
}
function desenhaLegenda(ctx, t) {
  if (ativoTexto(t)) return;
  const p = palavras.find(p => t >= p.de && t < p.fim);
  if (!p) return;
  const ent = easeOut((t - p.de) / 0.08);
  ctx.save();
  ctx.globalAlpha = ent;
  ctx.font = `62px GP-semi`; ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 3;
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineJoin = "round";
  ctx.strokeText(p.w, W / 2, (E.yLegenda ?? 0.6) * H + (1 - ent) * 10);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(p.w, W / 2, (E.yLegenda ?? 0.6) * H + (1 - ent) * 10);
  ctx.restore();
}
const milhar = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function desenhaContador(ctx, t) {
  for (const c of contadores) {
    if (t < c.de || t >= c.ate) continue;
    const p = t - c.de, sai = clamp((c.ate - t) / 0.16);
    const v = Math.round(c.valor * easeOut(p / (c.rolar || 1.1)));
    const ent = easeOut(p / 0.2);
    ctx.save();
    ctx.globalAlpha = ent * sai;
    ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 26;
    const y = (c.y ?? 0.6) * H;
    // tamanho pelo numero FINAL (nao fica pulando de tamanho enquanto rola)
    const tam = fonteQueCabe(`${c.prefixo || ""}${milhar(c.valor)}`, "GP-black", c.tam || 300, W * 0.92);
    ctx.font = `${tam}px GP-black`; ctx.fillStyle = COR.rosa;
    ctx.fillText(`${c.prefixo || ""}${milhar(v)}`, W / 2, y);
    const tr = fonteQueCabe(c.rotulo, "GP-black", 110, W * 0.9);
    ctx.font = `${tr}px GP-black`; ctx.fillStyle = COR.branco;
    ctx.fillText(c.rotulo, W / 2, y + tr * 1.18);
    ctx.restore();
  }
}
function desenhaPrints(ctx, t) {
  for (const p of prints) {
    if (t < p.de || t >= p.ate) continue;
    const ent = easeOut((t - p.de) / 0.25), sai = clamp((p.ate - t) / 0.2);
    const esc = (ent < 1 ? 0.6 + 0.48 * ent : 1.08 - 0.08 * clamp((t - p.de - 0.25) / 0.15)) * (1 + (1 - sai) * 0.05);
    const w = (p.w ?? 0.8) * W, h = w * p.im.height / p.im.width;
    ctx.save();
    ctx.globalAlpha = ent * sai;
    ctx.translate((p.x ?? 0.5) * W, (p.y ?? 0.35) * H); ctx.rotate(((p.rot ?? 0) * Math.PI) / 180); ctx.scale(esc, esc);
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    arredondado(ctx, -w / 2, -h / 2, w, h, 28); ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.shadowColor = "transparent";
    arredondado(ctx, -w / 2, -h / 2, w, h, 28); ctx.clip();
    ctx.drawImage(p.im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
function coracao(ctx, x, y, r, alfa) {
  ctx.save(); ctx.globalAlpha = alfa;
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#F5243C"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#FFFFFF";
  const s = r * 0.5; ctx.beginPath();
  ctx.moveTo(x, y + s * 0.75);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.55, y - s * 1.25, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.55, y - s * 1.25, x + s * 1.4, y - s * 0.2, x, y + s * 0.75);
  ctx.fill(); ctx.restore();
}
// coracoes deterministas: um a cada 0,22 s dentro de cada intervalo, sobem 600 px em 1,3 s
const rnd = s => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
const coracoes = [];
for (const [a, b] of E.coracoes || []) for (let t = a, i = 0; t < b; t += 0.22, i++) {
  const lado = rnd(t + i) < 0.5 ? 0 : 1;
  coracoes.push({ t0: t, x: lado ? W * (0.72 + rnd(t * 3) * 0.2) : W * (0.08 + rnd(t * 5) * 0.2), r: 34 + rnd(t * 7) * 46 });
}
function desenhaCoracoes(ctx, t) {
  for (const c of coracoes) {
    const p = (t - c.t0) / 1.3; if (p < 0 || p > 1) continue;
    const esc = p < 0.12 ? easeOut(p / 0.12) * 1.15 : 1.15 - 0.15 * clamp((p - 0.12) / 0.1);
    coracao(ctx, c.x + Math.sin(p * 6 + c.t0) * 25, H * 0.86 - p * 600, c.r * esc, 1 - easeIn((p - 0.6) / 0.4));
  }
}
function arredondado(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function desenhaPilula(ctx, pl, t) {
  if (t < pl.de || t >= pl.ate) return;
  const ent = easeOut((t - pl.de) / 0.3), sai = clamp((pl.ate - t) / 0.2);
  const w = 760, h = 150, x = (W - w) / 2 + (1 - ent) * -200, y = (pl.y ?? 0.18) * H + Math.sin(t * 2.2) * 6;
  ctx.save(); ctx.globalAlpha = ent * sai;
  // vidro: o pedaco do quadro desfocado dentro da pilula + vel branco + contorno
  ctx.save(); arredondado(ctx, x, y, w, h, h / 2); ctx.clip();
  ctx.filter = "blur(18px)"; ctx.drawImage(cv, 0, 0); ctx.filter = "none";
  ctx.fillStyle = "rgba(255,255,255,0.24)"; ctx.fillRect(x, y, w, h);
  ctx.restore();
  arredondado(ctx, x, y, w, h, h / 2); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke();
  if (avatar) { ctx.save(); ctx.beginPath(); ctx.arc(x + 75, y + h / 2, 52, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, x + 23, y + h / 2 - 52, 104, 104); ctx.restore(); }
  ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF"; ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 10;
  ctx.font = "46px GP-black"; ctx.fillText(pl.texto, x + 148, y + 70);
  if (pl.sub) { ctx.font = "34px GP-semi"; ctx.fillText(pl.sub, x + 148, y + 116); }
  if (pl.botao) {
    ctx.shadowBlur = 0; const bw = 170, bx = x + w - bw - 22;
    arredondado(ctx, bx, y + 34, bw, h - 68, (h - 68) / 2); ctx.fillStyle = COR.rosa; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.font = "38px GP-black"; ctx.textAlign = "center"; ctx.fillText(pl.botao, bx + bw / 2, y + h / 2 + 14);
  }
  ctx.restore();
}
function desenhaFlash(ctx, t) {
  for (const f of E.flash || []) {
    const dt = t - f; if (dt < -0.08 || dt > 0.3) continue;
    const a = dt < 0 ? (dt + 0.08) / 0.08 : 1 - easeOut(dt / 0.3);
    const gr = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, H * 0.8);
    gr.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(1, `rgba(255,255,255,${0.55 * a})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
}

async function quadro(n, buf) {
  const t = n / FPS;
  const f = pbEm(t);
  if (f > 0) for (let i = 0; i < buf.length; i += 4) {
    const l = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
    buf[i] += (l - buf[i]) * f; buf[i + 1] += (l - buf[i + 1]) * f; buf[i + 2] += (l - buf[i + 2]) * f;
  }
  qg.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length), W, H), 0, 0);
  g.clearRect(0, 0, W, H);
  desenhaBase(quadroCv, g, t);
  const atras = destaques.filter(d => d.efeito === "atras" && t >= d.de && t < d.ate);
  for (const d of atras) desenhaDestaque(g, d, t);
  if (atras.length && quadrosAtras.has(n)) {
    const m = path.join(MASC, String(n).padStart(6, "0") + ".png");
    if (fs.existsSync(m)) {
      pg.globalCompositeOperation = "source-over"; pg.clearRect(0, 0, W, H);
      desenhaBase(quadroCv, pg, t);
      pg.globalCompositeOperation = "destination-in";
      const z = zoomEm(t), w = W * z, h = H * z;
      pg.drawImage(await loadImage(m), (W - w) / 2, (H - h) / 2, w, h);
      pg.globalCompositeOperation = "source-over";
      g.drawImage(pessoaCv, 0, 0);
    }
  }
  for (const d of destaques) if (d.efeito !== "atras" && t >= d.de && t < d.ate) desenhaDestaque(g, d, t);
  desenhaPrints(g, t);
  desenhaContador(g, t);
  desenhaLegenda(g, t);
  for (const pl of E.pilulas || []) desenhaPilula(g, pl, t);
  desenhaCoracoes(g, t);
  desenhaFlash(g, t);
  return Buffer.from(g.getImageData(0, 0, W, H).data.buffer);
}

// ---------- teste rapido: so alguns quadros, vira uma folha JPG ----------
if (SO) {
  const outs = [];
  for (const s of SO) {
    const n = Math.round(s * FPS), raw = path.join(TMP, `r${n}.raw`);
    ff(["-ss", (n / FPS).toFixed(4), "-i", BASE, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", raw]);
    const o = await quadro(n, fs.readFileSync(raw));
    const png = path.join(TMP, `s${n}.png`);
    const c2 = createCanvas(W, H); c2.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(o), W, H), 0, 0);
    fs.writeFileSync(png, c2.toBuffer("image/png")); outs.push(png);
  }
  const folha = SAIDA.replace(/\.mp4$/, "_teste.jpg");
  ff([...outs.flatMap(o => ["-i", o]), "-filter_complex", outs.map((_, i) => `[${i}:v]scale=360:-2[s${i}]`).join(";") + ";" + outs.map((_, i) => `[s${i}]`).join("") + `hstack=${outs.length}`, folha]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("teste:", folha); process.exit(0);
}

// ---------- video: decodifica a base, desenha, codifica ----------
const soVideo = path.join(TMP, "video.mp4");
const dec = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", BASE, "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
const enc = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p", soVideo], { stdio: ["pipe", "inherit", "inherit"] });
const TAMQ = W * H * 4;
let resto = Buffer.alloc(0), n = 0;
const fimEnc = new Promise(r => enc.on("close", r));
for await (const pedaco of dec.stdout) {
  resto = resto.length ? Buffer.concat([resto, pedaco]) : pedaco;
  while (resto.length >= TAMQ) {
    const buf = Buffer.from(resto.subarray(0, TAMQ)); resto = resto.subarray(TAMQ);
    const out = await quadro(n++, buf);
    if (!enc.stdin.write(out)) await new Promise(r => enc.stdin.once("drain", r));
    if (n % 300 === 0) console.log(`quadro ${n}/${NQ}`);
  }
}
enc.stdin.end(); await fimEnc;

// ---------- sons ----------
const S = path.join(TMP, "sons"); fs.mkdirSync(S, { recursive: true });
ff(["-f", "lavfi", "-i", "anoisesrc=d=0.42:c=pink:a=0.6,highpass=f=500,lowpass=f=6000,afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.28:d=0.14", "-ar", "44100", path.join(S, "whoosh.wav")]);
ff(["-f", "lavfi", "-i", "sine=f=2600:d=0.03,afade=t=out:d=0.03", "-ar", "44100", path.join(S, "tick.wav")]);
ff(["-f", "lavfi", "-i", "sine=f=700:d=0.09,afade=t=out:d=0.09", "-ar", "44100", path.join(S, "pop.wav")]);
ff(["-f", "lavfi", "-i", "anoisesrc=d=1.4:c=white:a=0.35,highpass=f=1200,afade=t=in:d=1.3:curve=exp,afade=t=out:st=1.3:d=0.1", "-ar", "44100", path.join(S, "riser.wav")]);
const eventos = [];
for (const d of destaques) eventos.push(["whoosh", d.de - 0.08, 0.55]);
for (const c of contadores) for (let t = 0; t < (c.rolar || 1.1); t += 0.07) eventos.push(["tick", c.de + t, 0.35]);
for (const p of E.prints || []) eventos.push(["pop", p.de, 0.4]);
for (const c of coracoes) eventos.push(["pop", c.t0 + 0.02, 0.18]);
if (E.riser) eventos.push(["riser", E.riser - 1.4, 0.4]);
const ins = ["-i", AUDIO], fc = [];
eventos.filter(e => e[1] >= 0).forEach(([s, t, v], i) => { ins.push("-i", path.join(S, `${s}.wav`)); fc.push(`[${i + 1}:a]adelay=${Math.round(t * 1000)}:all=1,volume=${v}[e${i}]`); });
const nE = fc.length;
fc.push(`[0:a]aresample=44100[voz]`);
fc.push(`[voz]${Array.from({ length: nE }, (_, i) => `[e${i}]`).join("")}amix=inputs=${nE + 1}:normalize=0:duration=first[a]`);
const mix = path.join(TMP, "audio.m4a");
ff([...ins, "-filter_complex", fc.join(";"), "-map", "[a]", "-c:a", "aac", "-b:a", "160k", mix]);
ff(["-i", soVideo, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "apad", "-t", dur.toFixed(2), "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-map_metadata", "-1", SAIDA]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("pronto:", path.relative(RAIZ, SAIDA), `${dur.toFixed(1)}s, ${n} quadros`);
