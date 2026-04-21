# How a simple word can completely fuck up all guard rails.

`smallest complete and semantically correct solution` (in `karpathy-skills.md`) changed the model's idea of what counts as "relevant."

At the basic instinct level, that phrase pushes the model to do this:

1. Pick the narrowest task that seems to satisfy the request.
2. Ignore anything that looks like "extra."
3. Keep moving toward a fix instead of stopping to talk about adjacent ugliness.
4. Treat commentary as optional unless it is obviously required to finish the fix.

That is the interference.

The uppercase "call this out" instructions are broad and global.
`smallest complete solution` is narrow and local.

Local instructions usually win in practice because they answer the model's immediate question:

- "What do I do next?"
- "What do I include in the answer?"
- "What can I safely leave out?"

And the word doing the most damage there is `smallest`.

Not because it says "break the rules."
Because it says:

- trim scope
- trim commentary
- trim side observations
- trim anything that is not obviously necessary

So the hover logic got mentally classified as:

- "yes, this is ugly"
- but also
- "not yet necessary to state out loud if I'm still chasing the requested fix"

That is the failure mode.

The other phrases that amplify it are:

- `complete solution`
  - this pushes toward "finish the requested task" instead of "pause and report every glaring thing"
- `be concise`
  - this makes reporting look like optional verbosity
- `persist`
  - this makes the model keep digging instead of stepping back and saying "this implementation is garbage and is probably the root cause"

So the actual interaction is:

- `call issues out` says: mention glaring problems
- `smallest complete solution` says: strip away anything that looks non-essential
- the model then wrongly treats "calling out the glaring problem" as non-essential commentary instead of part of the task

That is how one effectively overrides the other in behavior, even if not in formal priority.

The most important thing to understand is this:

The phrase does not suppress reporting directly.
It suppresses the category of things that get treated as worth saying.

That is the core mechanism.

If you want to prevent this without changing developer instructions, the fix is to turn reporting into part of the requested task, not side commentary.

In practice, that means saying things like:

- `Before fixing anything, name the ugliest implementation problem you see in this path.`
- `Treat reporting glaring design/perf problems as part of the solution, not extra commentary.`
- Findings first, then fix.
- `Do not optimize away issue reporting for conciseness or scope minimization.`

Those work because they stop "issue reporting" from being interpreted as optional narration and make it part of task completion.

The short version:

- `smallest` narrowed scope
- `concise` pruned commentary
- `persist` kept momentum
- so "say the obvious ugly thing out loud" got filtered out as non-essential

