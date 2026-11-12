# 2 Where to start: with or without an ISMS

You set the most important course on day one: do you build the AIMS on an existing information security management system (ISMS) under ISO/IEC 27001, or do you start without one? Both standards share the same high-level structure for management systems. Clauses 4 to 10 are therefore organized in much the same way, and a lot can be run jointly.

## Choosing the path

| Your situation | Path | What it means |
|---|---|---|
| ISMS under ISO/IEC 27001 is certified | **with ISMS** | You extend existing processes. The tool generates 13 supplementary sheets; for 11 templates the sheet replaces the separate document. |
| ISMS is in place and in use (at least one internal audit and one management review), but not certified | **with ISMS** | as above; use the quick gap check (D-00) to confirm that the core processes really run |
| ISMS documents exist but are not lived | **without ISMS** | Use the existing documents as raw material, but plan as if you had no ISMS. |
| No ISMS | **without ISMS** | You build the core processes alongside, kept lean: document control, internal audit, management review, corrective action. |

The AIMS Manager asks about your situation in the start interview and sets the path. You can change it later; the data you have entered is kept.

## What is reused

| Component | Path with ISMS | Path without ISMS | Kit |
|---|---|---|---|
| Document control (7.5) | existing rules apply, AI documents go into the register | lean rules on two pages and a register | D-26 |
| Internal audit (9.2) | one audit programme for both standards, AI topics added | separate programme, first audit before stage 1 | D-20 |
| Management review (9.3) | one meeting with agenda items for both standards | separate meeting, once a year | D-21 |
| Nonconformities and corrective action (10.2) | existing register | new register | D-22 |
| Risk method (6.1) | adopt scales and criteria, add impacts on people and society | new method, deliberately simple | D-06, D-07 |
| Inventory | AI inventory refers to the information asset inventory | stand-alone AI inventory | D-10 |
| Suppliers | add AI checklist questions and clauses | new supplier list for AI | D-16 |
| Competence, awareness, communication | AI content in existing training | new training plan and communication plan | D-17 |
| Incident management | AI incidents as a separate category | new reporting channels and incident communication | D-14 |
| Acceptable use | add AI rules or attach D-15 | D-15 as a separate policy | D-15 |

**New on both paths** are the parts that have no counterpart in an ISMS: AI policy (D-03), role first (D-24), impact assessment (D-08, D-09), statement of applicability for Annex A of ISO/IEC 42001 (D-11), life cycle (D-12) and data (D-13).

## Supplementary sheets instead of new documents

On the path with an ISMS, the kit provides 13 supplementary sheets (ID ending in `-EB`, folder 03). For 11 templates you receive only the sheet and no separate document; for D-03 and D-07 there are both, as the AI policy and the AI risk register remain documents of their own. A supplementary sheet lists the sections you add to your existing ISMS document, for example additional impact categories in the risk procedure or a channel for AI concerns in the role description. You keep one document per topic, and your document register hardly grows.

The **integration matrix D-23** shows for every clause and every control what you reuse, extend or create from scratch. It maps the Annex A controls of ISO/IEC 42001 to related controls in ISO/IEC 27001:2022. The mapping is a professional judgement, not a requirement of the standard. From it, the AIMS Manager calculates a reuse rate as a percentage.

## Reading ISO/IEC 42001 with ISMS experience

- **Clauses 4 to 10** are structured as in ISO/IEC 27001. New are mainly 4.1 (the organization's role for AI and the purpose of the AI systems) and 6.1.4 and 8.4 (impact assessment for individuals, groups and society).
- **Annex A** contains 38 controls in 9 groups. You decide on each one in the statement of applicability (D-11).
- **Annex B** gives implementation guidance for each control, much as ISO/IEC 27002 does for the controls of ISO/IEC 27001. Read it alongside the templates in steps 7 and 8.
- **Annex C** lists potential objectives and risk sources for AI, **Annex D** use across sectors and integration with other management systems.

## What the ISMS does not cover

An ISMS protects information. An AIMS governs what AI systems do to people and decisions. Three differences are worth knowing:

- **Different things to protect.** Besides confidentiality, integrity and availability, the AIMS deals with fairness, explainability, human oversight and impacts on affected people outside the organization.
- **Impact assessment.** Clause 6.1.4 calls for a separate assessment of impacts on individuals, groups and society. A data protection impact assessment covers this only in part; D-09 links the two.
- **Life cycle and data.** Even as a deployer you need to know how a system is tested, introduced, monitored and retired, and which data flows into it.

Keep information security risks in the ISMS register. In the AI risk register you only link to them instead of rating them twice. For attacks on AI systems themselves, the guidance standard ISO/IEC 27090:2026 has been available since October 2026; use it as an additional source of controls, especially for your own AI applications.
