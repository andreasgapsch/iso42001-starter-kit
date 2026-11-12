# 10 NIST AI RMF as a complement

The **AI Risk Management Framework** (AI RMF) of the US agency National Institute of Standards and Technology (NIST) describes the outcomes an organization should achieve in managing AI risk. The kit offers a second optional module for it alongside the EU AI Act: templates N-01 to N-04 in the folder `02_Module_NIST-AI-RMF`, additional controls RMF-xx for the statement of applicability and the three NIST documents as PDF in the folder `Rechtstexte_Legal-Texts/NIST-AI-RMF`.

## What the AI RMF is and is not

| The AI RMF is | The AI RMF is not |
|---|---|
| a voluntary framework with 4 functions (GOVERN, MAP, MEASURE, MANAGE), 19 categories and 72 subcategories | law: it is binding neither in the USA nor in Switzerland or the EU |
| a list of outcomes you aim for; you choose the way to get there | a management system with fixed clauses like ISO/IEC 42001 |
| a shared language, for example for questionnaires from US customers | certifiable: NIST does not certify, and there is no accredited certificate |
| strong on measurement: trustworthiness characteristics, tests, monitoring in operation | a presumption of conformity under the EU AI Act |

If you say you are aligned with the AI RMF, the best evidence is a **profile**: for each subcategory it shows how far it is implemented today (current profile) and where you want to be (target profile). That is template N-01; the AIMS Manager derives the current level from your project file.

## Relationship with ISO/IEC 42001

ISO/IEC 42001 is the certifiable management system, the AI RMF a voluntary catalogue of outcomes. The two fit well together, because many subcategories describe what an AIMS requires anyway. The kit maps each subcategory to the clauses and controls of ISO/IEC 42001 and to its own templates (N-02). The mapping is the kit's own professional assessment. It was cross-checked against a third-party crosswalk listed on the NIST website; errors in it have been corrected, and its tables have not been copied.

<!-- abb:nist -->

<!-- nistbilanz -->

In several places the templates go beyond the standard, for example with the deployment decision, appeals and retirement. What remains open without the module is mainly measurement: which trustworthiness characteristics matter for each system, how you test them and who reviews independently (N-03).

## When the module is worth it

- Your customers or your parent company are in the USA and refer to the AI RMF.
- Customer questionnaires, tenders or supplier audits ask about it.
- You want a measurement method for your AI systems: what is measured, at which threshold you act and who reviews independently.
- You use a lot of generative AI and want to assess the risks per system in a structured way (N-04).

Without one of these reasons, the kit without the module is enough. With the module, allow about **3 to 5 PD** extra, mainly for the profile, the measurement plan for the most important systems and the assessment of generative AI. You switch the module on in the start interview of the AIMS Manager; the additional pages appear in the existing phases. The AI assistant has mode 12 for it.

## Status and revision

<!-- niststand -->

## The GenAI profile NIST AI 600-1

NIST AI 600-1 is a profile of AI RMF 1.0 for generative AI. It names 12 risks that generative AI introduces or amplifies and suggests actions per subcategory. Many of them are aimed at developers of large models. For SMEs using purchased generative AI, what matters most is fabricated but convincing content (called ‘confabulation’ in the profile), leakage of personal data, over-reliance, attacks such as prompt injection, intellectual property and opaque components in the value chain. N-04 assesses the 12 risks for each system with generative AI; the short titles are the kit's own wording.

<!-- nistgenai -->

## Sources and right of use

The NIST documents (DOI in the table above) are works of the US Government and in the public domain in the USA; outside the USA, NIST permits reprinting and derivative works free of charge. The kit quotes the functions, categories and subcategories, the trustworthiness characteristics, the twelve risks of generative AI and the actions of NIST AI 600-1 on which the additional controls are based verbatim with page references (in the tool, in N-01, N-02 and N-04 and in the AI assistant). The German edition adds its own translation, marked as not official. Short titles and explanations are the kit's own wording; the PDFs are included unchanged. Wherever the kit uses NIST content, the notice applies: ‘Republished courtesy of the National Institute of Standards and Technology’. The reference does not imply endorsement by NIST.
