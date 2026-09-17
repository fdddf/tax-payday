# Tax logic audit

Independently recomputed, not copied from the source files. A jury of Taxfix
employees will read this, so every figure below is stated with its provision.

## Verdict: consistent. Two notes, no blockers.

## Statutory figures

| Claim | Provision | Verdict |
|---|---|---|
| Arbeitnehmer-Pauschbetrag €1,230 | § 9a Satz 1 Nr. 1a EStG | **verified** — €1,230 since tax year 2023 (€1,200 in 2022, €1,000 before) |
| Entfernungspauschale €0.30 / €0.38 | § 9 Abs. 1 Nr. 4 EStG | **verified** — €0.30 for the first 20 km one way, €0.38 from the 21st km |
| Antragsgrenze €600 | § 39a Abs. 2 Satz 4 EStG | **verified** — amounts above the Pauschbetrag must exceed €600 to be registrable |
| Freibetrag registration, 2-year validity | § 39a EStG | **verified** — Lohnsteuer-Ermäßigungsverfahren |
| Four-year retroactive filing | § 169 AO · § 46 Abs. 2 Nr. 8 EStG | **verified** — 2022 return filable until 31 Dec 2026 |
| GWG immediate write-off, €800 threshold | § 6 Abs. 2 EStG | **verified** — all three Arbeitsmittel are below it |

## Arithmetic — recomputed independently

```
Pendlerpauschale   20 × €0.30 + 22 × €0.38 = €14.36/day × 200 = €2,872   ✓
Werbungskosten     2,872 + 3,900 + 332 + 220 + 180           = €7,504   ✓
− Pauschbetrag                                                −€1,230   ✓
= Freibetrag                                                   €6,274   ✓
  clears €600 Antragsgrenze                                      true   ✓
Monthly taxable reduction   6,274 / 12                        = €522.83 ✓
Monthly net    522.83 × 35%                                   = €183    ✓
Annual         183 × 12                                       = €2,196  ✓
Countdown      17 Sep → 31 Dec 2026                          = 105 days ✓
```

Receipt fixtures also reconcile: tuition 2 × €1,950 = €3,900; Arbeitsmittel
€189 + €89 + €54 = €332; Bewerbung €132 + €48 = €180.

## Note 1 — Solidaritätszuschlag wording *(fixed)*

`data/case-lena.json` described the 35% as "incl. Soli", but the payslip
fixture correctly carries `soli_monat: 0.00`. At €62,000 gross in Steuerklasse
I the Soli-Freigrenze is not reached, so no Soli is levied. Wording corrected —
the rate itself is unaffected.

## Note 2 — the 35% marginal rate is deliberately conservative

At €62,000 gross, Steuerklasse I, taxable income after social security and
Werbungskosten lands roughly in the low-to-mid €40,000s. The marginal rate
there is realistically **36–38%** under the § 32a tariff.

We model 35%. That **understates** the user's benefit, which is the safe
direction for a claim made on stage: the real monthly gain would be slightly
higher, not lower. If asked, say so — modelling conservatively is a defensible
choice, and the page recomputes live at any rate from 14% to 45%.

## What is modelled, not measured

One persona: Steuerklasse I, single, no church tax, Berlin, no children.
Married couples (Steuerklasse III/V/IV+Faktor), church-tax Länder and
Doppelte Haushaltsführung are out of scope for the prototype and would each
change the arithmetic.
