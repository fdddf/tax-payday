// ---------------------------------------------------------------------------
// Tax Payday — Lohnabrechnung PDF → payslip JSON
//
// Extracts text from a German payslip (DATEV / Lexware / SAP layouts), then
// asks Claude to return the same shape as data/payslip-lena.json.
//
//   node agents/parse-pdf.mjs [path-to.pdf]
//   npm run parse
//
// Needs ANTHROPIC_API_KEY. Writes JSON to stdout.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MODEL = "claude-sonnet-5";

const SAMPLE = join(ROOT, "fixtures", "payslip-sample.pdf");

const SYSTEM = `You extract structured fields from German Lohnabrechnung (payslip) text.

Layouts you will see — DATEV Lohn und Gehalt, Lexware lohn+gehalt, SAP HCM/PY.
Labels are not stable. Map aliases to the canonical keys below. Never invent
figures that are not on the slip; if a field is absent, use null for strings
and 0 for amounts.

Canonical output (JSON only, no markdown):
{
  "name": "<lowercase given name slug, e.g. lena>",
  "payslip": {
    "arbeitgeber": "<company, city if present>",
    "zeitraum": "<MM/YYYY>",
    "bruttogehalt_monat": <number>,
    "steuerklasse": "<I|II|III|IV|V|VI>",
    "kirchensteuer": <true|false>,
    "bundesland": "<German state name>",
    "lohnsteuer_monat": <number>,
    "soli_monat": <number>,
    "sozialversicherung_monat": <number>,
    "freibetrag_eingetragen": <number>
  }
}

Field mapping
-------------
bruttogehalt_monat (monthly gross to employee, before tax/SV):
  DATEV:  "Gesamtbrutto", "Gesamt-Brutto", "Brutto gesamt"
  Lexware: "Bruttoverdienst", "Bruttolohn", "Gesamt-Brutto"
  SAP:    "Gesamtbrutto", wage type /559 or heading "Brutto"
  Prefer Gesamtbrutto / Bruttoverdienst over "Steuerbrutto" / "steuerpflichtiges
  Brutto" / "St-Brutto". Steuerbrutto excludes some tax-free allowances (e.g.
  VWL, certain Zuschläge) and is the wrong headline salary.
  Do not use "Auszahlungsbetrag", "Netto", "Auszahlung", "Überweisung",
  "Verdienst netto" — those are net.

steuerklasse:
  "Steuerklasse", "StKl", "St-Klasse", "St.Kl.", "Steuerkl.", ELStAM block.
  Normalise 1–6 to Roman I–VI.

kirchensteuer:
  true if KiSt / Kirchensteuer amount > 0 or Konfession/Religion is ev, rk, kath,
  luth (not "--", "vd", "keine", "konfessionslos").

bundesland:
  From ELStAM, "Finanzamt", "Beschäftigungsort", "Betriebssitz", or address.
  Employer city Potsdam does not imply Brandenburg if the slip names Berlin
  as the tax state / Wohnsitzland.

lohnsteuer_monat:
  "Lohnsteuer", "LSt", "Lohnst.", not "Jahreslohnsteuer". Employee-side monthly.

soli_monat:
  "Solidaritätszuschlag", "SolZ", "Soli". 0 is valid (Freigrenze).

sozialversicherung_monat:
  Employee share only (AN), never AG/Arbeitgeberanteil.
  DATEV: "SV-Beiträge AN", "gesetzliche Abzüge" SV block sum, KV+RV+AV+PV AN.
  Lexware: "Sozialversicherung", "SV-Abzüge".
  SAP: "/110" employee SI or "SV-AN" total.
  If only the four branches are listed, sum KV + RV + AV + PV (AN column).
  Ignore U1/U2/U3, insolvency, and employer KV/RV.

freibetrag_eingetragen:
  "Freibetrag", "Jahresfreibetrag", "ELStAM-Freibetrag", "eingetragener Freibetrag",
  "Freibetrag monatlich" (×12 if the slip is clearly monthly). 0 if blank.

zeitraum:
  "Abrechnungszeitraum", "Abrechnungsmonat", "Monat", "Zeitraum", "für".
  Normalise to MM/YYYY.

arbeitgeber:
  "Arbeitgeber", "Firma", "Unternehmen", DATEV header company line.

Numbers: German "1.043,15" and "1043.15" both appear. Return JSON numbers
(1043.15). Round to 2 decimal places.`;

function resolvePdfPath(arg) {
  if (!arg) return SAMPLE;
  return isAbsolute(arg) ? arg : join(ROOT, arg);
}

function layoutHint(text) {
  const t = text.toLowerCase();
  if (t.includes("datev")) return "DATEV";
  if (t.includes("lexware")) return "Lexware";
  if (/\bsap\b/.test(t) || t.includes("sap hcm") || t.includes("wage type")) return "SAP";
  return "unknown";
}

async function pdfToText(buf) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return joined.replace(/\u0000/g, "").trim();
}

function parseJsonObject(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`parse-pdf: no JSON in model reply\n${raw}`);
  return JSON.parse(match[0]);
}

async function extractPayslip(text, fileName) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Vendor guess: ${layoutHint(text)}\nSource file: ${fileName}\n\n--- Lohnabrechnung text ---\n${text}`
      }
    ]
  });
  const raw = res.content.filter(b => b.type === "text").map(b => b.text).join("");
  return parseJsonObject(raw);
}

async function main() {
  const path = resolvePdfPath(process.argv[2]);
  const buf = readFileSync(path);
  const text = await pdfToText(buf);
  if (!text) {
    throw new Error(`parse-pdf: no extractable text in ${path} (image-only PDF?)`);
  }

  const out = await extractPayslip(text, path);
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
