# 3 The 10 steps

The 10 steps lead from the mandate to certification. They build on each other but overlap in time: the inventory starts while the scope is still taking shape. Each step lists the clauses to read, the templates, the matching stage in the AIMS Manager and the mode in the AI assistant. Duration and effort are based on the assumptions in chapter 5.

## Step 1: Mandate and starting point

**Objective.** Top management makes a conscious decision to set up an AIMS and provides time and resources. You know where you stand.

<!-- steckbrief:1 -->

**How to proceed.**

- In the start interview, enter your sector, size, ISMS status, links to the EU and the AI tools you know about. This determines the path and the roadmap.
- Run the quick check in D-00: 15 questions answered yes, partly or no, with a traffic light per clause. Then estimate in the gap analysis a maturity level from 0 to 5 for each clause and control (target usually 3). One hour is enough; precision comes later.
- Write the project mandate (sheet in D-00): objective, draft scope, target date, AIMS lead and deputy, budget, certification yes or no.
- With ISMS: record in D-23 which processes you will run jointly.
- Without ISMS: set the basic rules of document control from week 2 (short version of D-26: storage, identification, approval route). This way even the first approvals are controlled; you complete the register in step 8.
- Agree the approval calendar with top management (chapter 4) and ask certification bodies early about dates.

**Result.** Approved project mandate signed by top management, maturity level as a baseline.

**Pitfalls.** A project without top management approval fails at clause 5.1 at the latest. The maturity level is a working aid; the certification body does not assess it.

## Step 2: Context, roles, scope

**Objective.** You know what influences your use of AI, who has expectations and which parts of the organization the AIMS covers.

<!-- steckbrief:2 -->

**How to proceed.**

- In D-01, collect internal and external issues: market, customers, law, technology, staff. Check whether climate change is relevant to you and record the decision.
- List the interested parties with their requirements and decide for each requirement whether the AIMS takes it on.
- Determine the role of the organization regarding AI (for example user, provider, partner) in the sense of 4.1. The role under the EU AI Act follows in step 5.
- In D-02, set the boundaries of the scope: units, sites, processes, AI systems, interfaces. Draw the process map of the AIMS.
- Define the processes and describe them in D-27 (section ‘Defining processes’ below), with the AIMS Manager or directly in the Word template.

**Result.** Approved scope (D-02), context analysis with register of interested parties (D-01) and a draft of the process descriptions (D-27), which you approve together with the policies and procedures (approval calendar in chapter 4).

**Pitfalls.** A scope that leaves out AI systems without a reason stands out in the audit. Keep the scope small but honest: one site covered in full is better than the whole organization with gaps.

### Defining processes (4.4)

Clause 4.4 requires the AIMS to be established, operated and improved through its processes. For an SME this means a few clearly assigned processes with an owner rather than a process manual written in advance.

- **Catalogue.** The AIMS Manager provides 27 AIMS processes (PR-01 to PR-27) in four groups: leadership, core AI processes, support, evaluation and improvement. Each process has a purpose, triggers, a lean flow with roles and suggestions for owner, rhythm and indicator. Mandatory processes from clauses 4 to 10 cannot be excluded, processes for controls only with a justification in D-11. Add processes that the catalogue does not cover as own processes (PE-01 onwards). The tool generates the descriptions as D-27.
- **Without the tool.** The blank D-27 contains 30 chapters: PR-01 to PR-27 and the sample texts PS-02, PS-04 and PS-06. For each chapter, enter the owner and deputy from D-04, adapt triggers, rhythm, steps and roles to your organization and carry the indicator and target value into the measurement plan (D-05). The 15 mandatory processes stay. Replace a chapter on a control that you exclude in D-11 with one sentence referring to the justification there; PR-15 is dropped if you do not develop AI yourself. With an ISMS, replace the chapters PS-02, PS-04 and PS-06 with a reference to the relevant place in the ISMS. If you change a flow, update the list of steps and the diagram together. Add your own processes as further chapters (PE-01 onwards). Control D-27 like the other documents under D-26.
- **Minimum set without an ISMS.** The standard does not prescribe base processes. Without an ISMS the kit recommends three additional information security base processes that AI controls build on directly: access and permissions, security incidents and, as soon as you run AI systems whose data or settings need backing up, backup. D-27 contains sample texts for them. The remaining eight base processes are recommendations. With an ISMS a reference to the relevant place in the ISMS is enough for each base process.
- **Maturity.** Five levels show how far a process is lived: not started, defined, implemented, effective, reviewed. The tool suggests the level from evidence, measurements, audits and management reviews and colours the process map accordingly, always with the word next to the colour. Maturity steers the work; the certification body does not assess it. Plan in the audit programme (D-20) that every mandatory process is in the scope of an internal audit once within the three-year cycle.
- **draw.io.** Every flow can be exported as a file for draw.io, edited there and taken over again. Your own shapes, layers and notes are kept; afterwards you assign lanes without a matching role in the tool. A diagram that belongs to no process can be taken over as an own process.
- **Diagram viewer.** If you are not allowed to install draw.io, open the files with the diagram viewer in the AIMS Manager folder. It shows the flows offline; the data stays on your computer.

## Step 3: Policy, roles, reporting channels

**Objective.** Top management sets binding principles. Everyone knows who is responsible and where to raise concerns.

<!-- steckbrief:3 -->

**How to proceed.**

- Write the AI policy (D-03) on two to three pages: principles, framework for objectives, commitments, link to other policies. No product names; they belong in the use policy.
- Assign the roles in D-04: AIMS responsibility, a system owner per AI system, human oversight, legal, data protection, purchasing. In an SME, a few people hold several roles.
- Record top management's **risk appetite** in D-03: what is never allowed, what needs their approval and what the AIMS lead may decide without top management (low risk alone, medium risk together with the system owner). In D-04, set for each risk level who introduces a system, accepts a residual risk, grants an exception, stops a system or retires it.
- Set up a channel for concerns. Use an existing channel, such as the whistleblowing office.
- Start the responsible AI use policy (D-15) now, so that employees get clear rules early.

**Result.** Approved and communicated AI policy, role matrix, documented reporting channel.

**Pitfalls.** A policy signed only by IT is not enough. Communicating it needs evidence (email, intranet, training).

## Step 4: AI inventory

**Objective.** You know every AI system in scope, including AI in purchased software and shadow AI.

<!-- steckbrief:4 -->

**How to proceed.**

- Send the survey questionnaire from D-10 to all departments. Ask about tools, not about ‘AI’: many people do not recognize AI features in standard software as AI.
- Go through licence and purchasing lists, browser extensions and, where available, proxy or cloud logs. This is how you find shadow AI.
- For each system, record purpose, system owner, type (purchased, SaaS, in-house, shadow AI), data, supplier, hosting location and people involved. Note whether it is generative AI, which model runs in which version and whether an outage disrupts important processes.
- **Agentic AI:** Ask whether AI sends emails, triggers bookings or changes data on its own. Record each system's authority to act (informs, recommends, prepares, executes within limits, acts in several steps as an agent), together with access and tools, memory and who can stop it and how.
- For shadow AI, decide within 30 days: approve, replace or prohibit.

**Result.** Complete AI inventory with resource details, typically 5 to 10 systems in an SME.

**Pitfalls.** An incomplete inventory is the most frequent audit finding (chapter 6). An inventory without a system owner per system cannot be maintained. Information on model, plan, functions and retirement comes from the manufacturer's or provider's source (terms of contract, system card, admin console) with the date retrieved, not from third-party collections; the same provider makes different commitments for each plan.

## Step 5: Role first and classification

**Objective.** For each AI system it is clear whether you are the provider or the deployer and which obligations follow.

<!-- steckbrief:5 -->

**How to proceed.**

- Work through the decision tree in D-24 for each system. Watch out for a change of role: your own name or trademark, a substantial modification or a new intended purpose can turn a deployer into a provider.
- With the module: determine the role in E-01 and the risk class in E-02 (prohibited, high-risk, transparency obligation, minimal).
- Without the module: record in D-24 why you do not need the module, and review the decision every year.

**Result.** Role and, with the module, risk class per system in the inventory.

**Pitfalls.** Borderline cases (safety components, high-risk areas such as recruitment) need a legal review. The kit provides reasoned proposals, not legal advice.

## Step 6: Risks and impact assessments

**Objective.** You know the risks and opportunities of each AI system and the possible impacts on people and society.

<!-- steckbrief:6 -->

**How to proceed.**

- In D-06, set the method, scales and criteria. With an ISMS you adopt its scales and add impacts on people and society. The likelihood scale needs a time frame.
- Assess the risks of each system in a short workshop (D-07). Use the risk sources in Annex C of the standard as a prompt, not as a checklist to tick off.
- **GenAI security:** For systems with generative AI, D-07 contains a list of typical risks (GS-01 to GS-22), for example hidden instructions in emails or documents (prompt injection), leakage of confidential data, excessive rights of agents and costs caused by abuse. GS-11 to GS-16 only concern AI that acts, such as agents and connectors; GS-17 to GS-22 are additional suggestions on data, for example summaries and transcripts that inherit the classification and deletion of the source. Pure deployers usually need only the entries with target group ‘Deployer’. The topics follow the OWASP Top 10 for LLM Applications 2026 and, for agents, the OWASP Top 10 for Agentic Applications 2026; texts and mappings are the kit's own.
- First carry out the screening in D-09 for each system, so that you know early how many full assessments are needed. If a system crosses a threshold, for example when it informs decisions about people, a full impact assessment follows under procedure D-08. Approve D-08 beforehand.
- Allow about 1 to 1.5 PD and one week of lead time per full impact assessment (consulting affected persons, aligning with the data protection impact assessment, approval). From three full assessments onwards the plan extends by 1 to 2 weeks.
- Record the **deployment decision** in D-09: expected benefit, the solution without AI that you considered and the date on which you check the benefit again.
- Record the triggers for a reassessment: new version or new model, new purpose, new data or knowledge source, new tool, less human review, incident.

<!-- abb:risikomatrix -->

**Result.** Risk register per system with opportunities, screening for every system, full impact assessments where needed.

**Pitfalls.** A risk register with general entries such as ‘AI produces wrong results’ for every system counts as generic. Impact assessments without approval do not count.

## Step 7: Controls, statement of applicability, approval

**Objective.** A treatment is chosen for each risk. Every Annex A control has a justified decision. Top management accepts the residual risks.

<!-- steckbrief:7 -->

**How to proceed.**

- For each risk, choose the treatment (reduce, avoid, share, accept) and the controls needed. The AIMS Manager suggests controls per risk.
- Compare the chosen controls with the 38 controls in Annex A. Annex B of the standard gives implementation guidance per control, much as ISO/IEC 27002 does. Your own controls (EC-xx) and, with the module, the additional controls EUAIA-xx are added.
- Complete the statement of applicability (D-11): decision, justification for inclusion or exclusion, status, evidence. The column ‘Effectiveness checked’ records how, when and by whom the effect was checked; only then does a control count as effective.
- With the NIST AI RMF module, the additional controls RMF-xx are added, and N-02 shows which subcategories the AIMS already covers (chapter 10).
- Have top management approve the treatment plan and the residual risks, with a date.

**Result.** Approved statement of applicability, treatment plan with owners and dates, accepted residual risks.

**Pitfalls.** ‘Not applicable because already in place’ is not a justification: a control that is in place is applicable and implemented. Exclusions must follow from context, role or risk.

## Step 8: Implementation

**Objective.** The planned controls work in daily practice, and evidence builds up.

<!-- steckbrief:8 -->

**How to proceed.**

- **Operation and life cycle (D-12):** approval of new AI systems, tests before introduction, monitoring, logging, retirement. Deployers use the lite version.
- **Data (D-13):** origin, quality and protection of the data that flows into the systems.
- **Transparency (D-14):** information for users, reporting channel for affected persons, incident communication, information duties towards third parties.
- **Use (D-15) and suppliers (D-16):** rules for employees, approval of new tools, checklist questions and contract clauses for suppliers.
- **Competence and communication (D-17):** competence needs per role, training, communication plan. With the module: AI literacy concept (E-04).
- **Objectives and document control (D-05, D-26):** measurable AI objectives, measurement plan, document register, changes to the AIMS.

**Agentic and generative AI.** Before deployment, also test systems that read third-party content or are publicly reachable with misuse cases (D-12), and repeat the tests after a change of model. Agents and connectors get their own identity, only the rights they need and only approved tools; actions with external effect need confirmation, and an emergency stop is in place (D-12, D-15). The acceptable use policy tells employees that documents and emails can contain hidden instructions. Ask suppliers in addition about protection against manipulated input, permissions in search, extensions, a cost cap and model changes (D-16, PF-16 to PF-21). D-14 sets severity levels for AI incidents and the right to appeal against AI results, D-12 the retirement of systems.

For implementing the individual controls, read Annex B of the standard alongside the templates.

**Result.** Approved documents, training delivered, first records from operation.

**Pitfalls.** This is where the gap between policy and practice opens up. For every control, plan which evidence daily work will produce, such as an approval record or a test report.

## Step 9: Measure, audit, review, improve

**Objective.** You check whether the AIMS is effective, and top management takes decisions on that basis.

<!-- steckbrief:9 -->

**How to proceed.**

- Count every indicator from the records, with numerator, denominator and comparison against the target, and do not estimate a figure. In the first year some indicators cannot be measured yet: write ‘no measurement yet’ or ‘no occasion’ with the reason.
- Collect the metrics from the measurement plan (D-05) at least once before the internal audit.
- Carry out the internal audit using the programme and checklist (D-20). Auditors do not audit their own area and need knowledge of ISO/IEC 42001; plan familiarization or an external specialist auditor by the middle of the project at the latest. With an ISMS, a combined audit makes sense; the ISMS team audits where it does not itself work on the AIMS project.
- In the first cycle, 9.3 and A.2.4 cannot yet be checked in the audit, because the review only takes place afterwards. Plan a short supplementary audit before stage 1, after the management review, to check these points (D-20, D-25).
- Hold the management review (D-21) with all required inputs and record the decisions. With the NIST AI RMF module, update the profile N-01 beforehand and bring the gaps to the review.
- Record findings in D-22 with cause, action, due date and effectiveness check.

**Result.** Audit report, minutes of the management review, register of nonconformities with open and closed actions.

**Pitfalls.** An internal audit without findings looks implausible. A management review that only lists the participants does not meet 9.3.

## Step 10: Certification

**Objective.** You are ready for the stage 1 audit and have chosen a suitable certification body.

<!-- steckbrief:10 -->

**How to proceed.**

- Request quotations from accredited bodies early, in week 4 with an ISMS and in weeks 7 to 8 without, and choose the body two weeks later (chapters 4 and 8). Then book the dates.
- Compile the evidence list from D-25. The AIMS Manager shows a traffic light per area and generates the stage 1 report.
- Close the open errors from the checks in the AIMS Manager, especially on the inventory, approvals and audit.
- Plan the annual calendar: recurring reviews, audit, management review.

**Result.** Complete document package, auditor booked, annual calendar.

**Pitfalls.** Stage 1 readiness is not the certificate. Stage 2 needs evidence that the AIMS has been running for some time (chapter 4).
