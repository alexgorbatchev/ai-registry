---
name: opencode-ask-user
description: Ask users questions via the UI. Use when you need clarification, user preferences, or confirmation before proceeding. This is the ONLY way to communicate with users - they cannot see CLI output.
license: MIT
compatibility: opencode
metadata:
  author: glennsyj
  version: "1.0.0"
  category: general
  tags: [question, user-input, clarification, interactive, ui]
---

# Ask User Question

## Principles

**The user CANNOT see CLI output - this tool is the ONLY way to communicate with them.**

- Use the `question` tool to display modals in the UI
- Never output text expecting the user to see it - they won't
- Always ask before proceeding with ambiguous tasks
- Gather explicit requirements before implementation

## When to Use

### Clarifying Ambiguous Tasks
- Unclear requirements or missing details
- Multiple valid approaches to solve a problem
- Unknown user preferences or priorities

### Gathering Requirements
- Before starting new features
- When user provides minimal specification
- To understand business context

### Confirming Decisions
- Before destructive operations
- When choosing between equally valid options
- After completing significant milestones

## Tool Usage

### Basic Structure

```json
{
  "questions": [{
    "question": "Your question to the user",
    "header": "Short label (max 30 chars)",
    "options": [
      { "label": "Option 1", "description": "What this option does" },
      { "label": "Option 2", "description": "What this option does" }
    ]
  }]
}
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `questions` | Yes | Array of question objects |
| `question` | Yes | The full question text to display |
| `header` | Yes | Short label (max 30 chars) |
| `options` | Yes | Array of options (2-5 recommended) |
| `label` | Yes | Option label (1-5 words) |
| `description` | Yes | What this option does |
| `multiple` | No | Allow selecting multiple options |

### Custom Text Input

To allow users to type their own response, include an option with label "Other":

```json
{
  "options": [
    { "label": "Option 1", "description": "Description here" },
    { "label": "Other", "description": "Type your own answer" }
  ]
}
```

When "Other" is selected, the response will be `User responded: [their text]`.

## Examples

### Example 1: Feature Implementation

```json
{
  "questions": [{
    "question": "How would you like to organize your project structure?",
    "header": "Project Structure",
    "options": [
      { "label": "By feature", "description": "Group files by feature/domain" },
      { "label": "By type", "description": "Group into components, services, utils" },
      { "label": "Other", "description": "Suggest a different approach" }
    ]
  }]
}
```

### Example 2: Technical Decision

``` "questions": [{
  "question": "Which authentication method should we use?",
  "header": "Auth Method",
  "options": [
    { "label": "JWT", "description": "Token-based, stateless authentication" },
    { "label": "Session", "description": "Server-side session management" },
    { "label": "OAuth 2.0", "description": "Third-party provider integration" }
  ]
}]

### Example 3: Confirmation

```json
{
  "questions": [{
    "question": "This will delete 3 files and cannot be undone. Are you sure?",
    "header": "Confirm Delete",
    "options": [
      { "label": "Yes, delete", "description": "Permanently delete the files" },
      { "label": "No, cancel", "description": "Keep the files unchanged" }
    ]
  }]
}
```

### Example 4: Multi-Select

```json
{
  "questions": [{
    "question": "Which file types should be included in the cleanup?",
    "header": "File Types",
    "multiple": true,
    "options": [
      { "label": "Logs", "description": "*.log files" },
      { "label": "Cache", "description": "Cache directories" },
      { "label": "Temp", "description": "Temporary files" },
      { "label": "Build", "description": "Build artifacts" }
    ]
  }]
}
```

## Workflow Patterns

### Spec-Driven Development

1. Start with minimal prompt: "I want to add user authentication"
2. Use AskUserQuestion to interview user and gather requirements
3. Ask clarifying questions about:
   - Authentication methods needed
   - User roles and permissions
   - Session handling preferences
   - Security requirements
4. Generate detailed specification
5. Get explicit approval before implementing

```
User: "I want to add user authentication"

Claude: [Asks questions about auth methods, providers, session handling, etc.]
→ Gathers complete requirements

Claude: [Presents specification for approval]
→ User confirms

Claude: [Implements with full context]
```

### Interactive Feature Development

Before implementing ANY feature:
1. Read existing codebase to understand context
2. Ask questions to clarify requirements
3. Don't assume - verify with user
4. Proceed only after explicit confirmation

### Safety Gates

Use AskUserQuestion before:
- Deleting files or data
- Making breaking changes
- Modifying production configurations
- Running irreversible commands

## Common Mistakes

### WRONG - User won't see this:
```
I'll help organize your files. How would you like them organized?
- By type
- By date
```

### CORRECT - User sees modal:
```
question tool with proper JSON structure
```

### WRONG - Too many options:
```
"options": [A, B, C, D, E, F, G, H]  // Too overwhelming
```

### CORRECT - Grouped options:
```
"options": [
  { "label": "Quick", "description": "Basic setup" },
  { "label": "Standard", "description": "Recommended options" },
  { "label": "Custom", "description": "Configure each setting" }
]
```

## Best Practices

1. **One question at a time** - Don't overwhelm with multiple questions unless related
2. **Clear descriptions** - Users need to understand what each option means
3. **Reasonable options** - 2-5 options is ideal
4. **Allow "Other"** - Always provide a way for custom input
5. **Ask before assuming** - Never guess at user preferences
6. **Gate on approval** - Don't proceed without explicit confirmation
7. **Header under 30 chars** - Keep labels short and descriptive
8. **Use for ambiguity** - When unclear, ask. When clear, proceed.

## Dependencies

- `question` tool (built into OpenCode)
- No external dependencies required

