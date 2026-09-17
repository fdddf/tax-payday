// ---------------------------------------------------------------------------
// Tax Payday — agent pipeline
//
// Five specialised agents turn one payslip into a registrable Freibetrag and a
// monthly net gain. Each agent has its own system prompt and its own tools; the
// Statute Agent is the only one allowed to touch the law, so every euro in the
// output carries a citation something else can check.
//
//   node agents/run.mjs --payslip data/payslip-lena.json
//
// Needs ANTHROPIC_API_KEY. Writes data/case-<name>.json, which index.html
// inlines — the stage demo replays that file and never calls a model live.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MODEL = "claude-sonnet-5";

const client = new Anthropic();
const STATUTES = JSON.parse(readFileSync(join(HERE, "statutes.json"), "utf8")).provisions;

// --- the one tool the Statute Agent gets -----------------------------------
// Stands in for an MCP server over the live EStG/AO text. Same shape, frozen
// corpus, so the pipeline is reproducible while we are on conference wifi.
const lookupTool = {
  name: "lookup_statute",
  description:
    "Search German income-tax law for the provision governing an expense. " +
    "Returns the citation, a summary and any statutory cap. Use this for every " +
    "position — never cite a provision you have not looked up.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Expense description, English or German." }
    },
    required: ["query"]
  }
};

function lookupStatute({ query }) {
  const q = query.toLowerCase();
  const hits = STATUTES.filter(
    p =>
      p.keywords.some(k => q.includes(k)) ||
      k_in(p.title, q) ||
      p.summary.toLowerCase().split(/\W+/).some(w => w.length > 5 && q.includes(w))
  );
  return (hits.length ? hits : STATUTES).slice(0, 4).map(p => ({
    cite: p.cite,
    title: p.title,
    summary: p.summary,
    cap: p.cap
  }));
}
const k_in = (title, q) => q.includes(title.toLowerCase().split(/\s|—/)[0]);

// --- agent runner -----------------------------------------------------------
// One turn-loop per agent. Tools resolve locally, the agent keeps going until
// it stops asking, and we parse the JSON object it leaves behind.
async function runAgent({ name, system, input, tools = [], handlers = {} }) {
  const t0 = Date.now();
  const messages = [{ role: "user", content: JSON.stringify(input, null, 2) }];
  let calls = 0;

  for (let turn = 0; turn < 12; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      tools,
      messages
    });

    if (res.stop_reason === "tool_use") {
      const results = res.content
        .filter(b => b.type === "tool_use")
        .map(b => {
          calls++;
          return {
            type: "tool_result",
            tool_use_id: b.id,
            content: JSON.stringify(handlers[b.name](b.input))
          };
        });
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) throw new Error(`${name}: no JSON in reply\n${text}`);

    console.log(
      `  ✓ ${name.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)}s` +
        (calls ? `  ${calls} tool calls` : "")
    );
    return JSON.parse(json[0]);
  }
  throw new Error(`${name}: exceeded turn limit`);
}

// --- the five agents --------------------------------------------------------
const PARSER = `You read German payslips (Lohnabrechnung).
Extract: monthly gross, annual gross, Steuerklasse, church-tax liability, and any
Freibetrag already registered. Estimate the marginal income-tax rate including
Solidaritätszuschlag for this income and tax class.
Reply with JSON only: {brutto_monat, brutto_jahr, steuerklasse, kirchensteuer,
existing_freibetrag, marginal_rate}.`;

const MINER = `You find deductible employment expenses (Werbungskosten) in a
user's receipts, commute profile and calendar.
Compute each amount from the underlying facts and show the arithmetic. Do not
cite law — that is another agent's job. Be conservative: if a position is
arguable, include it and mark confidence below 0.9.
Reply with JSON only: {positions: [{id, label, detail, amount, math, confidence}]}.`;

const STATUTE = `You are the only agent permitted to cite German tax law.
For every position you are given, call lookup_statute and decide whether the
provision it returns actually supports the claim. Never cite a provision you
have not looked up. Flag anything you would not defend in an audit.
Reply with JSON only: {validated: [{id, cite, verdict: "valid"|"review"|"reject",
reason}]}.`;

const CALC = `You apply German Freibetrag thresholds in the right order.
1. Sum the validated Werbungskosten.
2. Subtract the Arbeitnehmer-Pauschbetrag (§ 9a) — it is granted automatically,
   so only the excess is registrable.
3. Check the remainder against the Antragsgrenze (§ 39a Abs. 2 Satz 4).
State every intermediate figure.
Reply with JSON only: {werbungskosten_total, pauschbetrag, freibetrag,
antragsgrenze, antragsgrenze_passed}.`;

const SIM = `You turn a registrable Freibetrag into what the user actually feels.
Monthly taxable income falls by freibetrag/12; the net gain is that times the
marginal rate. Identify the first payroll run that can apply it, assuming the
tax office needs about three weeks.
Also state the counterfactual: without registration this same money arrives as a
refund after the annual assessment, roughly 14 months later.
Reply with JSON only: {monthly_taxable_reduction, monthly_net_gain,
annual_net_gain, first_payslip, counterfactual}.`;

// --- orchestration ----------------------------------------------------------
async function main() {
  const arg = process.argv.indexOf("--payslip");
  const path = arg > -1 ? process.argv[arg + 1] : "data/payslip-lena.json";
  const input = JSON.parse(readFileSync(join(ROOT, path), "utf8"));

  console.log(`\nTax Payday — 5-agent pipeline\n${"─".repeat(46)}`);

  const taxpayer = await runAgent({
    name: "payslip-parser", system: PARSER, input: input.payslip
  });

  const mined = await runAgent({
    name: "expense-miner", system: MINER,
    input: { receipts: input.receipts, commute: input.commute, calendar: input.calendar }
  });

  const checked = await runAgent({
    name: "statute-agent", system: STATUTE,
    input: mined.positions,
    tools: [lookupTool],
    handlers: { lookup_statute: lookupStatute }
  });

  // Only positions the Statute Agent would defend reach the calculator.
  const keep = new Set(
    checked.validated.filter(v => v.verdict !== "reject").map(v => v.id)
  );
  const positions = mined.positions
    .filter(p => keep.has(p.id))
    .map(p => ({ ...p, ...checked.validated.find(v => v.id === p.id) }));

  const calc = await runAgent({
    name: "freibetrag-calculator", system: CALC, input: { positions }
  });

  const payday = await runAgent({
    name: "payday-simulator", system: SIM,
    input: { freibetrag: calc.freibetrag, marginal_rate: taxpayer.marginal_rate }
  });

  const out = { taxpayer, expenses: positions, calculation: { ...calc, ...payday } };
  const dest = join(ROOT, "data", `case-${input.name ?? "run"}.json`);
  writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log(`${"─".repeat(46)}`);
  console.log(`Freibetrag  €${calc.freibetrag}`);
  console.log(`Monthly     +€${payday.monthly_net_gain}  from ${payday.first_payslip}`);
  console.log(`Written to  ${dest}\n`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
