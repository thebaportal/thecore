/**
 * Seed: Standard Business Analysis Project Template
 *
 * Creates the reusable phase template for Global Strides Consulting's BA project phase.
 * Run after the first organisation has been created via the app (sign-up + Clerk org).
 *
 * Usage:  npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const TEMPLATE_NAME = "Standard Business Analysis Project";

const PHASES: {
  name: string;
  guidance: string;
  durationDays?: number;
  deliverables: { title: string; description: string; isRequired: boolean; submissionType?: "FILE" | "DOC" }[];
}[] = [
  {
    name: "Onboarding & Project Mandate",
    durationDays: 3,
    guidance: `Welcome to the project phase. Before the kick-off class, every student must:

1. Upload a professional profile photo to their account.
2. Read the Global Strides Platform Guide shared in the project files.
3. Read the Project Mandate document carefully — it describes the business problem your cohort will solve over the coming weeks.

The Project Mandate is the foundation of everything you will produce. If anything is unclear, raise it in the project discussion board before the next class.`,
    deliverables: [
      {
        title: "Project Mandate Review Confirmation",
        description:
          "Upload a brief written acknowledgement (1 paragraph) confirming you have read and understood the Project Mandate, and noting any questions you have for the kick-off session.",
        isRequired: true,
        submissionType: "DOC",
      },
    ],
  },

  {
    name: "Elicitation Preparation",
    durationDays: 7,
    guidance: `This phase prepares your cohort for the live elicitation session. You will attend 2–3 preparatory classes covering elicitation techniques, stakeholder analysis, and questioning strategies.

Your group must produce a Stakeholder Register (identifying all stakeholders involved in the project) and an Elicitation Question Set (the questions you will ask during the session).

Tips:
- Questions should cover both functional and non-functional aspects of the system.
- Organise questions by theme or stakeholder group.
- Assign a note-taker for the live session in advance.

One team member should volunteer to create the shared working document and coordinate contributions from the group.`,
    deliverables: [
      {
        title: "Stakeholder Register",
        description:
          "A completed register of all stakeholders: name, role, level of influence, interest, and communication preference. Use the provided template.",
        isRequired: true,
      },
      {
        title: "Elicitation Question Set",
        description:
          "A structured list of questions your team will ask during the elicitation session, grouped by theme. Minimum 20 questions covering functional, non-functional, and business context areas.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Elicitation Session",
    durationDays: 2,
    guidance: `The live elicitation session will be facilitated by the project manager. One student will play the role of lead interviewer; the rest participate and take notes.

During the session:
- Follow your prepared question set but remain flexible — follow up on unexpected answers.
- The note-taker records all responses verbatim where possible.
- Do not interpret or filter answers during the session — capture everything.

Immediately after the session, the group should consolidate notes and produce the meeting minutes before details are forgotten. Submit the minutes within 24 hours of the session.`,
    deliverables: [
      {
        title: "Elicitation Session Minutes",
        description:
          "Detailed meeting minutes from the elicitation session: date, attendees, questions asked, responses received, action items, and any follow-up questions identified. Use the provided template.",
        isRequired: true,
        submissionType: "DOC",
      },
    ],
  },

  {
    name: "Functional & Non-Functional Requirements",
    durationDays: 10,
    guidance: `Using the information gathered during elicitation, your group will now document the system requirements.

Functional Requirements describe what the system must do — features, behaviours, and functions.
Non-Functional Requirements describe how well the system must perform — speed, security, reliability, scalability, etc.

Working process:
1. Download the FR template and convert to a shared working document (Google Sheets is acceptable for collaboration).
2. One team member coordinates and maintains the master document.
3. When complete, convert back to the required format and upload the final version here.

Quality standard: Each requirement must have a unique ID, a clear description, priority (Must/Should/Could), and source (which stakeholder/elicitation response it came from).`,
    deliverables: [
      {
        title: "Functional Requirements Document",
        description:
          "Complete functional requirements with unique IDs, descriptions, priority ratings, and source references. Use the provided Excel template.",
        isRequired: true,
      },
      {
        title: "Non-Functional Requirements Document",
        description:
          "Complete non-functional requirements covering performance, security, usability, reliability, and scalability. Use the provided template.",
        isRequired: true,
      },
    ],
  },

  {
    name: "User Stories",
    durationDays: 7,
    guidance: `User stories translate your functional requirements into the language of agile development. They describe system features from the perspective of the end user.

Format: "As a [user type], I want to [action] so that [benefit]."

Each user story should also include:
- Acceptance Criteria (how you will know the story is complete)
- Priority (Must Have / Should Have / Could Have)
- Story Points (optional estimate of complexity: 1, 2, 3, 5, 8)

Your user stories should be traceable back to your functional requirements — every user story should link to at least one FR ID.

Aim for at least 15–20 well-formed user stories for the core system features.`,
    deliverables: [
      {
        title: "User Story Document",
        description:
          "A complete set of user stories with acceptance criteria, priority ratings, and traceability to functional requirements. Use the provided template.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Business Requirements Document (BRD)",
    durationDays: 10,
    guidance: `The Business Requirements Document is the centrepiece of your project — it compiles everything you have produced into a single professional document.

A well-structured BRD includes:
1. Executive Summary
2. Project Background and Business Objectives
3. Scope (in scope and out of scope)
4. Stakeholder Summary
5. Functional Requirements
6. Non-Functional Requirements
7. User Stories
8. Assumptions and Dependencies
9. Glossary

Quality matters. The BRD must be clearly written, professionally formatted, and consistent in tone. It should read as if it were produced by a professional business analyst team — not a student assignment.

You will have multiple dry runs before the final version is submitted. Expect feedback and revisions.`,
    deliverables: [
      {
        title: "Business Requirements Document (BRD) — Draft",
        description:
          "First complete draft of the BRD for instructor review. Must include all required sections. Use the provided template.",
        isRequired: true,
      },
      {
        title: "Business Requirements Document (BRD) — Final",
        description:
          "Final version of the BRD incorporating all feedback from dry runs and instructor review.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Use Cases & Process Diagrams",
    durationDays: 10,
    guidance: `This phase covers three types of visual modelling that business analysts use to communicate system behaviour and processes.

Use Case Documentation: Describes how different actors (users, systems) interact with the system to achieve a goal. Each use case should have: Name, Actor(s), Preconditions, Main Flow, Alternative Flows, Postconditions.

Process Flow Diagrams: Show the sequence of steps in a business process using standard flowchart symbols (start/end, process, decision, data).

Swimlane Diagrams: Similar to process flows but organised by who is responsible for each step — each "lane" represents one actor or department.

All diagrams should be produced using appropriate tools (Lucidchart, draw.io, Visio, or similar) and exported as PDF or image files.`,
    deliverables: [
      {
        title: "Use Case Document",
        description:
          "Documented use cases for the core system features, each with actor, flows, and conditions. Use the provided template.",
        isRequired: true,
      },
      {
        title: "Use Case Diagram",
        description:
          "UML use case diagram showing all actors and their interactions with the system. Export as PDF or PNG.",
        isRequired: true,
      },
      {
        title: "Process Flow Diagram",
        description:
          "At least one detailed process flow diagram covering the most complex business process in the system. Export as PDF or PNG.",
        isRequired: true,
      },
      {
        title: "Swimlane Diagram",
        description:
          "Swimlane diagram showing the same process as the flow diagram, organised by actor/department. Export as PDF or PNG.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Dry Runs & Presentation Preparation",
    durationDays: 7,
    guidance: `Before the final presentation, your team will conduct at least two dry runs — practice presentations where the instructor and peers give feedback.

Dry run objectives:
- Test your presentation structure and timing (target: 20–25 minutes)
- Identify gaps or unclear sections
- Practice professional communication and confident delivery
- Receive and act on feedback before the final presentation

Presentation structure:
1. Team introduction
2. Project background and business problem
3. Key findings from elicitation
4. Requirements summary (key FRs, NFRs, user stories)
5. Use cases and diagrams walkthrough
6. Lessons learned
7. Q&A

Every team member must present a section. Professional dress is expected.`,
    deliverables: [
      {
        title: "Presentation Deck",
        description:
          "PowerPoint or Google Slides presentation covering all required sections. Submit the final version after dry runs.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Developer Handover",
    durationDays: 3,
    guidance: `In a professional environment, the business analyst hands over the completed requirements package to the development team. This phase simulates that process.

The handover meeting should walk the developer through:
- The BRD (scope, objectives, requirements)
- User stories and acceptance criteria
- Use cases and diagrams
- Any assumptions, dependencies, or open questions

The Handover Document is a summary package confirming what was handed over, any clarifications given, and outstanding items the developer should resolve before development begins.

This phase teaches you the communication skills required to bridge the gap between business stakeholders and technical teams.`,
    deliverables: [
      {
        title: "Developer Handover Document",
        description:
          "A handover summary confirming what was delivered, key decisions made, clarifications provided during handover, and a list of open items. Use the provided template.",
        isRequired: true,
      },
    ],
  },

  {
    name: "Test Cases & Documentation",
    durationDays: 7,
    guidance: `Test cases verify that the system has been built to meet the requirements you documented. Each test case must be traceable back to a specific functional requirement or user story.

A good test case includes:
- Test Case ID and Title
- Related Requirement ID
- Preconditions (what must be true before the test runs)
- Test Steps (numbered, precise actions)
- Expected Result (what should happen)
- Actual Result (filled in during UAT)
- Pass / Fail status

Write test cases for both happy path (things working correctly) and edge cases (invalid inputs, boundary conditions, error states).`,
    deliverables: [
      {
        title: "Test Case Document",
        description:
          "Complete test cases for all core functional requirements and user stories. Use the provided Excel template.",
        isRequired: true,
      },
    ],
  },

  {
    name: "UAT & Quality Defect Management",
    durationDays: 7,
    guidance: `User Acceptance Testing (UAT) is the final validation that the system meets the business requirements. Your team will execute the test cases you documented and record the results.

When a test fails, raise it as a defect:
- Defect ID and Title
- Severity (Critical / Major / Minor / Trivial)
- Steps to reproduce
- Expected vs actual result
- Screenshot or evidence (where possible)
- Status (Open / In Progress / Resolved / Closed)

The UAT Report summarises the overall testing outcome: how many test cases were executed, how many passed, how many failed, and the status of all raised defects.

A successful UAT means all Critical and Major defects are resolved before sign-off.`,
    deliverables: [
      {
        title: "UAT Execution Report",
        description:
          "Completed test case document with actual results and pass/fail status for each test case. Use the test case template with the Actual Result and Status columns filled in.",
        isRequired: true,
      },
      {
        title: "Defect Log",
        description:
          "Log of all defects raised during UAT with severity, reproduction steps, and resolution status. Use the provided template.",
        isRequired: true,
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding Standard BA Project Template...\n");

  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });

  if (!org) {
    console.log(
      "⚠️  No organisation found in the database.\n" +
      "   Sign in to the app first to create your organisation, then re-run this seed."
    );
    return;
  }

  console.log(`Found organisation: ${org.name} (${org.id})`);

  // Check if template already exists
  const existing = await db.phaseTemplate.findFirst({
    where: { organizationId: org.id, name: TEMPLATE_NAME },
  });

  if (existing) {
    console.log(`\n✅ Template "${TEMPLATE_NAME}" already exists — nothing to do.`);
    return;
  }

  // Create the template
  const template = await db.phaseTemplate.create({
    data: {
      organizationId: org.id,
      name: TEMPLATE_NAME,
      description:
        "Full 11-phase business analysis project template covering elicitation through UAT. " +
        "Designed for Global Strides Consulting's 6-week practical project phase.",
    },
  });

  console.log(`\n✅ Created template: "${template.name}"`);
  console.log(`   ID: ${template.id}\n`);

  // Create each phase and its deliverables
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i]!;
    const order = i + 1;

    const phase = await db.phaseTemplatePhase.create({
      data: {
        templateId: template.id,
        name: p.name,
        guidance: p.guidance,
        order,
        durationDays: p.durationDays ?? null,
      },
    });

    console.log(`   Phase ${order}: ${p.name}`);

    for (let j = 0; j < p.deliverables.length; j++) {
      const d = p.deliverables[j]!;
      await db.phaseTemplateDeliverable.create({
        data: {
          phaseId: phase.id,
          title: d.title,
          description: d.description,
          isRequired: d.isRequired,
          order: j + 1,
          submissionType: d.submissionType ?? "FILE",
        },
      });
      console.log(`      └── ${d.title}`);
    }
  }

  console.log("\n🎉 Done! The Standard BA Project Template is ready.");
  console.log("   When creating a new project, select this template to auto-populate all phases.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
