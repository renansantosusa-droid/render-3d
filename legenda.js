// palavras com o tempo de inicio (whisper do video original, 7 primeiros segundos)
export const PALAVRAS = [
  ["Se", 0.02], ["Você", 0.12], ["Cavar", 0.37], ["Um", 0.68], ["Buraco", 0.80],
  ["No", 1.23], ["Seu", 1.30], ["Quintal", 1.49], ["E", 1.99], ["Enchê-lo", 2.22],
  ["De", 2.91], ["Água", 3.11], ["Terá", 3.73], ["Uma", 4.08], ["Piscina", 4.35],
  ["Mas", 5.08], ["Na", 5.45], ["Manhã", 5.60], ["Seguinte", 5.97], ["A", 6.76], ["Água", 6.78],
];

export function montarLegenda(lista = PALAVRAS) {
  const el = document.createElement("div");
  el.id = "legenda";
  document.body.appendChild(el);
  const st = document.createElement("style");
  st.textContent = `
    #legenda{position:absolute;left:0;right:0;top:40%;text-align:center;
      font:900 78px 'Nunito',sans-serif;color:#fff;letter-spacing:.5px;
      -webkit-text-stroke:3px #111;paint-order:stroke fill;
      text-shadow:0 5px 0 rgba(0,0,0,.55),0 0 18px rgba(0,0,0,.35);pointer-events:none}`;
  document.head.appendChild(st);
  return (t) => {
    let atual = null;
    for (const p of lista) if (t >= p[1]) atual = p;
    if (!atual) { el.textContent = ""; return; }
    el.textContent = atual[0];
    const k = Math.min(1, (t - atual[1]) / 0.09); // pop de entrada
    el.style.transform = `scale(${0.8 + 0.2 * (1 - Math.pow(1 - k, 3))})`;
  };
}
