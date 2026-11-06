// Loja de skins da Festa da Turma: Pix no robô (Mercado Pago). A skin é do @ pra sempre e só muda o visual do boneco (nunca dá ponto).
// Em cima tem o PROVADOR: um bonequinho girando com a skin escolhida, pra ver como fica antes de comprar.
// A lendária (Farmador de Aura) aparece num cartão só, com as cores em bolinhas.
// ctx: { $, eu() -> boneco do jogador ou null, arroba() -> @ digitado, enviar(obj), fecharOutros(), provador: { ligar(canvas, eu), mostrar(sk, au), desligar() } }
const ROBO = "https://brasildaturma-renan.squareweb.app";
const real = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");
const limpa = (s) => String(s).replace(/[<>&"]/g, "");

export function criarLoja(ctx) {
  const { $ } = ctx, l = $("loja");
  let minhas = [], catalogo = null, venda = false, compra = null, timer = null, corAura = 0, pS = -1, pA = -1; // provador: skin comum + aura, juntas
  const fechar = () => { l.hidden = true; ctx.provador?.desligar(); };
  const msg = (t) => { const m = l.querySelector(".msgL"); if (m) m.textContent = t; };

  async function abrir() {
    ctx.fecharOutros(); l.hidden = false;
    if (compra) return mostrarCompra();
    l.innerHTML = "<p>Carregando as skins…</p>";
    try {
      const u = ctx.arroba();
      const d = await (await fetch(ROBO + "/skins/lista" + (u ? "?u=" + encodeURIComponent(u) : ""), { cache: "no-store" })).json();
      catalogo = d.skins; venda = d.venda; if (u) minhas = d.minhas || [];
    } catch { l.innerHTML = "<p>Não consegui abrir a loja agora. Tenta de novo.</p><button class='ok'>Fechar</button>"; l.querySelector(".ok").onclick = fechar; return; }
    const eu = ctx.eu(); pS = eu ? eu.sk ?? -1 : -1; pA = eu ? eu.au ?? -1 : -1; if (pS < 0 && pA < 0) pS = 0; if (pA >= 6) corAura = pA - 6;
    montar();
  }

  // dois espaços: comum (0-5) e aura (6-11). i = -1 tira a comum, -2 tira a aura
  function vestir(i) {
    const eu = ctx.eu(); if (!eu) return;
    if (i === -2) eu.au = -1; else if (i === -1) eu.sk = -1; else if (i >= 6) eu.au = i; else eu.sk = i;
    pS = eu.sk; pA = eu.au ?? -1;
    ctx.enviar({ t: "vestir", i });
    try { localStorage.setItem("festa-skin", String(eu.sk)); localStorage.setItem("festa-aura", String(eu.au ?? -1)); } catch {}
  }
  const usando = (eu, i) => !!eu && (i >= 6 ? eu.au === i : eu.sk === i);

  // botão de cada skin: comprar, vestir, tirar
  function botao(b, i) {
    const eu = ctx.eu(), s = catalogo[i], usa = usando(eu, i);
    if (minhas.includes(i)) {
      b.textContent = !eu ? "✅ É tua" : usa ? "Tirar" : "Vestir";
      b.onclick = (e) => { e.stopPropagation(); if (!eu) return; vestir(usa ? (i >= 6 ? -2 : -1) : i); montar(); };
    } else {
      b.textContent = venda ? `Comprar ${real(s.preco)}` : "Em breve"; b.disabled = !venda;
      b.onclick = (e) => { e.stopPropagation(); pedirDados(i); };
    }
  }

  // tocar numa skin põe ela no provador (no espaço dela); tocar de novo tira. Aura + skin comum aparecem juntas.
  function provar(i) { if (i >= 6) pA = pA === i ? -1 : i; else pS = pS === i ? -1 : i; atualizarProvador(); }
  function atualizarProvador() {
    ctx.provador?.mostrar(pS, pA);
    const nomes = [pS, pA].filter((k) => k >= 0 && catalogo[k]).map((k) => `${catalogo[k].icone} ${catalogo[k].nome}`);
    const n = l.querySelector(".provNome"); if (n) n.textContent = nomes.length ? nomes.join(" + ") : "sem skin";
    l.querySelectorAll(".sk").forEach((d) => d.classList.toggle("provando", d.dataset.g === "aura" ? pA >= 6 : +d.dataset.i === pS));
  }

  function montar() {
    if (l.hidden || compra || !catalogo) return;
    const eu = ctx.eu(), u = ctx.arroba();
    l.innerHTML = `<button class="fechar" aria-label="Fechar">×</button><h2>👕 Loja de skins</h2>
<div class="prov"><canvas width="360" height="360" aria-label="Teu boneco com a skin escolhida"></canvas><div class="provNome"></div><div class="provDica">toca numa skin pra provar · dá pra juntar aura + outra 👇</div></div>
<div class="grade"></div><p class="sub">✨ Dá pra usar a aura lendária junto com outra skin. É do teu @ pra sempre, em todas as festas. Só muda o visual: não dá ponto.</p><p class="msgL"></p>`;
    l.querySelector(".fechar").onclick = fechar;
    const g = l.querySelector(".grade");
    // lendária primeiro, num cartão só com as cores
    const auras = catalogo.map((s, i) => [s, i]).filter(([s]) => s.grupo === "aura");
    if (auras.length) {
      const i = auras[Math.min(corAura, auras.length - 1)][1], d = document.createElement("div");
      d.className = "sk lend" + (minhas.includes(i) ? " tem" : "") + (usando(eu, i) ? " vest" : ""); d.dataset.g = "aura";
      d.innerHTML = `<div class="selo">⭐ LENDÁRIA</div><div class="nm">✨ Farmador de Aura</div><div class="cores"></div><button class="comprar"></button>`;
      const cs = d.querySelector(".cores");
      auras.forEach(([s, k], n) => { const c = document.createElement("button"); c.className = "cor" + (k === i ? " on" : "") + (minhas.includes(k) ? " minha" : ""); c.style.background = s.cor; c.setAttribute("aria-label", s.nome); c.onclick = (e) => { e.stopPropagation(); corAura = n; pA = k; montar(); }; cs.appendChild(c); });
      botao(d.querySelector(".comprar"), i); d.onclick = () => provar(i); g.appendChild(d);
    }
    catalogo.forEach((s, i) => {
      if (s.grupo === "aura") return;
      const d = document.createElement("div"); d.dataset.i = i;
      d.className = "sk" + (minhas.includes(i) ? " tem" : "") + (usando(eu, i) ? " vest" : "");
      d.innerHTML = `<div class="ic">${s.icone}</div><div class="nm">${limpa(s.nome)}</div><button></button>`;
      botao(d.querySelector("button"), i); d.onclick = () => provar(i); g.appendChild(d);
    });
    ctx.provador?.ligar(l.querySelector(".prov canvas"), eu);
    atualizarProvador();
    if (!u) msg("Escreve teu @ na tela de entrada pra comprar e ver as tuas skins.");
  }

  function pedirDados(i) {
    const s = catalogo[i], u = ctx.arroba();
    if (!u) { msg("Escreve teu @ primeiro (na tela de entrada)."); return; }
    ctx.provador?.desligar();
    let mail = ""; try { mail = localStorage.getItem("festa-email") || ""; } catch {}
    l.innerHTML = `<button class="fechar" aria-label="Voltar">×</button><div class="ic" style="font-size:54px">${s.icone}</div><h2>${limpa(s.nome)}</h2><p class="sub">Pro @<b>${limpa(u)}</b> · ${real(s.preco)} no Pix</p>
<input type="email" id="lojaMail" placeholder="teu e-mail (pro comprovante)" autocomplete="email"><p class="sub">A skin só muda o visual do boneco e não dá ponto.</p><button class="ok">Gerar Pix</button><p class="msgL"></p>`;
    $("lojaMail").value = mail;
    l.querySelector(".fechar").onclick = montar;
    l.querySelector(".ok").onclick = async (ev) => {
      const email = $("lojaMail").value.trim();
      ev.target.disabled = true; msg("Gerando o Pix…");
      try {
        const r = await fetch(ROBO + "/skins/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ arroba: u, skin: s.id, email, maior: true }) });
        const d = await r.json();
        if (!r.ok) { msg(d.erro || "Não deu certo. Tenta de novo."); ev.target.disabled = false; return; }
        try { localStorage.setItem("festa-email", email); } catch {}
        compra = { ...d, i, nome: s.nome, icone: s.icone }; mostrarCompra();
        clearInterval(timer); timer = setInterval(conferir, 4000);
      } catch { msg("Sem conexão. Tenta de novo."); ev.target.disabled = false; }
    };
  }

  function mostrarCompra() {
    const c = compra; l.hidden = false; ctx.provador?.desligar();
    l.innerHTML = `<button class="fechar" aria-label="Fechar">×</button><h2>${c.icone} Paga o Pix</h2><p class="sub">${limpa(c.nome)} · ${real(c.preco)}. Assim que cair, a skin aparece no teu boneco.</p>${c.qr ? `<img class="qr" alt="QR code do Pix" src="data:image/png;base64,${c.qr}">` : ""}<textarea readonly aria-label="Pix copia e cola"></textarea><button class="ok" id="lojaCopiar">📋 Copiar o Pix copia e cola</button><p class="sub">⏳ Esperando o pagamento…</p><button class="ok cinza" id="lojaCanc">Cancelar</button>`;
    l.querySelector("textarea").value = c.copia;
    l.querySelector(".fechar").onclick = fechar;
    $("lojaCopiar").onclick = async (ev) => { try { await navigator.clipboard.writeText(c.copia); ev.target.textContent = "✅ Copiado! Cola no app do banco"; } catch { l.querySelector("textarea").select(); } };
    $("lojaCanc").onclick = () => { compra = null; clearInterval(timer); montar(); };
  }

  async function conferir() {
    if (!compra) return clearInterval(timer);
    if (Date.now() > compra.expira + 60e3) { clearInterval(timer); compra = null; montar(); return; }
    try {
      const d = await (await fetch(`${ROBO}/skins/situacao?id=${compra.id}&segredo=${compra.segredo}`, { cache: "no-store" })).json();
      if (d.status !== "pago") return;
      clearInterval(timer); const c = compra; compra = null;
      if (!minhas.includes(c.i)) minhas.push(c.i);
      const eu = ctx.eu(); if (eu) vestir(c.i);
      l.hidden = false;
      l.innerHTML = `<div class="ic" style="font-size:64px">${c.icone}</div><h2>Skin liberada! 🎉</h2><p class="sub">${eu ? "Já está no teu boneco." : "Ela aparece no teu boneco quando você entrar na festa."}</p><button class="ok">Fechar</button>`;
      l.querySelector(".ok").onclick = fechar;
    } catch {}
  }

  return {
    abrir, fechar, montar,
    get minhas() { return minhas; },
    // só redesenha se a lista estiver aberta (não apaga a tela do Pix nem a de "Skin liberada")
    setMinhas(v) { minhas = v || []; if (l.querySelector(".grade")) montar(); },
    // ao entrar: veste a skin escolhida da última vez (se for dele); senão a que o servidor pôs
    aoEntrar() {
      const eu = ctx.eu(); if (!eu) return;
      try {
        const g = localStorage.getItem("festa-skin"), a = localStorage.getItem("festa-aura");
        if (g !== null && +g < 6 && (+g === -1 || minhas.includes(+g)) && +g !== eu.sk) vestir(+g);
        if (a !== null && (+a === -1 ? eu.au >= 6 : minhas.includes(+a) && +a !== eu.au)) vestir(+a === -1 ? -2 : +a);
      } catch {}
    },
  };
}
