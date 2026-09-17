# Tax Payday

**Taxfix pays you monthly now, not yearly.**

---

## The problem

Germany's hard filing deadline compresses a year of product usage into a few
frantic weeks. Taxfix is indispensable for three weeks and then nobody opens it
until next July — because tax only ever asks you for something. It never gives
you anything back until the very end.

## The insight

If you get a refund every year, you are not being rewarded. You have been
**overpaying every month and lending the state that money interest-free** — on
average for fourteen months.

That one sentence produces both halves of the product.

## What we built

| | | Why they come back |
|---|---|---|
| **Recover** | Germany allows retroactive filing for four years. An unclaimed 2022 refund lapses on **31 Dec 2026**. | A statutory deadline, in Q4. We did not invent it. |
| **Redirect** | Register a Freibetrag under § 39a EStG and withholding drops on the **next payroll run** — €183/month instead of €2,196 next July. | Every payslip is visible proof it is still working. |

Working prototype: `index.html` — single file, no build, runs offline.
Three acts: the expiring refund, the agent pipeline, the live payday model.

**The Freibetrag arithmetic runs live in the page.** Drag the commute slider or
untick a position and the Freibetrag, the monthly net and the chart all
recompute. Push it below €600 and the UI refuses to register it, citing
§ 39a Abs. 2 Satz 4 — the threshold is implemented, not decorative.

## How we used agents

Five specialised agents, each with its own system prompt and its own tools
(`agents/run.mjs`):

```
payslip-parser        Lohnabrechnung  →  gross, Steuerklasse, marginal rate
expense-miner         receipts + commute  →  positions, with the arithmetic shown
statute-agent  [MCP]  each position  →  EStG citation, verdict, confidence
freibetrag-calculator § 9a Pauschbetrag first, then the § 39a Antragsgrenze
payday-simulator      Freibetrag  →  monthly net, first payroll run, ELSTER form
```

Two decisions worth a judge's attention:

**Only one agent may cite law.** `statute-agent` holds the sole `lookup_statute`
tool and is instructed never to cite a provision it has not retrieved.
Positions it will not defend never reach the calculator. The other four cannot
hallucinate law because they cannot reach it. That separation is what makes the
output auditable rather than merely plausible.

**Threshold order is not negotiable.** The Pauschbetrag is granted
automatically, so only the excess is registrable — and that excess must then
clear €600. Getting this backwards is the most common way to overstate a
Freibetrag, so it lives in its own agent with its own prompt.

The stage demo replays frozen agent output (`data/case-lena.json`) so it needs
no network. The pipeline is real and runnable.

## Verified, not asserted

`AUDIT.md` recomputes every figure independently and checks each provision.
All arithmetic reconciles. The 35% marginal rate is deliberately conservative —
the § 32a tariff gives roughly 36–38% at this income, so the prototype
understates the user's benefit rather than overstating it.

| Provision | Used for |
|---|---|
| § 9 Abs. 1 Nr. 4 EStG | Entfernungspauschale — €0.30 to 20 km, €0.38 beyond |
| § 9 Abs. 1 Nr. 6 EStG | Arbeitsmittel |
| § 9 Abs. 1 Nr. 3 EStG | Berufsverband dues |
| § 9 Abs. 1 Satz 1 EStG | Fortbildung, Bewerbungskosten |
| § 9a Satz 1 Nr. 1a EStG | Arbeitnehmer-Pauschbetrag €1,230 |
| § 39a Abs. 2 Satz 4 EStG | €600 Antragsgrenze |
| § 39a EStG | Lohnsteuer-Ermäßigungsverfahren |
| § 169 AO · § 46 Abs. 2 Nr. 8 EStG | Four-year retroactive filing window |

## Against the challenge

- **Outside filing season** — the value is a bigger payslip every month, and the deadline that brings users in is in December.
- **No notification theatre** — nothing here is a reminder. The only deadline is statutory.
- **No fake urgency** — § 169 AO set the date, not us.
- **Return loop** — she comes back in November because money is expiring, and every month after because her payslip is visibly bigger.

## Run it

```bash
open index.html                    # demo — no build, works offline
npm install && npm run agents      # the real pipeline (needs ANTHROPIC_API_KEY)
```

## Next

Steuerklasse III/V/IV+Faktor for couples, Doppelte Haushaltsführung, church-tax
Länder, and a real ELSTER submission path instead of a generated form.
