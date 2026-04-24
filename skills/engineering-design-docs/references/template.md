# Engineering Design Doc Template

Default new design docs to `docs/internal/eng-designs/<topic>/DESIGN.md` and create the topic directory if needed. Start `DESIGN.md` with `created_on`, `last_modified`, and `status` YAML frontmatter. Archive superseded design doc sets by moving the whole topic directory to `docs/internal/eng-designs/archived/<topic>/`.

## Table of contents
- [1. Required sections](#1-required-sections)
- [2. Language rules](#2-language-rules)
- [3. Endpoint contract template](#3-endpoint-contract-template)
- [4. Type and state templates](#4-type-and-state-templates)
- [5. File-plan template](#5-file-plan-template)
- [6. Final ambiguity sweep](#6-final-ambiguity-sweep)

## 1. Required sections

Use this structure unless the user asks for a narrower doc:

1. **Objective and non-goals**
   - State what the feature changes.
   - State what is explicitly out of scope.
2. **Current codebase baseline**
   - Name the current files, routes, schema, and behavior that matter.
   - Record only verified facts.
3. **Non-negotiable constraints**
   - State product, data, migration, compatibility, and UX constraints.
4. **Exact architecture choice**
   - State the chosen top-level design.
   - Reject the main wrong alternatives explicitly.
5. **Data model / schema**
   - Give exact SQL tables, columns, indexes, and ownership rules.
6. **Types and contracts**
   - Define persisted shapes, message payloads, unions, and enums.
7. **Exact file plan**
   - Name every new file.
   - Name every modified file.
   - State each file's responsibility.
8. **Runtime behavior**
   - Define state transitions, persistence timing, streaming behavior, and replay rules.
9. **Validation rules**
   - Define what must be checked before accepting output or state changes.
10. **Exact API surface**
    - Define request and response types for every endpoint.
    - Define event-stream types for streaming endpoints.
11. **Implementation order**
    - Sequence work to minimize risk.
12. **Testing plan**
    - Cover server, frontend, and end-to-end behavior.
13. **Out-of-scope / rejection list**
    - State what implementations must be rejected.
14. **Definition of done**
    - Make completion objectively testable.

## 2. Language rules

Use hard requirement language for in-scope behavior:
- `must`
- `must not`
- `use this exact shape`
- `add these exact files`
- `return this exact response`

Use future language only for explicit follow-up work:
- `future phase`
- `out of scope`
- `do not implement in v1`

Replace soft wording like this:

| Avoid | Use instead |
|---|---|
| should | must |
| may | must or out of scope |
| recommended | exact implementation |
| suggested | required |
| for example | enumerate the actual choice |
| if needed | either require it or remove it |
| support X | define exact request/response/state semantics |

## 3. Endpoint contract template

Use this pattern for every endpoint:

```ts
### `POST /api/example`

interface PostExampleRequest {
  field: string;
}

interface PostExampleResponse {
  result: string;
}
```

For streaming endpoints, define the event union once and reuse it:

```ts
type ExampleStreamEvent =
  | { type: 'progress'; label: string }
  | { type: 'final'; payload: ExamplePayload }
  | { type: 'error'; message: string };
```

State these behaviors explicitly when relevant:
- persistence timing
- ordering guarantees
- idempotency
- delete semantics
- whether side effects are reversible
- whether old history snapshots stay immutable

## 4. Type and state templates

Use exact unions for modes and state:

```ts
type ViewState =
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'draft' };
```

Use exact interfaces for persisted entities:

```ts
interface ExampleEntity {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
```

When state overlays differ from historical snapshots, define both separately:
- immutable historical payload
- current overlay state
- merge rule in the UI

## 5. File-plan template

Use exact file lists.
Do not use wildcards when the file names are knowable.

```md
### Add
- `server/routes/example.ts`
- `server/routes/example/types.ts`
- `dashboard/components/example/ExampleView.tsx`

### Modify
- `server/index.ts`
- `dashboard/App.tsx`
```

For each file, state one responsibility block.
If a section still contains `*`, `etc.`, or `and more`, it is not exact enough.

## 6. Final ambiguity sweep

Before finishing, verify all of the following:
- Every section reflects the chosen implementation, not options.
- Every baseline claim still matches the repository.
- Every endpoint has an exact request and response contract.
- Every streamed endpoint has an exact event union.
- Every file plan names exact files.
- Every validation rule is testable.
- Every out-of-scope item is explicit.
- The definition of done is objectively verifiable.
- No core implementation section depends on prose interpretation by the implementer.
