// Protótipo da loja: monta o kit indo em cada aba (sem aba Kit).
import fs from "node:fs";
import { chromium } from "playwright";
const URL_ = "https://brasildaturma.online/loja-teste/?u=turma.teste", OUT = "fotos-site";
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => m.type() === "error" && erros.push(m.text()));
const foto = (n) => pg.screenshot({ path: `${OUT}/${n}.png` });
await pg.goto(URL_ + "&v=" + Date.now()); await pg.waitForTimeout(3000); await pg.tap("#girar");
console.log("abas:", (await pg.$$eval(".abas button", (b) => b.map((x) => x.textContent))).join(" | "));
await pg.tap('[data-uf="PE"]'); await pg.waitForTimeout(300); await foto("1-camisa");
await pg.tap('[data-a="acess"]'); await pg.tap('[data-ac="coroa"]'); await pg.waitForTimeout(300); await foto("2-acess");
await pg.tap('[data-a="aura"]'); await pg.tap('[data-aura="fogo"]'); await pg.waitForTimeout(1500); await foto("3-aura");
console.log("dica:", await pg.textContent(".kitdica"), "| carrinho:", await pg.textContent("#resumo"), await pg.textContent("#preco"));
console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erro de JavaScript");
await nav.close();
