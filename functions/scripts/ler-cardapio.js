#!/usr/bin/env node
/**
 * Testa a leitura de cardápio por IA direto do terminal — sem front, sem
 * emulador, sem Firestore. Útil para comparar modelos e prompts.
 *
 *   npm --prefix functions run build
 *   node functions/scripts/ler-cardapio.js foto1.jpg [foto2.jpg ...]
 *
 * A chave e o perfil vêm de `functions/.env.local` (AI_API_KEY, AI_PROFILE) ou
 * do ambiente. Para trocar de modelo, edite `functions/src/ai/config/ai.config.json`
 * e rode o build de novo. `AI_PROFILE=mock` testa sem chave (cardápio de exemplo).
 */

/* eslint-disable @typescript-eslint/no-require-imports -- script CommonJS, roda direto no Node */

const fs = require("fs");
const path = require("path");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Carrega `functions/.env.local` sem sobrescrever o que já veio do ambiente. */
function loadEnvLocal() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) {
    return;
  }
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function readImage(file) {
  const mimeType = MIME_BY_EXT[path.extname(file).toLowerCase()];
  if (!mimeType) {
    throw new Error(`${file}: use JPEG, PNG ou WebP.`);
  }
  return { mimeType, base64: fs.readFileSync(file).toString("base64") };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function printResult({ menuName, items, discarded, usage }) {
  console.log(`\nCardápio: ${menuName ?? "(sem nome)"}`);

  const sections = new Map();
  for (const item of items) {
    const key = item.section ?? "(sem seção)";
    if (!sections.has(key)) {
      sections.set(key, []);
    }
    sections.get(key).push(item);
  }
  for (const [section, sectionItems] of sections) {
    console.log(`\n## ${section}`);
    for (const item of sectionItems) {
      console.log(`  ${brl.format(item.price).padStart(12)}  ${item.name}`);
    }
  }

  console.log(`\n${items.length} itens em ${sections.size} seções · ${discarded} descartados`);
  console.log(
    `${usage.model} · ${(usage.latencyMs / 1000).toFixed(1)}s · ` +
      `${usage.inputTokens} tokens de entrada / ${usage.outputTokens} de saída · ` +
      `custo real ${usage.providerCostUsd ?? 0} USD · no plano pago ~${usage.referenceCostUsd ?? "?"} USD`,
  );
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Uso: node functions/scripts/ler-cardapio.js foto1.jpg [foto2.jpg ...]");
    process.exit(1);
  }

  loadEnvLocal();

  let ai;
  try {
    ai = require("../lib/ai");
  } catch {
    console.error("Compile antes: npm --prefix functions run build");
    process.exit(1);
  }

  try {
    const reader = ai.MenuReaderClient.create({ usageSink: { record: async () => {} } });
    console.log(`Perfil: ${reader.profileName} · lendo ${files.length} foto(s)...`);
    printResult(await reader.readMenu(files.map(readImage)));
  } catch (error) {
    if (error instanceof ai.AiError) {
      console.error(`\nFalhou [${error.code}]: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main();
