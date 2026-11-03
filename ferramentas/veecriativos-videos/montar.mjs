// Monta um video da Veecriativos a partir de takes brutos do iPhone (HDR -> SDR),
// com texto no estilo "classico" de Reels: uma faixa branca por linha (efeito degrau),
// cantos quase retos, letra preta Inter SemiBold. Sai sem musica (o Renan escolhe no app).
// Uso: node montar.mjs roteiro.json [--previa]
//   --previa: gera so um JPG com quadros do video + textos, pra conferir se nao cobre rosto/maquina
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const LAYOUT = path.join(RAIZ, "ferramentas/layout-post-instagram");
// no GitHub (enviar-gh.mjs) nao existe o layout: canvas vem do node_modules da raiz, ffmpeg e emoji por variavel
const NO_PC = fs.existsSync(LAYOUT);
const require = createRequire(NO_PC ? path.join(LAYOUT, "package.json") : import.meta.filename);
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const FFMPEG = process.env.FFMPEG || path.join(LAYOUT, "node_modules/ffmpeg-static/ffmpeg.exe");

GlobalFonts.registerFromPath(path.join(import.meta.dirname, "fonts/Inter-SemiBold.ttf"), "VC-texto");
GlobalFonts.registerFromPath(process.env.VC_EMOJI || path.join(LAYOUT, "fonts/NotoColorEmoji.ttf"), "VC-emoji");

const W = 1080, H = 1920, FPS = 30;
// iPhone grava em HLG (HDR); sem converter, o video fica lavado no Instagram
const HDR_PARA_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";

const roteiro = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const PREVIA = process.argv.includes("--previa");
const BRUTOS = path.join(RAIZ, roteiro.pasta || "dados/veecriativos/brutos");
const SAIDA = path.join(RAIZ, roteiro.saida || "dados/veecriativos/videos-novos");
const TMP = path.join(SAIDA, `.tmp-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg falhou");
}

function ehHdr(arquivo) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", arquivo], { encoding: "utf8" });
  return /arib-std-b67|smpte2084/.test(r.stderr);
}

// Uma faixa branca por linha, do tamanho da linha, empilhadas sem folga: forma o "degrau"
function textoPng(texto, arquivo, { y = 0.3, tamanho = 50, largura = 0.84 } = {}) {
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.font = `${tamanho}px "VC-texto", "VC-emoji"`;
  g.textAlign = "center"; g.textBaseline = "middle";
  const maxLarg = W * largura, linhas = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const p of paragrafo.split(" ")) {
      const teste = linha ? `${linha} ${p}` : p;
      if (g.measureText(teste).width > maxLarg && linha) { linhas.push(linha); linha = p; } else linha = teste;
    }
    linhas.push(linha);
  }
  const alt = Math.round(tamanho * 1.28), padX = Math.round(tamanho * 0.42), raio = 7;
  const y0 = Math.round(H * y);
  g.fillStyle = "#ffffff";
  linhas.forEach((l, i) => {
    const larg = g.measureText(l).width + padX * 2;
    g.beginPath(); g.roundRect((W - larg) / 2, y0 + i * alt, larg, alt + 1, raio); g.fill();
  });
  g.fillStyle = "#000000";
  linhas.forEach((l, i) => g.fillText(l, W / 2, y0 + i * alt + alt / 2 + tamanho * 0.04));
  fs.writeFileSync(arquivo, c.toBuffer("image/png"));
}

// Balao de "Responder ao comentario" do Instagram (gancho do hater/fa no 1o quadro)
function comentarioPng(texto, arquivo, { y = 0.3, usuario = "anônima", tamanho = 46 } = {}) {
  const c = createCanvas(W, H), g = c.getContext("2d");
  const pad = 34, avatar = 70, maxLarg = W * 0.86 - pad * 3 - avatar;
  const topo = `Responder ao comentário de ${usuario}`, tamTopo = Math.round(tamanho * 0.62);
  g.font = `${tamanho}px "VC-texto", "VC-emoji"`;
  const linhas = [];
  let linha = "";
  for (const p of texto.split(" ")) {
    const teste = linha ? `${linha} ${p}` : p;
    if (g.measureText(teste).width > maxLarg && linha) { linhas.push(linha); linha = p; } else linha = teste;
  }
  linhas.push(linha);
  const largTexto = Math.max(...linhas.map(l => g.measureText(l).width), (g.font = `${tamTopo}px "VC-texto"`, g.measureText(topo).width));
  const altLinha = Math.round(tamanho * 1.25);
  const larg = pad * 3 + avatar + largTexto, alt = pad * 2 + tamTopo * 1.5 + linhas.length * altLinha;
  const x0 = (W - larg) / 2, y0 = Math.round(H * y);
  g.shadowColor = "rgba(0,0,0,0.25)"; g.shadowBlur = 24; g.shadowOffsetY = 6;
  g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(x0, y0, larg, alt, 30); g.fill();
  g.shadowColor = "transparent";
  const grad = g.createLinearGradient(x0 + pad, y0 + pad, x0 + pad + avatar, y0 + pad + avatar);
  grad.addColorStop(0, "#c7c7cc"); grad.addColorStop(1, "#8e8e93");
  g.fillStyle = grad; g.beginPath(); g.arc(x0 + pad + avatar / 2, y0 + pad + avatar / 2, avatar / 2, 0, Math.PI * 2); g.fill();
  const xt = x0 + pad * 2 + avatar;
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillStyle = "#737373"; g.font = `${tamTopo}px "VC-texto"`; g.fillText(topo, xt, y0 + pad);
  g.fillStyle = "#000000"; g.font = `${tamanho}px "VC-texto", "VC-emoji"`;
  linhas.forEach((l, i) => g.fillText(l, xt, y0 + pad + tamTopo * 1.5 + i * altLinha));
  fs.writeFileSync(arquivo, c.toBuffer("image/png"));
}

function filtroVideo(src, t) {
  const zoom = t.zoom || 1;
  return [
    ehHdr(src) ? HDR_PARA_SDR : null,
    `scale=${Math.round(W * zoom)}:${Math.round(H * zoom)}:force_original_aspect_ratio=increase`,
    // ancoraY: 0 = corta so embaixo (ex.: tirar os pes), 0.5 = centro, 1 = corta so em cima
    `crop=${W}:${H}:(iw-${W})/2:(ih-${H})*${t.ancoraY ?? 0.5}`,
    t.velocidade ? `setpts=PTS/${t.velocidade}` : null,
    `fps=${FPS}`, "setsar=1", "format=yuv420p",
  ].filter(Boolean).join(",");
}

const total = roteiro.trechos.reduce((s, t) => s + t.duracao / (t.velocidade || 1), 0);
const textos = (roteiro.textos || []).map((t, i) => {
  const png = path.join(TMP, `t${i}.png`);
  (t.estilo === "comentario" ? comentarioPng : textoPng)(t.texto, png, t);
  return { png, de: t.de ?? 0, ate: t.ate ?? total };
});

if (PREVIA) {
  // 4 quadros ao longo do video (so funciona pra roteiro de 1 trecho, que e o caso do formato Titulo)
  const t = roteiro.trechos[0], src = path.join(BRUTOS, t.arquivo);
  const tempos = [0.3, total * 0.35, Math.min(Math.max(total * 0.62, 6), total - 0.8), total - 0.4];
  const quadros = tempos.map((tt, i) => {
    const q = path.join(TMP, `q${i}.png`);
    ffmpeg(["-ss", String(t.inicio + tt), "-i", src, "-frames:v", "1", "-vf", filtroVideo(src, t), q]);
    const ins = ["-i", q], fc = [];
    let atual = "[0:v]";
    textos.filter(x => tt >= x.de && tt <= x.ate).forEach((x, j) => {
      ins.push("-i", x.png);
      fc.push(`${atual}[${j + 1}:v]overlay=0:0[o${j}]`); atual = `[o${j}]`;
    });
    const out = path.join(TMP, `p${i}.png`);
    ffmpeg([...ins, ...(fc.length ? ["-filter_complex", fc.join(";") + `;${atual}scale=360:-2[f]`, "-map", "[f]"] : ["-vf", "scale=360:-2"]), out]);
    return out;
  });
  const saida = path.join(SAIDA, `${roteiro.nome}_previa.jpg`);
  ffmpeg([...quadros.flatMap(q => ["-i", q]), "-filter_complex", `hstack=${quadros.length}`, saida]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("previa:", path.relative(RAIZ, saida));
  process.exit(0);
}

// 1) cada trecho vira um clipe 1080x1920 30fps SDR
const clipes = roteiro.trechos.map((t, i) => {
  const src = path.join(BRUTOS, t.arquivo);
  const out = path.join(TMP, `c${String(i).padStart(2, "0")}.mp4`);
  ffmpeg(["-ss", String(t.inicio), "-t", String(t.duracao), "-i", src, "-an", "-vf", filtroVideo(src, t),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out]);
  console.log(`trecho ${i + 1}/${roteiro.trechos.length} ok (${t.arquivo} ${t.inicio}s +${t.duracao}s)`);
  return out;
});

// 2) junta e poe os textos; audio mudo pra musica ser escolhida no app
const ins = [], fc = [];
clipes.forEach(c => ins.push("-i", c));
fc.push(clipes.map((_, i) => `[${i}:v]`).join("") + `concat=n=${clipes.length}:v=1:a=0[v0]`);
textos.forEach((t, i) => {
  ins.push("-i", t.png);
  fc.push(`[v${i}][${clipes.length + i}:v]overlay=0:0:enable='between(t,${t.de},${t.ate})'[v${i + 1}]`);
});
// roteiro.audio (opcional, caminho a partir da raiz): fala/trilha por cima; sem ele fica mudo
// roteiro.audioInicio (opcional): de onde a trilha comeca; com ele vira musica de fundo (volume nivelado + fade)
if (roteiro.audio) ins.push(...(roteiro.audioInicio ? ["-ss", String(roteiro.audioInicio)] : []), "-t", String(total), "-i", path.join(RAIZ, roteiro.audio));
else ins.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");
let mapaAudio = `${clipes.length + textos.length}:a`;
if (roteiro.audio && roteiro.audioInicio) {
  fc.push(`[${mapaAudio}]loudnorm=I=-16:TP=-1.5,aresample=44100,afade=t=in:d=0.3,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[a]`);
  mapaAudio = "[a]";
}
const final = path.join(SAIDA, `${roteiro.nome}.mp4`);
ffmpeg([...ins, "-filter_complex", fc.join(";"), "-map", `[v${textos.length}]`, "-map", mapaAudio,
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-map_metadata", "-1", "-shortest", final]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("pronto:", path.relative(RAIZ, final), `${total.toFixed(1)}s`);
