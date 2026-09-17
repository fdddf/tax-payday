// ---------------------------------------------------------------------------
// Tax Payday — offline classification eval
//
//   node eval/run-eval.mjs            # summary
//   node eval/run-eval.mjs --errors   # + every misclassification
//
// Classifies each transaction in eval/transactions.json against the provisions
// in agents/statutes.json with a deterministic keyword/rule classifier, then
// scores it against the hand-written ground truth. No API key, no network, no
// dependencies — this is the number we can run on stage.
//
// The classifier here is the cheap baseline the LLM pipeline has to beat: it
// sees only merchant + German description and reasons purely on surface form.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const PROVISIONS = JSON.parse(
  readFileSync(join(ROOT, "agents", "statutes.json"), "utf8")
).provisions;
const TX = JSON.parse(readFileSync(join(HERE, "transactions.json"), "utf8"));

const citeOf = id => {
  const p = PROVISIONS.find(x => x.id === id);
  if (!p) throw new Error(`unknown provision id: ${id}`);
  return p.cite;
};

// --- rules ------------------------------------------------------------------
// Ordered; first match wins. `strong` rules survive the private-use veto
// because the wording itself already establishes the professional occasion.
const RULES = [
  { id: "EStG-9-1-3", strong: true,
    re: /gewerkschaft|berufsverband|ver\.di|ig metall|marburger bund|journalisten-verband|gew / },
  { id: "EStG-9-1-3",
    re: /mitgliedsbeitrag|jahresbeitrag|mitgliedschaft/ },

  { id: "EStG-9-1-4", strong: true,
    re: /arbeitsweg|wohnung–arbeitsstätte|wohnung-arbeitsstätte|pendel|jobticket|tätigkeitsstätte/ },
  { id: "EStG-9-1-4",
    re: /monatskarte|deutschlandticket|monatsabo öpnv|bvg|mvg|hvv/ },

  { id: "EStG-9-1-S1", strong: true,
    re: /fortbildung|weiterbildung|fachkonferenz|konferenzticket|kongress|zertifikatskurs|pflichtschulung|schulung|seminar/ },
  { id: "EStG-9-1-S1",
    re: /online-kurs|kurs |lernen|akademie|coursera|udemy|datacamp|linkedin learning|skillshare/ },
  { id: "EStG-9-1-S1", strong: true,
    re: /bewerbung|vorstellungsgespräch|bewirtung/ },
  { id: "EStG-9-1-S1", strong: true,
    re: /dienstreise|auswärtstätigkeit|beim kunden/ },

  { id: "EStG-9-1-6", strong: true,
    re: /fachbuch|fachliteratur|nachschlagewerk|kommentar|berufsbekleidung|sicherheitsschuhe|arztkittel|kittel|warnschutz|kochjacke/ },
  { id: "EStG-9-1-6",
    re: /schreibtisch|bürostuhl|aktenschrank|monitor|dockingstation|headset|tastatur|drucker|toner|aktenvernichter|ordner|büro|arbeitsplatz/ },
  { id: "EStG-9-1-6",
    re: /laptop|notebook|tablet/ },

  // generic professional-causation clause, last resort
  { id: "EStG-9-1-S1",
    re: /beruflich|dienstlich|homeoffice/ }
];

// Wording that points at private living expenses (§ 12 Nr. 1 EStG).
const PRIVATE_VETO =
  /\bprivat|urlaub|freunde|familie|geburtstag|wochenende|hobby|anfänger|fitness|sportclub|spende|förder|lebensmittel|wocheneinkauf|haushalt|kinder|miete|medikament|rezept/;

function classify(tx) {
  const text = `${tx.merchant} ${tx.description_de}`.toLowerCase();
  const veto = PRIVATE_VETO.test(text);
  for (const r of RULES) {
    if (!r.re.test(text)) continue;
    if (veto && !r.strong) {
      return { deductible: false, statute: null, rule: r.re.source, vetoed: true };
    }
    return { deductible: true, statute: citeOf(r.id), rule: r.re.source, vetoed: false };
  }
  return { deductible: false, statute: null, rule: null, vetoed: veto };
}

// --- score ------------------------------------------------------------------
let tp = 0, fp = 0, tn = 0, fn = 0, statuteRight = 0;
const errors = [];

for (const tx of TX) {
  const pred = classify(tx);
  const gt = tx.ground_truth;
  if (pred.deductible && gt.deductible) {
    tp++;
    if (pred.statute === gt.statute) statuteRight++;
    else errors.push({ tx, pred, kind: "WRONG STATUTE" });
  } else if (pred.deductible && !gt.deductible) {
    fp++;
    errors.push({ tx, pred, kind: "FALSE POSITIVE" });
  } else if (!pred.deductible && gt.deductible) {
    fn++;
    errors.push({ tx, pred, kind: "FALSE NEGATIVE" });
  } else {
    tn++;
  }
}

const div = (a, b) => (b === 0 ? 0 : a / b);
const precision = div(tp, tp + fp);
const recall = div(tp, tp + fn);
const f1 = div(2 * precision * recall, precision + recall);
const accuracy = div(tp + tn, TX.length);
const pct = x => (100 * x).toFixed(1) + "%";

const amb = TX.filter(t => t.ambiguous);
const ambWrong = amb.filter(t => classify(t).deductible !== t.ground_truth.deductible).length;
const clear = TX.filter(t => !t.ambiguous);
const clearWrong = clear.filter(t => classify(t).deductible !== t.ground_truth.deductible).length;

console.log(`
Tax Payday — Werbungskosten classification eval
===============================================
transactions      ${TX.length}
deductible (truth)${String(TX.filter(t => t.ground_truth.deductible).length).padStart(4)}  (${pct(div(TX.filter(t => t.ground_truth.deductible).length, TX.length))})
classifier        deterministic keyword/rule, ${RULES.length} rules over ${PROVISIONS.length} provisions

Confusion matrix (positive class = deductible)
                      pred: deductible   pred: not
  truth: deductible   ${String(tp).padStart(12)}   ${String(fn).padStart(9)}
  truth: not          ${String(fp).padStart(12)}   ${String(tn).padStart(9)}

Precision         ${pct(precision)}   (${tp}/${tp + fp} claimed deductions are real)
Recall            ${pct(recall)}   (${tp}/${tp + fn} real deductions found)
F1                ${f1.toFixed(3)}
Accuracy          ${pct(accuracy)}   (${tp + tn}/${TX.length})

Statute citation  ${pct(div(statuteRight, tp))}   (${statuteRight}/${tp} true positives cite the right §)

Breakdown
  clear-cut cases     ${clear.length - clearWrong}/${clear.length} correct  (${pct(div(clear.length - clearWrong, clear.length))})
  ambiguous cases     ${amb.length - ambWrong}/${amb.length} correct  (${pct(div(amb.length - ambWrong, amb.length))})
`);

const byKind = k => errors.filter(e => e.kind === k);
console.log("Errors by type");
for (const k of ["FALSE POSITIVE", "FALSE NEGATIVE", "WRONG STATUTE"]) {
  console.log(`  ${k.padEnd(16)} ${byKind(k).length}`);
}

if (process.argv.includes("--errors")) {
  console.log("\nMisclassifications\n------------------");
  for (const e of errors) {
    console.log(
      `[${e.kind}] ${e.tx.id}  ${e.tx.merchant} — ${e.tx.amount_eur} EUR${e.tx.ambiguous ? "  (ambiguous)" : ""}\n` +
        `  "${e.tx.description_de}"\n` +
        `  truth: ${e.tx.ground_truth.deductible ? "deductible" : "not deductible"}` +
        `${e.tx.ground_truth.statute ? " / " + e.tx.ground_truth.statute : ""}\n` +
        `  pred : ${e.pred.deductible ? "deductible" : "not deductible"}` +
        `${e.pred.statute ? " / " + e.pred.statute : ""}` +
        `${e.pred.rule ? "  [rule /" + e.pred.rule.slice(0, 48) + "/]" : ""}` +
        `${e.pred.vetoed ? "  [private-use veto]" : ""}\n`
    );
  }
}
