<!--
Title: {{FEATURE_IDS}} Redesign {{JOURNEY}} as {{ONE_LINE_TARGET_EXPERIENCE}}   (under about 100 characters; states the target, not the defect)
Labels: ux, ux-flow, priority:{{PRIORITY}}   Epic: {{FINDINGS_EPIC}}
Priority: the highest verified priority among the covered findings. When verification changes it, edit the Priority paragraph too.
Attachments: renders of the current and proposed flow diagrams. Never commit the images.
No tracker? Follow "Markdown tickets" in references/proposals-and-tickets.md: front matter, an H1 with the ID and title,
a Labels line, and relative links to the diagram pages (../<key>-current.html) instead of embedded images.
Keep the lock and lost-response criteria phrased for the product's own mechanisms; drop the lock line when the product
has no state that blocks writes.
Keep the ux-flow marker at the end of the body: the filer searches for it before creating, so a retry never files twice.
Delete this comment before filing.
-->
## Problem

Today, {{WALK_THE_CURRENT_JOURNEY_IN_THE_USERS_TERMS_INCLUDING_WORKAROUNDS}}.

Main pain points:

- {{OBSERVED_PROBLEM_IN_BEHAVIOR_TERMS}} ({{FINDING_TICKET}}).
- {{OBSERVED_PROBLEM}} ({{FINDING_TICKET}}, {{PRIORITY_WHEN_P0}}).

## Current flow

![Current {{FLOW_TITLE}} flow]({{CURRENT_DIAGRAM_IMAGE}})

Today: {{ONE_SENTENCE_SUMMARY_OF_THE_CURRENT_JOURNEY}}.

## Proposed flow

![Proposed {{FLOW_TITLE}} flow]({{PROPOSED_DIAGRAM_IMAGE}})

Proposed: {{ONE_SENTENCE_SUMMARY_OF_THE_TARGET_JOURNEY}}.

1. **{{STEP_NAME}}.** {{WHAT_THE_PERSON_DOES_AND_SEES}} (`{{OPERATION}}`, {{READ_ONLY_OR_ONE_PROTECTED_WRITE}}).
   - {{DEFAULTS_KEYS_AND_VARIANTS}}
2. **{{STEP_NAME}}.** {{STEP_TEXT}}

Branches and edge states:

- **{{BRANCH}}.** {{BRANCH_TEXT}}

Wireframe: {{WIREFRAME_PATH_OR_URL}}. Written proposal: {{PROPOSAL_PATH}}. Conformance: the shared UX pattern reference ({{PATTERN_REFERENCE_PATH}}, section 4, `{{FLOW_KEY}}`) wins where this ticket disagrees with it.

## What changes

**Removed**

- {{REMOVED}}

**Merged**

- {{X_AND_Y_BECOME_ONE_Z}}

**New**

- {{NEW}}

**Changed**

- {{BEHAVIOR_THAT_FLIPS}} (today it is {{TODAY}}).

**Kept**

- {{SAFEGUARD_OR_CONTRACT_THAT_STAYS}}

## Acceptance criteria

- [ ] {{OBSERVABLE_BEHAVIOR_WITH_CONCRETE_INPUTS_AND_OUTPUTS}}; {{TEST_LAYER}} asserts it ({{RULE_IDS}}, {{FINDING_TICKET}}).
- [ ] At {{VIEWPORT}}, {{ELEMENTS}} are visible together without scrolling.
- [ ] While {{EXTERNAL_LOCK_OR_UNAVAILABLE_STATE}}, {{PRIMARY_ACTION}} is disabled with the reason visible without hover, and {{DRAFT_OR_PLAN}} survives.
- [ ] A lost response {{RECOVERS_HOW}} and never resubmits the write.
- [ ] {{STATE_MACHINE_COMPONENT_AND_END_TO_END_TESTS_THAT_COVER_THE_JOURNEY}}.

## Covers

Resolved by this redesign (epic {{FINDINGS_EPIC}}):

- {{FINDING_TICKET}} {{FINDING_RESTATED_AS_THE_PROBLEM}} ({{SCOPE_RESOLVED_HERE_AND_WHO_OWNS_THE_REST}}).

Addressed where they meet this journey (owned elsewhere):

- {{FINDING_TICKET}} {{FINDING_RESTATED}}, owned by {{OWNING_REDESIGN_TICKET}}.

## Notes

**Features.** {{ROSTER_IDS_TOUCHED_AND_ROSTER_ENTRIES_TO_ADD_OR_RENAME}}.

**Diagrams.** {{DIAGRAM_SOURCE_PATHS}}, reviewed at {{REPOSITORY}} `{{REVISION}}`. {{WHAT_WAS_EXERCISED_LIVE_AND_WHAT_WAS_TRACED_FROM_SOURCE}}.

**Related.** {{NEIGHBORING_REDESIGN_TICKETS_AND_FINDINGS_THAT_LEAVE_THIS_JOURNEY}}.

**Backend changes** (`{{BACKEND}}`):

1. **{{CHANGE_NAME}} ({{FINDING_TICKET}}).** {{FIELDS_PARAMETERS_AND_STABLE_ERROR_CODES}}. {{REQUIRED_RECOMMENDED_OR_LATER}}.

**Project contract changes** (update the project instructions in the same change as the implementation):

- "{{QUOTED_CURRENT_CONTRACT}}" becomes: {{NEW_CONTRACT}}.

**Seen in code, not yet ticketed.**

- {{DEFECT}}; {{FIXED_BY_THIS_REDESIGN_OR_OUT_OF_SCOPE}}.

**Priority.** {{PRIORITY}}. {{REALISTIC_TRIGGER_AND_CONSEQUENCE}}; {{FREQUENCY_RELATIVE_TO_SIBLING_FLOWS}}. Ship {{SMALLEST_HIGH_VALUE_SLICE}} first, then {{REST}}.

<!-- ux-flow: {{UNIT_KEY}}:{{ITEM_ID}} -->
