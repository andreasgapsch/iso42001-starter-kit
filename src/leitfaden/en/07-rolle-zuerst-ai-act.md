# 7 Role first and the EU AI Act in brief

Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence (EU AI Act) ties almost all obligations to two questions: what **role** do you have for an AI system, and which **risk class** does it fall into? That is why the guiding principle is called ‘role first’. The information here is based on the consolidated version of 27/07/2026. It is a professional assessment, not legal advice.

## The roles

| Role | Who that is | Typical in an SME |
|---|---|---|
| Provider | develops an AI system or has it developed and places it on the market or puts it into service under its own name or trademark | own product with AI, chatbot under its own name |
| Deployer | uses an AI system under its own authority in a professional context | Copilot, chat tools, AI in the ERP or HR software |
| Importer, distributor | places an AI system from a third country on the EU market or makes it available there | trading in software or devices |
| Product manufacturer | places a product with an AI component on the market under its own name or trademark | mechanical engineering, medical devices |

**Change of role (Art. 25).** A deployer becomes the provider of a high-risk system if it puts its own name or trademark on it, makes a substantial modification or uses it for a new intended purpose that makes it high-risk. Check this with every change.

<!-- abb:rollenbaum -->

## What applies from when

<!-- aiactfristen -->

The amending regulation of 2026 postponed the deadlines for high-risk AI. Check the current status before important decisions; E-09 in the module gives the date of the status and the references.

**For deployers in an SME, what matters today is mainly:** no prohibited practices, AI literacy actions, disclosure of deep fakes and of AI texts on matters of public interest, and informing people about emotion recognition or biometric categorization (Art. 50(3), (4)), and from December 2027 the deployer obligations if a system is high-risk (Art. 26). Notices for chatbots and machine-readable marking of generated content (Art. 50(1), (2)) bind the provider; whoever offers a chatbot under their own name is a provider. The fundamental rights impact assessment (Art. 27) only concerns bodies governed by public law, private entities providing public services, and deployers of certain systems for creditworthiness and for life or health insurance.

## The Swiss perspective

The EU AI Act also applies to organizations in Switzerland if they place an AI system on the market or put it into service in the EU, or if the output of the system is used in the EU (Art. 2). Using AI only in Switzerland without any link to the EU is not covered. Swiss providers of high-risk AI need an authorised representative in the EU.

Switzerland itself has no dedicated AI act. The Federal Council intends to ratify the Council of Europe Framework Convention on AI and to make the necessary legislative amendments sector by sector where possible. The Federal Department of Justice and Police is to submit the consultation draft to the Federal Council by the end of 2026 (Federal Council statement of 20/05/2026 on interpellation 26.3414, parlament.ch, retrieved on 07/11/2026); in principle, the draft is also to provide obligations for private parties where fundamental rights apply between private parties. The federal SME portal expects the consultation draft in spring 2027 (kmu.admin.ch, 23/09/2026). The consultation has not been opened as of 07/11/2026. The Federal Act on Data Protection already applies to AI that processes personal data.

## Map of the frameworks from a Swiss perspective

Around AI you meet laws, standards and frameworks. They answer different questions and sit side by side. The map is therefore deliberately **not a pyramid**: none of the frameworks builds on another, and none replaces another. A certificate under ISO/IEC 42001 fulfils neither the AI Act nor data protection law; conversely, no law requires a certificate.

<!-- abb:landkarte -->

| Framework | Type | Question it answers | Relevant for you | In the kit |
|---|---|---|---|---|
| EU AI Act, Regulation (EU) 2024/1689 | EU law | Which obligations do I have for each AI system? | with a link to the EU (Art. 2) | D-24, EU AI Act module |
| Federal Act on Data Protection (FADP), GDPR | Swiss and EU law | May I process this personal data with AI? | FADP for any processing of personal data, GDPR with a link to the EU | D-09, D-13 |
| Council of Europe Framework Convention on AI | international law | How does the state protect human rights, democracy and the rule of law when AI is used? | not directly yet; ratification planned, legislative amendments in preparation | monitor |
| ISO/IEC 42001 | standard, certifiable | Do we manage AI in an orderly and demonstrable way? | voluntary, often requested by customers | whole kit |
| ISO/IEC 27001 | standard, certifiable | Do we protect our information? | voluntary | path with an ISMS, D-23 |
| ISO/IEC 27090 | guidance, not certifiable | How do we protect AI systems against attacks? | voluntary | source of controls (chapter 2) |
| NIST AI RMF | voluntary US framework | Which outcomes do we achieve in managing AI risk, and how do we measure them? | voluntary, often at the request of US customers | NIST AI RMF module (chapter 10) |
| OWASP Top 10 for LLM Applications and for Agentic Applications | community list, free | Which security risks are most common with language models and agents? | voluntary, prompt | GenAI security suggestions in D-07 (references only) |
| MITRE ATLAS | knowledge base, free | Which techniques do attackers use against AI systems? | voluntary, for tests and threat models in own development | not covered |
| ENISA framework for good cybersecurity practices for AI | guidance of the EU agency, free | Which security practices apply across the AI life cycle? | voluntary, prompt | not covered |
| CSA AI Controls Matrix, MAESTRO | control catalogue and threat model, free | Which controls do cloud and AI services need, and where do risks arise with agents? | voluntary, often in talks with cloud providers | not covered |

## What ISO/IEC 42001 does and does not do

| ISO/IEC 42001 does | ISO/IEC 42001 does not |
|---|---|
| provide orderly, auditable handling of AI across the organization | classify your systems under the EU AI Act |
| cover inventory, risks, impact assessments and controls per system | create a presumption of conformity: the standard is not a harmonised standard under the AI Act |
| provide evidence for customers, supplier audits and tenders | replace conformity assessment, CE marking or registration |
| lay a good foundation for AI literacy, deployer obligations and, for providers, the quality management system under Art. 17 | replace a legal review of borderline cases |

Providers of high-risk AI have their own harmonised standards: on quality management, EN 18286:2026 has been listed since 14/10/2026 (Implementing Decision (EU) 2026/2274). It is unclear how far this supports a presumption of conformity for Art. 17: Art. 40(1) names only Chapter III Section 2 and Chapter V Sections 2 and 3, and Art. 17 is in Section 3; the last subparagraph of Art. 40(2), on the other hand, also names Section 3 for standardization requests. Read Annex ZA of the standard and have the question legally reviewed. The Commission has not used the second route, common specifications under Art. 41, so far: none are known as of 07/11/2026 (Commission AI Act Service Desk; EUR-Lex search found no implementing act under Art. 41). In our assessment, the objectives and definitions of ISO/IEC 42001 are not aligned with the quality management system under the AI Act; as of 07/11/2026 we found no statement by the Commission on this. The AIMS is a good starting point for this, but not a substitute.

In short: **a certificate under ISO/IEC 42001 is not conformity with the AI Act, but it is the foundation for it.** If you have the inventory, roles, risks, impact assessments and evidence under control, you meet many obligations faster and can prove it.

## Role first in the kit

Template **D-24 Role first** is part of the core and applies to everyone: a decision tree provider or deployer and a page ‘What ISO/IEC 42001 demonstrates and what it does not’ that you can show to customers and top management. The optional **EU AI Act module** (E-01 to E-09) adds role determination, risk classes, the obligations matrix, additional controls (EUAIA-xx) for the statement of applicability and the deadlines. Switch it on if you have a link to the EU and at least one system carries more than minimal risk.
