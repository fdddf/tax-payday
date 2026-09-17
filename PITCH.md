# Pitch — 2:30

Record screen + voice. Demo is `index.html`, advance with **Space**.
Rehearse once. Do not improvise on stage.

---

**0:00 — 0:20 · The problem**

> Germany has a hard filing deadline. Taxfix is brilliant for about three weeks
> a year, and then nobody opens it until next July.
> The reason isn't the product. It's that tax only ever asks you for something.
> It never gives you anything back until the very end.

**0:20 — 0:40 · The insight** *(slow down here — this is the whole pitch)*

> So we looked at what's actually happening. If you get a refund every year,
> you're not being rewarded. You've been overpaying every single month, and
> you're lending the state that money interest-free — on average for fourteen
> months.
> Tax Payday gives it back monthly instead.

**0:40 — 1:00 · The hook** *(screen: Act 1)*

> First we go find what's already yours. Germany lets you file four years back,
> so Lena's unclaimed 2022 refund — €2,417 — is still recoverable.
> But only until December 31st. That's not a deadline we invented to make her
> hurry. That's § 169 of the Abgabenordnung.

**1:00 — 1:40 · The demo** *(screen: Act 2 → Act 3)*

> Then we fix the cause. She uploads one payslip and five agents go to work.
> One parses it. One mines her receipts and commute. One validates every single
> position against the Einkommensteuergesetz — and that's the only agent allowed
> to cite law, so nothing reaches the calculator that we couldn't defend in an
> audit. One applies the thresholds in the right order. One turns it into money.
>
> *(Act 3 lands)*
>
> €183. Every month. First one on November 28th — not July 2027.
> Same €2,196. Fourteen months earlier.

**1:40 — 2:10 · The orchestration** *(screen: architecture.html, then eval/RESULTS.md)*

> Five agents, each with its own prompt and its own tools. The statute agent
> holds the only law-lookup tool, so the other four can't hallucinate law —
> they can't reach it. That separation is what makes the output auditable
> instead of just plausible.
>
> And we measured it. Two hundred labelled German transactions:
> **93% precision, 92% recall.**
>
> But the interesting number is underneath. On clear-cut cases we're at 97%.
> On the ambiguous ones, 54%. A keyword engine already handles the easy
> ninety-three percent — the agents earn their place entirely in the judgement
> calls.

**2:10 — 2:30 · The loop**

> No notifications. No streaks. No fake urgency.
> She comes back in November because there's money expiring. She comes back
> every month after that because her payslip is bigger and she can see it.
> That's Taxfix, twelve months a year.

---

## If the jury asks

**"Is the tax logic real?"**
Yes — § 39a EStG, and the order matters: the Pauschbetrag is automatic, so only
the excess is registrable, and that excess has to clear the €600 Antragsgrenze.
Figures are modelled for one persona; we'd recompute per user.

**"Isn't this just a reminder app?"**
The opposite. The deadline is statutory, and the recurring value is a bigger
payslip — not a notification.

**"What's hard about it?"**
Per-position statute validation. Anyone can guess a deduction; citing the
provision, scoring confidence and refusing to pass through what you can't defend
is the part that needs the agent separation.

**"How do you know it works?"**
`eval/RESULTS.md` — 200 labelled transactions, precision 93.0%, recall 91.7%,
F1 0.923, statute citation correct on 95.5% of true positives. Runs offline,
no API key: `node eval/run-eval.mjs`.

**"Where does it fail?"**
Mixed-use hardware, where the correct answer is a pro-rata split rather than a
boolean — we currently throw those away. And it wrongly allows "Anzug für das
Büro"; BFH GrS 1/16 bars business clothing. Both are in RESULTS.md. We'd rather
show you the failure modes than a single headline number.

## Checklist before 20:50

- [ ] Screen recording: full run, Space to advance, no cursor hunting
- [ ] Screenshot: architecture.html + `node eval/run-eval.mjs` output on screen
- [ ] Backup: artifact URL open in a second tab
- [ ] Upload by 20:50 — 21:00 is strict
