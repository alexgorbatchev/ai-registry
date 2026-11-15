---
created_on: {{TIMESTAMP}}
last_modified: {{TIMESTAMP}}
status: current
---

# {{FLOW_TITLE}}: proposed experience

Diagrams: [current](../{{FLOW_KEY}}-current.html), [proposed](../{{FLOW_KEY}}-proposed.html). [Wireframe](../wireframes/{{FLOW_KEY}}.html).

Status: design proposal, not implemented behavior. The [shared UX pattern reference](../patterns.md) wins where this proposal disagrees with it.

Source revision: {{REPOSITORY}} `{{REVISION}}`. Features: {{FEATURE_IDS}}. Redesign ticket: {{TICKET_LABEL}}.

{{OPTIONAL_PRODUCT_RULE_PARAGRAPH_OR_DELETE}}

## Target experience

{{ONE_PARAGRAPH_JOURNEY_FROM_THE_USERS_SIDE}} Benchmarks: {{NAMED_PRODUCTS_AND_WHAT_EACH_CONTRIBUTES}}.

## Target steps

1. **{{STEP_NAME}}.** {{WHAT_THE_PERSON_DOES_SEES_AND_GETS}} (`{{OPERATION}}`, {{READ_ONLY_OR_ONE_PROTECTED_WRITE}}).
   - {{DEFAULTS_KEYS_AND_VARIANTS}}
2. **{{STEP_NAME}}.** {{STEP_TEXT}}

Branches and edge states:

- **{{ALTERNATE_GESTURE_OR_KEYBOARD_PATH}}.** {{BRANCH_TEXT}}
- **{{EXTERNAL_WRITE_LOCK_OR_UNAVAILABLE_BACKEND}}.** {{WHAT_STILL_WORKS_WHAT_WAITS}}
- **{{PARTIAL_OR_LOST_RESULT}}.** {{COUNTS_REASONS_RESUME_WITHOUT_REPLAYING_THE_WRITE}}

## What changes versus today

- **Removed:** {{REMOVED_BEHAVIORS_AND_SURFACES}}
- **Merged:** {{X_AND_Y_BECOME_ONE_Z}}
- **New:** {{NEW_CAPABILITIES}}
- **Changed:** {{BEHAVIOR_THAT_FLIPS_WITH_TODAYS_BEHAVIOR}}
- **Kept:** {{SAFEGUARDS_CONFIRMATIONS_AND_CONTRACTS_THAT_STAY}}

## Tickets resolved

- {{PRIORITY}}: {{FINDING_TICKETS_WITH_SCOPE_WHEN_PARTIAL}}
- Not resolved here: {{FINDING_TICKETS_AND_THE_TICKET_THAT_OWNS_THEM}}

## Acceptance criteria

- [ ] {{OBSERVABLE_BEHAVIOR_WITH_CONCRETE_INPUTS_AND_OUTPUTS}} ({{RULE_IDS}}, {{FINDING_TICKET}}).
- [ ] At {{VIEWPORT}}, {{ELEMENTS}} are visible together without scrolling.
- [ ] {{NEVER_CLAUSE_FOR_THE_FORBIDDEN_PATH}}; {{TEST_LAYER}} asserts it.

## Backend and contract changes

**Backend** (`{{BACKEND}}`, preserving {{PROTECTION_SNAPSHOT_AND_UNDO_CONTRACTS}}):

1. **{{CHANGE_NAME}}.** {{FIELDS_PARAMETERS_AND_STABLE_ERROR_CODES}} ({{FINDING_TICKET}}). {{REQUIRED_RECOMMENDED_OR_LATER}}.

**Project contracts** (update the project instructions in the same change as the implementation):

- "{{QUOTED_CURRENT_CONTRACT}}" becomes: {{NEW_CONTRACT}} (`{{CC_ID}}`).

## Not yet ticketed (seen in code)

- {{DEFECT_FOUND_WHILE_TRACING_SOURCE}}; {{FIXED_HERE_OR_OUT_OF_SCOPE}}.

## Recommended priority

**{{PRIORITY}}.** {{REALISTIC_TRIGGER_AND_CONSEQUENCE}}. {{RECOVERABILITY}}. Ship {{SMALLEST_INDEPENDENT_HIGH_VALUE_SLICE}} first, then {{REMAINING_SLICES}}.
