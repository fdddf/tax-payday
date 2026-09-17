# Werbungskosten classification — measured accuracy

Run it yourself, offline, no API key:

```
node eval/run-eval.mjs            # summary
node eval/run-eval.mjs --errors   # every misclassification, with the rule that fired
```

## What was measured

- **Set:** `eval/transactions.json` — 200 German consumer/employee transactions dated 2026, each with merchant, amount, date and a German description.
- **Ground truth:** hand-written per expense category from German tax law (§ 9 EStG for Werbungskosten, § 12 Nr. 1 EStG for the private-living-expense bar). 72 of 200 (36.0%) are genuinely deductible. 13 are flagged `ambiguous` — mixed-use equipment, employee Bewirtung, workplace meals, grooming with a job occasion.
- **Classifier:** deterministic keyword/rule engine in `eval/run-eval.mjs`. 12 ordered rules mapped onto the provision IDs in `agents/statutes.json`, plus a private-use veto that the "strong" rules override. No model, no network — this is the baseline the LLM pipeline has to beat, and the number that runs on stage.

## Headline numbers

| Metric | Value |
| --- | --- |
| **Precision** | **93.0%** (66/71) |
| **Recall** | **91.7%** (66/72) |
| **F1** | **0.923** |
| Accuracy | 94.5% (189/200) |
| Statute citation accuracy | 95.5% (63/66 true positives cite the correct §) |

### Confusion matrix (positive class = deductible)

|  | pred: deductible | pred: not |
| --- | --- | --- |
| **truth: deductible** | 66 (TP) | 6 (FN) |
| **truth: not** | 5 (FP) | 123 (TN) |

### Where the errors live

| Slice | Correct |
| --- | --- |
| Clear-cut cases (187) | 182 — 97.3% |
| Ambiguous cases (13) | 7 — 53.8% |

Nearly half the total error mass sits in 6.5% of the data. On unambiguous expenses a keyword rule engine is already at 97%; everything left is judgement, which is exactly the part the agent pipeline is supposed to earn its keep on.

## The 5 most interesting misclassifications

**1. TX-073 / TX-131 / TX-179 — mixed-use hardware, €1,004–€1,544 (false negatives, ambiguous)**
"Notebook für Arbeit im Homeoffice, wird abends auch privat genutzt." The private-use veto fires on `privat` and kills the `laptop|notebook|tablet` rule outright. Real law is not binary here: a mixed-use Arbeitsmittel is deductible *pro rata* under § 9 Abs. 1 Nr. 6 EStG on an objective apportionment. The rule engine has no concept of a percentage, so it throws away the largest single deductions in the set — three items worth €3,794 in claims. This is the strongest argument for the LLM pipeline: the correct output is not a label, it is a split.

**2. TX-035 / TX-106 — "Anzug für das Büro", €256 and €410 (false positives)**
The Arbeitsmittel rule matches on `büro`. But bürgerliche Kleidung is not deductible even when bought purely for work — the Großer Senat closed that door (BFH GrS 1/16), and only typische Berufskleidung (the Sicherheitsschuhe and Arztkittel rows in this set) qualifies. A keyword classifier cannot tell "Büro" the workplace from "Büro" the business-formal dress code. This is the most expensive kind of error in production: a confident, cited, wrong deduction that the Finanzamt strikes.

**3. TX-116 / TX-158 — Lohnsteuerhilfeverein annual fee (wrong statute)**
"Jahresbeitrag Lohnsteuerhilfeverein, Ermittlung der Einkünfte aus nichtselbständiger Arbeit." The deductible/not call is right, but `jahresbeitrag` routes it to § 9 Abs. 1 Nr. 3 EStG (Berufsverband dues) when it belongs under the general clause, § 9 Abs. 1 Satz 1, as a cost of determining employment income. Same failure at TX-061 (Diensthaftpflicht for a teacher). The word "Beitrag" is doing all the work and it is not enough — three of our three statute errors come from this one token.

**4. TX-196 — "Arbeitsessen mit Kunden nach Projektabnahme, Beleg mit Teilnehmerangabe", €268 (false negative, ambiguous)**
The rules catch the literal word `bewirtung` but not a described Bewirtung. The transaction states both conditions the law cares about — business occasion and a receipt naming the participants — and is deductible for an employee (at 70%). Meanwhile the sibling rows that *do* say "Bewirtung" are classified correctly. The classifier is matching vocabulary, not facts.

**5. TX-062 — "Haarschnitt vor Vorstellungsgespräch", €77 (false positive, ambiguous)**
`vorstellungsgespräch` was added to the Bewerbungskosten rule because genuine application costs (photos, printing, portfolio binding) are deductible whether or not the application succeeds. A haircut is not: Körperpflege stays private no matter the occasion. The rule is right about the interview and wrong about the haircut, and there is no keyword that separates them — the distinction is between the *application process* and the *person*.

## Honest limitations

- Ground-truth labels are assigned per expense category (template), so transactions in the same category share reasoning text. The classifier never sees the category, only merchant + description, but this does mean the 200 rows represent roughly 40 distinct legal situations rather than 200.
- Merchant and description are drawn independently within a category, so a few rows pair an odd merchant with a plausible description (e.g. TX-092, a job-search subscription billed under a photo studio). This does not affect the labels or the classifier's inputs in any load-bearing way, but the pairs are not all individually realistic.
- Only the four Werbungskosten provisions in `agents/statutes.json` are in play. Expenses that are really Sonderausgaben or außergewöhnliche Belastungen (childcare, medication, donations) are labelled non-deductible *as Werbungskosten*, which is correct for this pipeline but is not the whole of the taxpayer's return.
- Amounts are not evaluated. The eval scores the deductible/not decision and the citation, not the euro figure or any cap under § 9a or § 39a.
