# 1 What a Minimal Viable AIMS is (and what it is not)

An AIMS (AI management system) is the management system under ISO/IEC 42001: it sets out how your organization selects, introduces, operates and monitors AI systems. It works like ISO 9001 or ISO/IEC 27001: policy, roles, risks, objectives, operation, audit, review, improvement. What is new are the AI topics: impacts on people, transparency, data, human oversight and suppliers of AI.

A **Minimal Viable AIMS** is the smallest version of this system that meets three conditions:

1. **Complete:** it covers every requirement in clauses 4 to 10 and takes a justified decision on every control (a single measure from the catalogue in the standard). The catalogue is Annex A of the standard, a menu to choose from. You record your decisions in the statement of applicability (SoA for short, the list of all controls with your reasons).
2. **Fit for purpose:** it describes your actual AI systems, not those of a model company.
3. **Viable:** it runs as part of daily work, produces evidence along the way and survives its first year.

Minimal therefore means as little paperwork and as few meetings as possible, but no gap in what the standard asks for. Viable means the system keeps running once the project team is back in day-to-day business.

## What a Minimal Viable AIMS is not

- **Not a binder for the auditor.** An auditor checks whether you do what you have written down. A policy without evidence earns you a finding, not a shortcut.
- **Not a parallel world next to the ISMS.** If you have an ISMS (an information security management system under ISO/IEC 27001), you do not build a second management system beside it. Document control, internal audit, management review and corrective action run jointly.
- **Not a stopgap.** Minimal does not mean incomplete. An excluded control needs a justification that holds up in an audit.
- **Not a legal opinion.** ISO/IEC 42001 shows that you manage AI in an orderly way. Whether you meet the obligations of the EU AI Act is a question the standard does not answer (chapter 7).
- **Not a project with an end date.** The certificate is valid for three years and requires annual surveillance audits. The AIMS has to keep running in cycles, not just until the audit.

## Where the road leads: certification, stage 1 and stage 2

Certification is voluntary: no law requires it. It serves as proof to customers and partners that your AIMS has been audited. A certification body, an independent and recognized firm, carries out the audit in two stages. The stage 1 audit is the first stage: the body reviews your documents, your scope and your readiness. The stage 2 audit is the second stage: the body checks that in daily work you really do what you have defined, and then issues the certificate. This kit takes you to readiness for the stage 1 audit. The stage 2 audit follows later, once your system is running in daily work and evidence exists (chapter 8).

## The first day: three steps, about 60 minutes

You do not have to read the whole kit on the first day. Three steps are enough:

1. **Read (about 20 minutes):** this chapter and, in chapter 2, the table ‘Choosing the path’.
2. **Complete the start interview (about 30 minutes):** open the AIMS Manager (the tool in this kit that runs in the browser). Answer the questions on your company, ISMS, EU AI Act, responsibility and target date. The AIMS Manager calculates your plan from them.
3. **Inform senior management (about 10 minutes):** send a short message with the plan and agree a date for step 1 ‘Mandate and starting point’ (chapter 3).

**When you may stop:** as soon as the start interview is complete and the date with senior management is set. The AIMS Manager remembers where you are, so you can carry on at any time.

**What falls away on the first day:** you need chapters 4 to 11 only later. Of chapter 3, step 1 is enough.

## The five guiding principles

The kit follows five guiding principles. They help you decide, at every turn, whether something is really needed.

| Principle | What it means | Where in the kit |
|---|---|---|
| 1 Minimal Viable AIMS, no governance overkill | Every document has a link to the standard or a clear benefit. Short documents, few committees, one responsible person with a deputy. | all templates, checks in the tool |
| 2 Integration, not a parallel world | The AIMS reuses ISMS processes. Supplementary sheets instead of new documents. | D-23, supplementary sheets (folder 03) |
| 3 From the AI inventory to the statement of applicability | First record all AI systems, including SaaS AI and shadow AI (AI tools that employees use without approval), then assess risks and impacts, then choose controls based on risk. | D-10, D-07, D-09, D-11 |
| 4 Role first | For each system, clarify whether you are a provider (you develop a system or have one developed, and place it on the market or put it into service under your own name or brand) or a deployer (you use someone else's system in a professional context) under the EU AI Act. Obligations and the extent of the controls depend on it. | D-24, module E-01 to E-09 |
| 5 Practical kit | Templates, tool and AI assistant work with the same IDs. The standard is the only thing you buy. | whole kit |

## The typical picture in an SME

Organizations with 50 to 500 employees rarely develop their own AI models. They use AI they have bought: Microsoft 365 Copilot, ChatGPT or another chat tool, AI features in the ERP, the CRM, the HR software or the translation service. On top of that comes shadow AI that employees use without approval.

For the AIMS this means:

- You are usually a **deployer** (you use a system someone else built). The controls on the development life cycle (A.6) and on training data (A.7) stay lean, because the supplier carries them. You ask the supplier for the information you need.
- The focus is on the **inventory, rules of use, suppliers, transparency, human oversight and competence**.
- Your own AI product or a chatbot under your own name makes you the **provider** of that system (Art. 3(3) of the AI Act). A fine-tuned model can change your role: check this under Art. 3(3) and, for high-risk AI, under Art. 25(1). If you are a provider, the extended level of templates D-12 and D-13 applies.

The tool knows this distinction. For pure deployers it proposes a lean implementation and shows the extended level only if you develop yourself.

## What the kit contains

| Component | Content |
|---|---|
| Templates | 26 core templates D-00 to D-27 (Word and Excel), 13 supplementary sheets for the path with an ISMS |
| EU AI Act module | 9 templates E-01 to E-09, optional, with the legal texts as PDF |
| NIST AI RMF module | 4 templates N-01 to N-04, optional, with additional controls RMF-xx and the three NIST documents as PDF (chapter 10) |
| AIMS Manager | The tool in this kit: it runs offline in the browser and guides you through the build with a step-by-step Guide, checks and a document generator |
| AI assistant | skill for Claude and ChatGPT/Codex with 12 modes, optional |
| Examples | Muster Maschinenbau AG (with ISMS, with module, extended scope with three in-house developments, one high-risk system and two companies: guide value about 6 months), Beispiel Präzisionsteile GmbH (without ISMS, small scope, AIMS lead with a low time commitment: well over 150 days) |
| Guide and poster | this document and ‘AIMS on one page’ in A3 format |

The kit is fully usable without AI. The AIMS Manager takes you through the same 10 steps as this guide and generates your documents from your answers. The AI assistant speeds things up; it does not replace any step.

**What you need to buy:** the standard ISO/IEC 42001 (from SNV, DIN or ISO). The kit contains no text from the standard. Every template names the clauses to read in your copy of the standard. For each control in Annex A, Annex B of the standard gives implementation guidance, much as ISO/IEC 27002 does for the controls of ISO/IEC 27001. ISO/IEC 42005 on impact assessment is helpful but not required.
