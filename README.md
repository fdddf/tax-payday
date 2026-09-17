# Tax Payday

**Taxfix pays you monthly now, not yearly.**

Taxfix challenge: build the feature that creates voluntary, recurring engagement
outside filing season.

---

## The insight

You are not waiting for a refund. You are **lending the state money interest-free**,
on average for fourteen months.

Two consequences, and the product is both of them:

| | What it does | Why they open the app |
|---|---|---|
| **Recover** | Germany allows retroactive filing for four years. An unclaimed 2022 refund lapses on **31 Dec 2026**. | A real statutory deadline. Not a manufactured one. |
| **Redirect** | Register a Freibetrag under § 39a EStG and withholding drops **next payroll run** instead of next July. | Every payslip is proof it is still working. |

The first one gets them in the door in Q4. The second one is why they come back
in month two — and month three.

## What this is not

No push notifications. No streaks. No manufactured deadlines. Every number on
screen is a euro amount tied to a provision you can look up, and the only
deadline is one the Bundesfinanzministerium set.

---

## Run it

```bash
open index.html          # the demo — single file, no build, works offline
```

The pipeline that produced the demo's numbers:

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run agents           # writes data/case-lena.json
```

---

## The five agents

```
payslip-parser        Lohnabrechnung  →  gross, Steuerklasse, marginal rate
expense-miner         receipts + commute  →  deductible positions with arithmetic
statute-agent  [MCP]  each position  →  EStG citation, verdict, confidence
freibetrag-calculator §9a Pauschbetrag, then §39a Antragsgrenze, in that order
payday-simulator      Freibetrag  →  monthly net, first payroll run, ELSTER form
```

Two design decisions worth the jury's attention:

**Only one agent may cite law.** `statute-agent` is the sole holder of the
`lookup_statute` tool and is instructed never to cite a provision it has not
looked up. Positions it will not defend never reach the calculator. That is
what makes every euro in the output auditable rather than plausible.

**Threshold order is not negotiable.** The Arbeitnehmer-Pauschbetrag is granted
automatically, so only the excess is registrable — and that excess must then
clear the €600 Antragsgrenze. Getting this backwards is the single most common
way to overstate a Freibetrag, so it lives in its own agent with its own prompt.

## Why the demo is pre-baked

Agent output is frozen into `data/case-lena.json` and replayed by `index.html`.
Identical on screen, immune to conference wifi, zero latency on stage. The
pipeline is real and runnable; it just is not in the critical path of a
three-minute pitch.

---

## Statutes relied on

| Provision | Used for |
|---|---|
| § 9 Abs. 1 Nr. 4 EStG | Entfernungspauschale — €0.30 to 20 km, €0.38 beyond |
| § 9 Abs. 1 Nr. 6 EStG | Arbeitsmittel |
| § 9 Abs. 1 Nr. 3 EStG | Berufsverband dues |
| § 9 Abs. 1 Satz 1 EStG | Fortbildung, Bewerbungskosten |
| § 9a Satz 1 Nr. 1a EStG | Arbeitnehmer-Pauschbetrag |
| § 39a Abs. 2 Satz 4 EStG | €600 Antragsgrenze |
| § 39a EStG | Lohnsteuer-Ermäßigungsverfahren |
| § 169 AO · § 46 Abs. 2 Nr. 8 EStG | Four-year retroactive filing window |

Euro figures are modelled for Steuerklasse I, €62,000 gross, Berlin, 35%
marginal rate. Indicative for a demo — recompute per user before anyone relies
on them.
