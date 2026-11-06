// Loja de skins da Festa da Turma: Pix no robô (Mercado Pago). A skin é do @ pra sempre e só muda o visual do boneco (nunca dá ponto).
// ctx: { $, eu() -> boneco do jogador ou null, arroba() -> @ digitado, enviar(obj), fecharOutros() }
const ROBO = "https://brasildaturma-renan.squareweb.app";
const real = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");
const limpa = (s) => String(s).replace(/[<>&"]/g, "");

export function criarLoja(ctx) {
  const { $ } = ctx, l = $("loja");
  let minhas = [], catalogo = null, venda = false, compra = null, timer = null;
  const fechar = () => { l.hidden = true; };
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
    montar();
  }

  function vestir(i) {
    const eu = ctx.eu(); if (!eu) return;
    eu.sk = i; ctx.enviar({ t: "vestir", i });
    try { localStorage.setItem("festa-skin", String(i)); } catch {}
  }

  function montar() {
    if (l.hidden || compra || !catalogo) return;
    const eu = ctx.eu(), vestida = eu ? eu.sk : -1, u = ctx.arroba();
    l.innerHTML = `<button class="fechar" aria-label="Fechar">×</button><h2>👕 Skins da festa</h2><p class="sub">Teu boneco com estilo em todas as festas. É do teu @ pra sempre. Só muda o visual: não dá ponto.</p><div class="grade"></div><p class="msgL"></p>`;
    l.querySelector(".fechar").onclick = fechar;
    const g = l.querySelector(".grade");
    catalogo.forEach((s, i) => {
      const tem = minhas.includes(i), d = document.createElement("div");
      d.className = "sk" + (tem ? " tem" : "") + (tem && vestida === i ? " vest" : "");
      d.innerHTML = `<div class="ic">${s.icone}</div><div class="nm">${limpa(s.nome)}</div><button></button>`;
      const b = d.querySelector("button");
      if (tem) {
        b.textContent = !eu ? "✅ É tua" : vestida === i ? "Tirar" : "Vestir";
        b.onclick = () => { if (!eu) return; vestir(vestida === i ? -1 : i); montar(); };
      } else {
        b.textContent = venda ? `Comprar ${real(s.preco)}` : "Em breve"; b.disabled = !venda;
        b.onclick = () => pedirDados(i);
      }
      g.appendChild(d);
    });
    if (!u) msg("Escreve teu @ na tela de entrada pra comprar e ver as tuas skins.");
  }

  function pedirDados(i) {
    const s = catalogo[i], u = ctx.arroba();
    if (!u) { msg("Escreve teu @ primeiro (na tela de entrada)."); return; }
    let mail = ""; try { mail = localStorage.getItem("festa-email") || ""; } catch {}
    l.innerHTML = `<button class="fechar" aria-label="Voltar">×</button><div class="ic" style="font-size:54px">${s.icone}</div><h2>${limpa(s.nome)}</h2><p class="sub">Pro @<b>${limpa(u)}</b> · ${real(s.preco)} no Pix</p>
<input type="email" id="lojaMail" placeholder="teu e-mail (pro comprovante)" autocomplete="email"><label><input type="checkbox" id="lojaMaior"> Tenho 18 anos ou mais. Sei que a skin só muda o visual do boneco e não dá ponto.</label><button class="ok">Gerar Pix</button><p class="msgL"></p>`;
    $("lojaMail").value = mail;
    l.querySelector(".fechar").onclick = montar;
    l.querySelector(".ok").onclick = async (ev) => {
      const email = $("lojaMail").value.trim(), maior = $("lojaMaior").checked;
      if (!maior) { msg("A compra é só pra maiores de 18 anos."); return; }
      ev.target.disabled = true; msg("Gerando o Pix…");
      try {
        const r = await fetch(ROBO + "/skins/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ arroba: u, skin: s.id, email, maior }) });
        const d = await r.json();
        if (!r.ok) { msg(d.erro || "Não deu certo. Tenta de novo."); ev.target.disabled = false; return; }
        try { localStorage.setItem("festa-email", email); } catch {}
        compra = { ...d, i, nome: s.nome, icone: s.icone }; mostrarCompra();
        clearInterval(timer); timer = setInterval(conferir, 4000);
      } catch { msg("Sem conexão. Tenta de novo."); ev.target.disabled = false; }
    };
  }

  function mostrarCompra() {
    const c = compra; l.hidden = false;
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
    setMinhas(v) { minhas = v || []; montar(); },
    // ao entrar: veste a skin escolhida da última vez (se for dele); senão a que o servidor pôs
    aoEntrar() {
      const eu = ctx.eu(); if (!eu) return;
      try { const g = localStorage.getItem("festa-skin"); if (g !== null && (+g === -1 || minhas.includes(+g)) && +g !== eu.sk) vestir(+g); } catch {}
    },
  };
}
