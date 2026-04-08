# UK / EU software classification — checklist for legal counsel

This internal checklist supports **due diligence** (investors, regulators). It is **not legal advice**. A qualified regulatory lawyer should determine whether Diabeaters (or specific features) fall under **UK MDR**, **EU MDR**, wellness / lifestyle exemptions, or other regimes.

## 1. Intended purpose (document explicitly)

- [ ] **Primary stated purpose** of the product (e.g. lifestyle organisation, education, pattern tracking).
- [ ] **What the software does not claim** (diagnosis, cure, treatment decision without HCP oversight).
- [ ] **Per-feature** intended purpose for: meal bolus calculators, ratio tools, sick-day maths, bedtime corrections, hypo calculators, community, any server-side AI.

## 2. UK MDR / Software as a Medical Device (indicative questions)

- [ ] Does the software provide information for use in **diagnosis, prevention, monitoring, prediction, prognosis, treatment** of disease (Regulation 2 UK MDR)?
- [ ] Is the output **person-specific** and could it drive **therapeutic decisions** without a clinician in the loop?
- [ ] Are claims in **App Store / Play / website** consistent with the **non-device** positioning?

## 3. EU MDR / MDCG guidance

- [ ] Align product documentation with **MDCG** guidance relevant to SaMD (e.g. qualification, classification, clinical evaluation where applicable).
- [ ] If the app is **not** a medical device, ensure **labelling and advertising** do not imply CE marking or clinical claims.

## 4. Clinical decision support (CDS)

- [ ] For tools that output **insulin doses or ratios**, assess whether output is **advisory only** and **always** framed with care-team confirmation.
- [ ] Document **algorithm provenance** (e.g. 1800 rule as teaching aid) in a design file, separate from user-facing copy.

## 5. Actions for product team

- [ ] Maintain **version history** of safety-critical algorithms and prompts.
- [ ] **Post-market**: process for incident reporting if users report harm linked to misunderstanding of outputs.

**Owner:** [Assign product / regulatory lead]  
**Review cadence:** [Annual or when features change materially]
