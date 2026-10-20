// Biblioteca 2D detalhada (19/10/2026): cenários de apartamento, luz, personagens expressivos, celular e HUD.
// Uso: import { kit2d } from "/cena2d.js"; const K = kit2d(g, W, H);
export function kit2d(g, W = 1080, H = 1920) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  let rs = 11; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const rr = (x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
  const elip = (x, y, rx, ry, c, rot = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 6.283); g.fill(); };
  const lin = (x0, y0, x1, y1, c) => { const gr = g.createLinearGradient(x0, y0, x1, y1); c.forEach(([k, cor]) => gr.addColorStop(k, cor)); return gr; };
  const txt = (s, x, y, t, c, p = 700, a = "center", f = "Oswald") => { g.font = `${p} ${t}px ${f}`; g.textAlign = a; g.textBaseline = "middle"; g.fillStyle = c; g.fillText(s, x, y); };
  const glow = (x, y, r, cor, a = .5) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, cor.replace("A", a)); gr.addColorStop(1, cor.replace("A", 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const sombraChao = (x, y, w) => elip(x, y, w, w * .16, "rgba(0,0,0,.22)");
  function vinheta(a = .55) { const gr = g.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .5, H * .78); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function tinta(cor, a) { g.fillStyle = cor; g.globalAlpha = a; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  // câmera: zoom/pan lento (k = 0..1 da cena)
  function camera(k, { z0 = 1, z1 = 1.08, x0 = 0, x1 = 0, y0 = 0, y1 = 0, cx = W / 2, cy = H * .55 } = {}) { const e = ease(clamp(k, 0, 1)); const z = z0 + (z1 - z0) * e; g.translate(cx + (x0 + (x1 - x0) * e), cy + (y0 + (y1 - y0) * e)); g.scale(z, z); g.translate(-cx, -cy); }

  // ---------- ambiente ----------
  function parede(y0, y1, cor, cor2) { g.fillStyle = lin(0, y0, 0, y1, [[0, cor], [1, cor2]]); g.fillRect(0, y0, W, y1 - y0); for (let x = 0; x < W; x += 6) { g.fillStyle = `rgba(0,0,0,${.012 + (x * 7 % 13) / 1300})`; g.fillRect(x, y0, 3, y1 - y0); } }
  function rodape(y, cor = "#e9e3d8") { rect(0, y - 26, W, 26, cor); rect(0, y - 28, W, 3, "rgba(0,0,0,.08)"); }
  function pisoMadeira(y, cor = "#9a6c45", noite = 0) {
    rect(0, y, W, H - y, cor);
    const linhas = 14; for (let i = 0; i < linhas; i++) { const yy = y + Math.pow(i / linhas, 1.6) * (H - y); rect(0, yy, W, 2, "rgba(0,0,0,.18)"); const off = (i * 137) % 260; for (let x = -off; x < W; x += 260 + i * 6) rect(x, yy, 2, (H - y) / linhas, "rgba(0,0,0,.12)"); }
    g.fillStyle = lin(0, y, 0, H, [[0, "rgba(0,0,0,.25)"], [.3, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.2)"]]); g.fillRect(0, y, W, H - y);
    if (noite) tinta("#0a1030", .25 * noite);
  }
  function pisoAzulejo(y, cor = "#d8d4cc", cor2 = "#c8c2b6") { rect(0, y, W, H - y, cor); for (let i = 0; i < 10; i++) { const yy = y + Math.pow(i / 10, 1.5) * (H - y); rect(0, yy, W, 3, cor2); } for (let x = -400; x < W + 400; x += 140) { g.strokeStyle = cor2; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 + (x - W / 2) * .35, y); g.lineTo(x, H); g.stroke(); } }
  function tapete(x, y, w, h, cor = "#a0574a", borda = "#e8d4b8") { rr(x, y, w, h, 18, borda); rr(x + 14, y + 10, w - 28, h - 20, 14, cor); g.strokeStyle = borda; g.lineWidth = 4; g.setLineDash([16, 12]); g.strokeRect(x + 40, y + 28, w - 80, h - 56); g.setLineDash([]); }
  function janelaNoite(x, y, w, h, t = 0, lua = true) {
    rr(x - 16, y - 16, w + 32, h + 32, 8, "#efe9df");
    g.fillStyle = lin(0, y, 0, y + h, [[0, "#0d1530"], [1, "#2a3560"]]); g.fillRect(x, y, w, h);
    if (lua) { glow(x + w * .75, y + h * .22, 90, "rgba(255,245,210,A)", .35); circ(x + w * .75, y + h * .22, 26, "#f4ecd2"); }
    let s = 7; const r2 = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 9; i++) { const bw = 40 + r2() * 60, bh = h * (.25 + r2() * .55), bx = x + i * (w / 8) - 10; rect(bx, y + h - bh, bw, bh, "#151c33"); for (let r = 0; r < bh / 22 - 1; r++) for (let c = 0; c < bw / 16 - 1; c++) if (r2() < .3) rect(bx + 6 + c * 16, y + h - bh + 8 + r * 22, 7, 9, r2() < .7 ? "#f2c45a" : "#9ac8f0"); }
    rect(x + w / 2 - 5, y, 10, h, "#efe9df"); rect(x, y + h / 2 - 5, w, 10, "#efe9df");
    // cortinas
    for (const lado of [-1, 1]) { const cx = lado < 0 ? x - 60 : x + w + 60; g.fillStyle = lin(cx - 70, 0, cx + 70, 0, [[0, "#b98a7a"], [.5, "#d4a898"], [1, "#a87868"]]); g.beginPath(); g.moveTo(cx - 70, y - 40); g.lineTo(cx + 70, y - 40); for (let k = 0; k <= 8; k++) g.lineTo(cx + 70 - k * 17.5, y + h + 60 + (k % 2) * 14); g.fill(); for (let k = 1; k < 4; k++) rect(cx - 70 + k * 35, y - 40, 3, h + 90, "rgba(0,0,0,.08)"); }
    rect(x - 150, y - 50, w + 300, 12, "#6a5040");
  }
  function quadro(x, y, w, h, desenho, moldura = "#3a2a20") { rr(x - 10, y - 10, w + 20, h + 20, 4, moldura); rect(x, y, w, h, "#f4efe6"); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); desenho(x, y, w, h); g.restore(); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x + w + 10, y, 6, h + 10); }
  function fotoFamilia(x, y, w, h) { g.fillStyle = lin(0, y, 0, y + h, [[0, "#9ad0f0"], [1, "#e8f4fa"]]); g.fillRect(x, y, w, h); rect(x, y + h * .75, w, h * .25, "#8ac070"); const ps = [[.25, 1, "#7a2e3a"], [.45, 1.1, "#3a5a8a"], [.62, .65, "#e0a83a"], [.76, .55, "#5aa06a"]]; ps.forEach(([k, s, c]) => { const px = x + w * k, py = y + h * .95; rr(px - 13 * s, py - 60 * s, 26 * s, 50 * s, 8, c); circ(px, py - 70 * s, 12 * s, "#e8b48a"); }); }
  function planta(x, y, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); rr(-40, -70, 80, 70, 10, "#c4724a"); rect(-44, -76, 88, 14, "#a85a3a"); const fs = [[-.9, 120], [-.5, 150], [-.1, 170], [.3, 150], [.7, 130], [1, 100]]; fs.forEach(([a, l], i) => { g.save(); g.translate(0, -74); g.rotate(a * .9); elip(0, -l / 2, 18, l / 2, i % 2 ? "#3f7a4a" : "#4f9a5a"); g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -l * .9); g.stroke(); g.restore(); }); g.restore(); }
  function luminaria(x, y, ligada = 1) { rect(x - 4, y - 520, 8, 520, "#3a3a3a"); elip(x, y, 50, 10, "#3a3a3a"); g.fillStyle = "#efe2c8"; g.beginPath(); g.moveTo(x - 70, y - 480); g.lineTo(x + 70, y - 480); g.lineTo(x + 46, y - 590); g.lineTo(x - 46, y - 590); g.fill(); if (ligada) { glow(x, y - 500, 380, "rgba(255,214,150,A)", .35 * ligada); } }
  function sofa(x, y, w, cor = "#5a6e8a") { // y = chão
    const esc = shade(cor, -22), cla = shade(cor, 14);
    sombraChao(x + w / 2, y + 6, w * .55);
    rr(x, y - 300, w, 190, 28, esc); // encosto
    for (let i = 0; i < 3; i++) rr(x + 50 + i * (w - 100) / 3 + 6, y - 290, (w - 100) / 3 - 12, 170, 22, cor);
    rr(x + 40, y - 150, w - 80, 110, 18, cla); for (let i = 1; i < 3; i++) rect(x + 40 + i * (w - 80) / 3, y - 150, 3, 100, "rgba(0,0,0,.12)");
    rr(x - 10, y - 210, 80, 190, 26, esc); rr(x + w - 70, y - 210, 80, 190, 26, esc);
    rect(x + 20, y - 40, 14, 40, "#3a2a20"); rect(x + w - 34, y - 40, 14, 40, "#3a2a20");
    rr(x + 90, y - 260, 110, 100, 24, "#e0a83a"); rr(x + w - 210, y - 255, 110, 95, 24, "#e8d8c0");
  }
  function rackTv(x, y, ligada = 1, t = 0) { sombraChao(x + 220, y + 4, 240); rr(x, y - 120, 440, 120, 8, "#6a4a32"); rect(x + 10, y - 110, 205, 90, "#7a5a40"); rect(x + 225, y - 110, 205, 90, "#7a5a40"); circ(x + 200, y - 65, 5, "#c8a040"); circ(x + 240, y - 65, 5, "#c8a040"); rr(x + 40, y - 430, 360, 220, 8, "#111"); g.fillStyle = ligada ? lin(x, 0, x + 360, 0, [[0, "#2a4a7a"], [.5 + .2 * Math.sin(t * .7), "#5a8ac0"], [1, "#2a3a5a"]]) : "#16181c"; g.fillRect(x + 50, y - 420, 340, 200); rect(x + 210, y - 210, 20, 90, "#222"); if (ligada) glow(x + 220, y - 320, 420, "rgba(110,160,230,A)", .22); }
  function mesaJantar(x, y, w, t) { // y = chão
    rect(x + 40, y - 330, 14, 330, "#5a3a24"); rect(x + w - 54, y - 330, 14, 330, "#5a3a24");
    rr(x, y - 350, w, 30, 6, "#7a5236"); g.fillStyle = "#f2ece2"; g.beginPath(); g.moveTo(x + 20, y - 352); g.lineTo(x + w - 20, y - 352); g.lineTo(x + w - 40, y - 270); g.lineTo(x + 40, y - 270); g.fill(); rect(x + 40, y - 300, w - 80, 4, "rgba(0,0,0,.06)");
    for (const px of [x + w * .25, x + w * .72]) { elip(px, y - 356, 62, 16, "#fafafa"); elip(px, y - 358, 44, 10, "#e8d8b8"); elip(px - 12, y - 362, 14, 8, "#c86a3a"); rr(px + 78, y - 420, 22, 60, 6, "rgba(200,230,255,.6)"); }
    rr(x + w * .48 - 30, y - 410, 60, 60, 10, "#b04a3a"); elip(x + w * .48, y - 410, 30, 8, "#8a3a2a");
  }
  function pendente(x, y, liga = 1) { rect(x - 2, 0, 4, y - 60, "#222"); g.fillStyle = "#2a2a2a"; g.beginPath(); g.moveTo(x - 110, y); g.lineTo(x + 110, y); g.lineTo(x + 40, y - 80); g.lineTo(x - 40, y - 80); g.fill(); if (liga) { g.fillStyle = "rgba(255,214,150,.13)"; g.beginPath(); g.moveTo(x - 110, y); g.lineTo(x + 110, y); g.lineTo(x + 400, y + 700); g.lineTo(x - 400, y + 700); g.fill(); glow(x, y + 10, 160, "rgba(255,226,170,A)", .5); } }
  function cadeira(x, y, cor = "#6a4a32") { rect(x - 60, y - 520, 14, 520, cor); rect(x + 46, y - 520, 14, 520, cor); rr(x - 64, y - 520, 128, 160, 12, shade(cor, 10)); rr(x - 70, y - 290, 140, 26, 6, cor); rect(x - 60, y - 260, 14, 260, cor); rect(x + 46, y - 260, 14, 260, cor); }
  function cozinha(y, noite = 0, t = 0) { // y = chão
    parede(0, y, "#e7e1d4", "#d9d1c0");
    for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) rr(c * 122 + (r % 2) * 61 - 30, 640 + r * 70, 118, 66, 4, r % 2 ? "#e9f0ee" : "#dfe8e6");
    for (let i = 0; i < 4; i++) { rr(20 + i * 262, 250, 250, 340, 8, "#f4f1ea"); rect(20 + i * 262 + 230, 380, 6, 70, "#9a9a9a"); }
    rect(0, 590, W, 14, "rgba(0,0,0,.08)");
    rr(0, y - 470, W, 30, 4, "#3a3a40"); // bancada
    for (let i = 0; i < 4; i++) { rr(20 + i * 262, y - 440, 250, 440, 8, "#f4f1ea"); rect(20 + i * 262 + 110, y - 410, 30, 6, "#9a9a9a"); }
    // pia + torneira
    rr(560, y - 480, 340, 20, 8, "#c8ccd2"); rr(580, y - 476, 300, 12, 6, "#9aa0a8");
    g.strokeStyle = "#b8bec6"; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.moveTo(730, y - 480); g.lineTo(730, y - 620); g.quadraticCurveTo(730, y - 660, 690, y - 660); g.lineTo(670, y - 640); g.stroke();
    // geladeira
    rr(60, y - 1000, 260, 560 + 0, 14, "#dfe3e8"); rect(60, y - 760, 260, 6, "#b8bec6"); rect(290, y - 960, 10, 120, "#a8aeb6"); rect(290, y - 720, 10, 160, "#a8aeb6");
    rr(100, y - 940, 70, 90, 4, "#fff"); rr(105, y - 935, 60, 60, 2, "#9ad0f0"); circ(135, y - 900, 10, "#e8b48a"); // foto no ímã
    rr(190, y - 920, 60, 40, 4, "#f2c45a");
    janelaNoite(400, 300, 300, 240, t, true);
    pisoAzulejo(y, "#cfc8bb", "#bdb5a6");
    if (noite) { tinta("#0a1030", .45 * noite); }
  }
  function corredorBanheiro(y, t, vapor = 1) {
    parede(0, y, "#d8d0c4", "#c8c0b2"); pisoMadeira(y, "#8a5e3c"); rodape(y);
    // porta do banheiro fechada
    rr(330, y - 1000, 420, 1000, 6, "#efe9df"); rr(350, y - 980, 380, 980, 4, "#f7f3ec"); for (const yy of [y - 940, y - 520]) { g.strokeStyle = "#e2dbcf"; g.lineWidth = 6; g.strokeRect(390, yy, 300, 360); }
    circ(700, y - 500, 14, "#c8a040"); rr(696, y - 504, 40, 10, 5, "#c8a040");
    // luz por baixo
    g.fillStyle = "rgba(255,226,170,.9)"; g.fillRect(352, y - 10, 376, 10); glow(540, y + 10, 220, "rgba(255,226,170,A)", .35);
    // vapor escapando pela fresta de cima
    for (let i = 0; i < 10; i++) { const k = ((t * .25 + i / 10) % 1); g.globalAlpha = vapor * (1 - k) * .35; elip(380 + i * 34 + Math.sin(t + i) * 10, y - 1000 - k * 220, 40 + k * 40, 22 + k * 20, "#fff"); g.globalAlpha = 1; }
    quadro(830, y - 900, 160, 200, (x, yy, w, h) => { g.fillStyle = lin(0, yy, 0, yy + h, [[0, "#f2c49a"], [1, "#e08a6a"]]); g.fillRect(x, yy, w, h); circ(x + w * .5, yy + h * .45, 26, "#fff2c0"); });
  }
  function quarto(y, t, noite = 0) {
    parede(0, y, "#c9b8c8", "#b8a4b6");
    // guarda-roupa aberto
    rr(560, y - 1150, 480, 1150, 8, "#e8dccb"); rr(580, y - 1130, 440, 1110, 4, "#3a3028");
    rect(590, y - 1050, 420, 8, "#8a8a8a");
    const roupas = ["#3a5a8a", "#f2f2f2", "#7a2e3a", "#5a7a5a", "#e0a83a", "#2a2a2a", "#9a6a8a"];
    roupas.forEach((c, i) => { rr(600 + i * 58, y - 1040, 50, 360 + (i % 3) * 40, 10, c); });
    rect(590, y - 600, 420, 14, "#d8ccb8");
    // chuteira limpa na prateleira
    g.save(); g.translate(760, y - 610); g.fillStyle = "#1a1a1a"; g.beginPath(); g.moveTo(-90, 0); g.lineTo(80, 0); g.quadraticCurveTo(110, -10, 100, -40); g.lineTo(-10, -50); g.quadraticCurveTo(-60, -80, -90, -50); g.closePath(); g.fill(); rect(-60, -40, 120, 6, "#f2f2f2"); for (let i = 0; i < 4; i++) circ(-60 + i * 45, 6, 8, "#ddd"); g.restore();
    for (let i = 0; i < 3; i++) rr(600 + i * 140, y - 420, 120, 80, 8, ["#c8b8a0", "#8a9aaa", "#a08a7a"][i]);
    rr(540, y - 1150, 40, 1150, 6, "#d8cbb8"); // porta aberta
    // cama
    rr(-40, y - 540, 520, 300, 30, "#6a4a3a");
    rr(-60, y - 260, 560, 200, 20, "#f2ece2"); rr(-60, y - 300, 560, 80, 30, "#d9c4b8"); rr(20, y - 340, 170, 80, 30, "#fff"); rr(220, y - 340, 170, 80, 30, "#fff");
    rr(-60, y - 230, 560, 170, 16, "#8a5a6a"); for (let i = 0; i < 5; i++) rect(-60, y - 210 + i * 30, 560, 3, "rgba(255,255,255,.12)");
    planta(500, y, .8);
    pisoMadeira(y, "#8a5e3c", noite); rodape(y, "#e2d6d0");
    if (noite) tinta("#0a1030", .35 * noite);
  }
  function sala(y, t, { tv = 1, noite = 1 } = {}) {
    parede(0, y, "#d9cbb6", "#c7b79f");
    janelaNoite(90, 300, 360, 470, t);
    quadro(620, 360, 300, 220, fotoFamilia, "#2a2018");
    quadro(560, 640, 120, 150, (x, yy, w, h) => { rect(x, yy, w, h, "#e0a83a"); circ(x + w / 2, yy + h / 2, 30, "#7a2e3a"); });
    quadro(720, 640, 200, 150, (x, yy, w, h) => { rect(x, yy, w, h, "#6a8aa0"); g.fillStyle = "#e8f0f4"; g.beginPath(); g.moveTo(x, yy + h); g.lineTo(x + w * .4, yy + h * .3); g.lineTo(x + w * .7, yy + h * .7); g.lineTo(x + w, yy + h * .4); g.lineTo(x + w, yy + h); g.fill(); });
    pisoMadeira(y, "#9a6c45"); rodape(y);
    tapete(110, y + 60, 860, 240);
    luminaria(980, y, 1);
    planta(70, y + 40, 1);
    if (noite) tinta("#0a1030", .18);
  }
  // ---------- personagem ----------
  function shade(hex, p) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255; const f = (c) => clamp(Math.round(c + p * 2.55), 0, 255); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
  function pessoa(x, y, s = 1, o = {}) {
    const { sexo = "m", pele = "#e3a77f", cabelo = "#2a1c14", roupa = "#3a5a8a", calca = "#2e3a52", expr = "neutro", olhar = 0, braco = 0, braco2 = 0, sentado = false, cabeca = 0, celular = false, piscar = 1 } = o;
    g.save(); g.translate(x, y); g.scale(s, s);
    const pernaH = sentado ? 90 : 170, base = -pernaH;
    sombraChao(0, 4, 70);
    // pernas
    if (sentado) { rr(-38, -96, 34, 96, 14, calca); rr(4, -96, 34, 96, 14, calca); rr(-44, -110, 88, 44, 18, shade(calca, 6)); }
    else { rr(-34, -172, 30, 168, 12, calca); rr(4, -172, 30, 168, 12, calca); rect(4, -172, 30, 168, "rgba(0,0,0,.08)"); }
    rr(-40, -10, 36, 14, 6, "#2a2420"); rr(4, -10, 36, 14, 6, "#2a2420");
    // cabelo de trás (longo)
    const hy = base - 250;
    if (sexo === "f") { g.fillStyle = shade(cabelo, -8); g.beginPath(); g.moveTo(-58, hy - 10); g.quadraticCurveTo(-78, hy + 110, -54, hy + 150); g.lineTo(54, hy + 150); g.quadraticCurveTo(78, hy + 110, 58, hy - 10); g.fill(); }
    // tronco
    g.fillStyle = roupa; g.beginPath(); g.moveTo(-58, base - 170); g.quadraticCurveTo(-62, base - 182, -40, base - 186); g.lineTo(40, base - 186); g.quadraticCurveTo(62, base - 182, 58, base - 170); g.lineTo(sexo === "f" ? 40 : 46, base + 2); g.lineTo(sexo === "f" ? -40 : -46, base + 2); g.closePath(); g.fill();
    g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.moveTo(14, base - 186); g.lineTo(40, base - 186); g.quadraticCurveTo(62, base - 182, 58, base - 170); g.lineTo(46, base + 2); g.lineTo(18, base + 2); g.fill();
    if (sexo === "f") { g.fillStyle = pele; g.beginPath(); g.moveTo(-20, base - 186); g.lineTo(20, base - 186); g.lineTo(0, base - 150); g.fill(); }
    else { g.fillStyle = shade(roupa, -18); g.beginPath(); g.moveTo(-26, base - 188); g.lineTo(0, base - 160); g.lineTo(-10, base - 190); g.fill(); g.beginPath(); g.moveTo(26, base - 188); g.lineTo(0, base - 160); g.lineTo(10, base - 190); g.fill(); circ(0, base - 140, 3, shade(roupa, -25)); circ(0, base - 110, 3, shade(roupa, -25)); }
    rect(-46, base - 8, 92, 12, shade(calca, -10));
    // braços
    const bracoD = (ang, lado) => { g.save(); g.translate(lado * 52, base - 172); g.rotate(lado * -ang); rr(-13, 0, 26, 92, 12, roupa); g.translate(0, 86); g.rotate(lado * -ang * .5); rr(-11, 0, 22, 78, 10, roupa); circ(0, 84, 14, pele); if (celular && lado === 1) { rr(-18, 66, 36, 62, 6, "#111"); rr(-14, 70, 28, 54, 4, "#3a6ab0"); } g.restore(); };
    bracoD(braco2, -1); bracoD(braco, 1);
    // pescoço + cabeça
    rr(-13, base - 210, 26, 30, 6, shade(pele, -8));
    g.save(); g.translate(0, hy); g.rotate(cabeca);
    elip(-50, 6, 9, 14, shade(pele, -6)); elip(50, 6, 9, 14, shade(pele, -6));
    elip(0, 0, 50, 60, pele);
    if (sexo === "m") { g.globalAlpha = .18; elip(0, 30, 44, 30, "#3a2a20"); g.globalAlpha = 1; }
    // cabelo
    g.fillStyle = cabelo; g.beginPath();
    if (sexo === "f") { g.moveTo(-54, 10); g.quadraticCurveTo(-60, -66, 0, -66); g.quadraticCurveTo(60, -66, 54, 10); g.quadraticCurveTo(40, -40, 6, -42); g.quadraticCurveTo(-30, -20, -54, 10); }
    else { g.moveTo(-52, -6); g.quadraticCurveTo(-54, -66, 0, -64); g.quadraticCurveTo(54, -66, 52, -6); g.quadraticCurveTo(46, -34, 20, -38); g.quadraticCurveTo(-20, -30, -44, -26); g.closePath(); }
    g.fill();
    // rosto
    const ox = olhar * 9;
    const sobr = { neutro: [0, 0], desconfiada: [.25, -.25], sorriso: [-.1, .1], choque: [-.35, .35], triste: [-.3, .3], bravo: [.35, -.35] }[expr] || [0, 0];
    g.strokeStyle = shade(cabelo, -5); g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(-30 + ox, -18 + sobr[0] * -20); g.lineTo(-10 + ox, -20 + sobr[1] * -20); g.moveTo(10 + ox, -20 + sobr[1] * -20); g.lineTo(30 + ox, -18 + sobr[0] * -20); g.stroke();
    const ab = (expr === "desconfiada" ? .45 : expr === "choque" ? 1.25 : 1) * piscar;
    for (const ex of [-20, 20]) { elip(ex + ox * .3, 0, 11, 9 * ab + .5, "#fff"); circ(ex + ox, 0 + (1 - ab) * 2, 5.5 * Math.min(1, ab + .3), "#2a1c14"); if (expr === "desconfiada") rect(ex - 13, -11, 26, 8, pele); }
    g.strokeStyle = shade(pele, -22); g.lineWidth = 3; g.beginPath(); g.moveTo(2, 4); g.quadraticCurveTo(8, 18, 0, 20); g.stroke();
    if (sexo === "f") { g.globalAlpha = .25; circ(-30, 18, 10, "#e06a6a"); circ(30, 18, 10, "#e06a6a"); g.globalAlpha = 1; }
    g.strokeStyle = sexo === "f" ? "#a8404a" : "#7a3a30"; g.lineWidth = sexo === "f" ? 5 : 4; g.beginPath();
    if (expr === "sorriso") { g.arc(0, 26, 14, .15 * Math.PI, .85 * Math.PI); }
    else if (expr === "choque") { g.stroke(); elip(0, 36, 9, 12, "#5a2020"); g.beginPath(); }
    else if (expr === "triste" || expr === "bravo") { g.arc(0, 44, 13, 1.2 * Math.PI, 1.8 * Math.PI); }
    else if (expr === "desconfiada") { g.moveTo(-12, 34); g.lineTo(12, 30); }
    else { g.moveTo(-11, 32); g.lineTo(11, 32); }
    g.stroke();
    g.restore(); g.restore();
  }
  // ---------- celular em close ----------
  function celular(cx, cy, s, desenhaTela) { g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.roundRect(-232, -452, 480, 920, 64); g.fill(); rr(-240, -460, 480, 920, 64, "#141519"); rr(-226, -446, 452, 892, 52, "#000"); g.save(); g.beginPath(); g.roundRect(-218, -438, 436, 876, 46); g.clip(); desenhaTela(-218, -438, 436, 876); g.restore(); rr(-60, -428, 120, 30, 15, "#000"); g.restore(); }
  function telaBloqueio(x, y, w, h, digitos, erro = 0, hora = "22:14") { g.fillStyle = lin(0, y, 0, y + h, [[0, "#3a2a5a"], [1, "#1a2a4a"]]); g.fillRect(x, y, w, h); txt(hora, x + w / 2, y + 150, 110, "#fff", 500, "center", "Nunito"); txt("Digite a senha", x + w / 2, y + 300, 34, "#ddd", 500, "center", "Nunito"); const dx = erro ? Math.sin(erro * 40) * 14 * (1 - erro) : 0; for (let i = 0; i < 6; i++) { g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2 - 100 + i * 40 + dx, y + 370, 11, 0, 6.283); g.stroke(); if (i < digitos) circ(x + w / 2 - 100 + i * 40 + dx, y + 370, 11, "#fff"); } for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const n = r < 3 ? r * 3 + c + 1 : (c === 1 ? 0 : ""); if (n === "") continue; circ(x + w / 2 - 120 + c * 120, y + 490 + r * 105, 44, "rgba(255,255,255,.14)"); txt(String(n), x + w / 2 - 120 + c * 120, y + 492 + r * 105, 46, "#fff", 500, "center", "Nunito"); } if (erro > 0) txt("Senha incorreta", x + w / 2, y + 420, 30, "#ff8a8a", 700, "center", "Nunito"); }
  function telaNotificacao(x, y, w, h, nome, msg, k) { g.fillStyle = lin(0, y, 0, y + h, [[0, "#1a1a2a"], [1, "#0a0a14"]]); g.fillRect(x, y, w, h); txt("23:47", x + w / 2, y + 160, 110, "#fff", 500, "center", "Nunito"); txt("sexta-feira, 25 de outubro", x + w / 2, y + 240, 28, "#bbb", 500, "center", "Nunito"); if (k <= 0) return; g.save(); g.globalAlpha = Math.min(1, k * 2); g.translate(0, (1 - Math.min(1, k * 2)) * -40); rr(x + 20, y + 300, w - 40, 150, 28, "rgba(240,240,245,.92)"); rr(x + 44, y + 330, 60, 60, 14, "#25d366"); txt("💬", x + 74, y + 362, 34, "#fff", 500, "center", "Nunito"); txt(nome, x + 124, y + 344, 32, "#111", 800, "left", "Nunito"); txt("agora", x + w - 50, y + 344, 22, "#777", 500, "right", "Nunito"); txt(msg, x + 124, y + 392, 34, "#222", 600, "left", "Nunito"); g.restore(); }
  // ---------- HUD + adesivos ----------
  function hud(t, dia, hora, lugar, cor = "#d6453a") { g.save(); g.fillStyle = (t % 1) < .5 ? cor : "rgba(214,69,58,.3)"; g.beginPath(); g.arc(70, 92, 9, 0, 6.283); g.fill(); txt(`DIA ${dia}`, 90, 92, 26, "#fff", 500, "left"); g.shadowColor = "rgba(0,0,0,.85)"; g.shadowBlur = 10; txt(hora, 60, 150, 72, "#fff", 700, "left"); txt(lugar, 62, 205, 28, "#eee", 500, "left"); g.restore(); }
  function adesivo(rotulo, texto, a, y = 470, cor = "#d6453a") { if (a <= 0) return; g.save(); g.globalAlpha = Math.min(1, a * 1.4); g.translate(W / 2, y); g.rotate(-.035); g.scale(.82 + .18 * a, .82 + .18 * a); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 20; g.shadowOffsetY = 8; g.font = "700 62px Oswald"; const w = Math.max(g.measureText(texto).width + 70, 300); rr(-w / 2, -50, w, 100, 10, "#fdf8ec"); g.shadowColor = "transparent"; rr(-110, -96, 220, 46, 8, cor); txt(rotulo, 0, -73, 28, "#fff"); txt(texto, 0, 2, 62, "#1d2129"); g.restore(); }
  function balao(x, y, s, a = 1) { if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = "600 40px Nunito"; const w = g.measureText(s).width + 60; rr(x - w / 2, y - 50, w, 90, 40, "#fff"); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x - 10, y + 36); g.lineTo(x + 30, y + 36); g.lineTo(x - 20, y + 80); g.fill(); txt(s, x, y - 4, 40, "#222", 600, "center", "Nunito"); g.restore(); }
  return { clamp, ease, rnd, rr, rect, circ, elip, txt, glow, vinheta, tinta, camera, parede, rodape, pisoMadeira, pisoAzulejo, tapete, janelaNoite, quadro, fotoFamilia, planta, luminaria, sofa, rackTv, mesaJantar, pendente, cadeira, cozinha, corredorBanheiro, quarto, sala, pessoa, shade, celular, telaBloqueio, telaNotificacao, hud, adesivo, balao };
}
