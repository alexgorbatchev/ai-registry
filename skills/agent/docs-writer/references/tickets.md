# Ticket content

Load `issue-tracker` before ticket operations. Use its existing records and lifecycle rather than creating repository-local ticket files or duplicating state in frontmatter. Preserve repository-specific content requirements, including request attribution when required.

1. State the requested outcome and current problem, with its realistic trigger and consequence. Do not inflate urgency to justify the work.
2. Include enough observed context to act without the conversation: relevant source paths, reproduction steps or errors, decisions, scope, and exclusions. Expand conversational IDs and references. Distinguish verified evidence from assumptions.
3. Identify prerequisites and affected work through the tracker's dependency mechanism. Link technical designs or evidence where useful; do not maintain a second dependency graph in Markdown files.
4. Define acceptance criteria for the resulting behavior, preserved contracts, and applicable validation. Include required platform or UI evidence and existing review gates when relevant; do not invent an independent-review requirement for every ticket.
5. Check that the content is actionable, evidence-backed, and consistent with the requested scope. Use [the content template](../assets/tickets-template.md) only for sections the ticket needs; native tracker fields own status and lifecycle.
