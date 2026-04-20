# Research: Project Memory for AI Agents in Large Codebases

Created: 2026-04-15
Last updated: 2026-04-15

## Original Prompt

> I need you to research the current recommended approach for storing and providing some kind of project-related memory for AI. I have a big project, and I'm looking for the current bleeding-edge best approach for doing that. I'm not using Claude Code because I don't have an Anthropic subscription, but anything else works fine. Prefer open code.

## Executive Summary

The strongest current approach is not a single "memory product" and not a giant `memory-bank.md` file. The best practical pattern today is a layered stack:

1. Keep durable project truth in the repo as versioned, human-readable files, centered on a small root `AGENTS.md` plus subsystem docs, ADRs, runbooks, and path-specific instructions. `AGENTS.md` is now a real cross-tool format, with explicit support in Codex, OpenCode, GitHub Copilot, and the broader AGENTS.md ecosystem ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [OpenCode rules docs](https://opencode.ai/docs/rules/), [GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)).
2. Keep the always-loaded layer small and navigational. Recent evals from Vercel found that a compressed docs index embedded in `AGENTS.md` outperformed skills for general framework knowledge because the context was present on every turn rather than depending on a skill invocation decision ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).
3. Add a structural code map so the agent can cheaply understand the shape of a large repo before loading many files. Aider's `repo map` and Continue's repository/codebase awareness both converge on this idea: give the model a compact, queryable view of files, symbols, and relationships ([Aider repo map](https://aider.chat/docs/repomap.html), [Continue codebase awareness](https://docs.continue.dev/guides/codebase-documentation-awareness)).
4. Add hybrid retrieval over code and docs, exposed as a tool or MCP server. Continue's current guidance is explicit: for large codebases, use tools, rules, MCP servers, and, when needed, custom code RAG instead of a monolithic built-in context provider ([Continue codebase awareness](https://docs.continue.dev/guides/codebase-documentation-awareness), [Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)).
5. Only add graph or temporal memory when your project questions are genuinely cross-cutting, relationship-heavy, or time-sensitive. Microsoft GraphRAG is strongest for holistic reasoning across private corpora, while Graphiti/Zep target evolving facts with provenance and temporal validity windows ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Microsoft GraphRAG blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md), [Zep paper](https://arxiv.org/abs/2501.13956)).

Short version: for a big software project, the best current design is **repo-native truth + compact `AGENTS.md` index + symbol/repo map + hybrid code/doc retrieval + optional graph layer**. If you prefer open-source tooling, that stack fits well with OpenCode or Continue as the front end, an MCP retrieval server, and self-hosted retrieval storage such as LanceDB or a similar local vector store ([OpenCode rules docs](https://opencode.ai/docs/rules/), [OpenCode skills docs](https://opencode.ai/docs/skills/), [Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)).

## Short Answer or Recommendation

If I were building this today for a large project and wanted the best current open approach, I would do this:

1. Put the stable project memory in the repo, not in chat transcripts. Use a root `AGENTS.md` for build/test commands, architectural invariants, forbidden patterns, and a compact index of where deeper docs live ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [OpenCode rules docs](https://opencode.ai/docs/rules/)).
2. Add nested `AGENTS.md` files or path-specific instruction files only where subsystems genuinely differ. GitHub Copilot, Codex, and AGENTS.md all support nearest-file or path-scoped behavior ([GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [AGENTS.md](https://agents.md/)).
3. Generate a compact symbol/repository map and refresh it automatically. This gives the model cheap structural awareness before it starts opening full files ([Aider repo map](https://aider.chat/docs/repomap.html)).
4. Index code, ADRs, architecture docs, runbooks, and selected issue or incident summaries into a hybrid retrieval system: keyword plus embeddings plus reranking. Expose it as an MCP server or equivalent tool so the assistant can retrieve only what it needs ([Continue deprecated @Codebase](https://docs.continue.dev/reference/deprecated-codebase), [Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).
5. Treat skills as workflow packs, not the core project memory. They are best for repeatable tasks like release review, docs sync, or verification, not as the only place your architecture knowledge lives ([OpenAI OSS maintenance blog](https://developers.openai.com/blog/skills-agents-sdk), [OpenCode skills docs](https://opencode.ai/docs/skills/), [Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).
6. Add graph memory only if you repeatedly need answers like "how do these five systems relate?" or "what changed over time and what used to be true?" That is where GraphRAG and Graphiti meaningfully outperform plain chunk retrieval ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Microsoft GraphRAG blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).

My concrete recommendation is:

**Use a layered, repo-native memory architecture with OpenCode or Continue as the shell, `AGENTS.md` as the portable always-on layer, a repo map for structural context, and a custom MCP-backed hybrid retrieval service for deep project memory. Add GraphRAG or Graphiti only if your project really needs holistic or temporal reasoning.**

## Rating System

Each approach below is scored from 1 to 10 across six criteria:

| Criterion | Weight | What it measures |
| --- | ---: | --- |
| Accuracy on large-project questions | 25% | Can it answer real architectural or implementation questions well? |
| Freshness and drift resistance | 20% | Does it stay correct as the project changes? |
| Context efficiency | 15% | Does it avoid blowing up the prompt with too much text? |
| Maintainability | 15% | Can humans keep it clean and versioned over time? |
| Open-code fit | 15% | Can you run it with open or self-hosted components? |
| Operational complexity | 10% | How hard is it to deploy and keep working? |

Scores are practical. A 10/10 is not the simplest thing to build. It is the best tradeoff for a serious, long-lived codebase in 2026.

## Compared Approaches or Options

| Approach | Score | Why it scores this way |
| --- | ---: | --- |
| One giant memory file or memory-bank folder only | 3/10 | Easy to start, but it drifts, bloats context, and usually becomes an unverified summary pile rather than a trustworthy project memory system. |
| Repo-native docs and `AGENTS.md` only | 7/10 | Strong source of truth and highly portable across tools, but retrieval becomes weak once the project gets large ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)). |
| Repo map or symbol map only | 6/10 | Excellent for structure and navigation, but too shallow for decision history, operational rules, or cross-document knowledge ([Aider repo map](https://aider.chat/docs/repomap.html)). |
| Hybrid RAG over code and docs only | 8/10 | Strong retrieval and good scale characteristics, especially with keyword plus embeddings plus reranking, but it can still miss always-needed invariants and repo policy unless you pair it with an always-on layer ([Continue deprecated @Codebase](https://docs.continue.dev/reference/deprecated-codebase), [Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)). |
| Dedicated agent memory layer only | 6.5/10 | Good for long-term agent state and multi-session recall, but weak as the sole source of project truth. Most of these systems are optimized for conversation or user memory more than software-repo governance ([LangGraph README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md), [LangGraph Checkpoint README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/README.md), [Mem0 paper](https://arxiv.org/abs/2504.19413)). |
| Graph or temporal memory only | 7.5/10 | Powerful for cross-cutting or time-evolving reasoning, but heavier than most projects need as a first step ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)). |
| **Layered repo-native stack: `AGENTS.md` + repo map + hybrid retrieval + optional graph** | **10/10** | Best overall. It combines portable truth, cheap structural awareness, scalable retrieval, and an upgrade path to graph memory when justified. |

## Common Patterns and Best Practices

### 1. Put durable project memory in the repository

The ecosystem is converging on repo-owned instructions rather than tool-private memory silos. `AGENTS.md` now positions itself as an open instruction format used across many agents, while OpenCode, Codex, and GitHub Copilot all explicitly support repo instruction files and nearest-file precedence ([AGENTS.md](https://agents.md/), [OpenCode rules docs](https://opencode.ai/docs/rules/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)).

Implication: your project memory should live beside the code, in Git, where humans can review and fix it.

### 2. Keep the always-on layer small and navigational

Codex concatenates discovered `AGENTS.md` files into an instruction chain and stops when it hits the configured byte budget, which defaults to 32 KiB ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)). OpenCode likewise recommends committing a concise project `AGENTS.md` and using `opencode.json` instruction references when you need to pull in more material without bloating the root file ([OpenCode rules docs](https://opencode.ai/docs/rules/)).

Vercel's recent evals make the same point in a more concrete way: a compressed docs index in `AGENTS.md` beat skills because it gave the model an always-present navigation layer without dumping the full docs into context ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

Implication: the root memory file should be an index and rules layer, not a full encyclopedia.

### 3. Use skills for workflows, not as the only memory layer

OpenAI's current Codex guidance uses `AGENTS.md` plus repo-local skills plus optional scripts and CI, with skills reserved for recurring workflows such as verification, release review, and PR drafting ([OpenAI OSS maintenance blog](https://developers.openai.com/blog/skills-agents-sdk)). OpenCode's skill model also uses on-demand loading, which keeps context efficient but means the agent must choose the skill before it gets the full instructions ([OpenCode skills docs](https://opencode.ai/docs/skills/)).

Vercel's evals show the downside of making skills the primary carrier of general project knowledge: in their Next.js tests, the skill was often not invoked unless `AGENTS.md` explicitly forced that behavior, while the `AGENTS.md` docs index achieved the best results directly ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

Implication: stable project facts belong in `AGENTS.md` and docs; skills belong in repeatable workflows.

### 4. Add a structural code map

Aider's repository map is one of the clearest examples of the current best practice for structural memory. It sends a concise map of files plus important classes, functions, and signatures, then uses a graph-ranking algorithm to fit the most relevant parts into the token budget ([Aider repo map](https://aider.chat/docs/repomap.html)). Continue has moved in a similar direction by emphasizing tool-based codebase awareness and a repository map rather than expecting the model to infer structure from scratch each time ([Continue codebase awareness](https://docs.continue.dev/guides/codebase-documentation-awareness)).

Implication: symbol-level structure is a different layer from semantic memory, and large projects benefit from both.

### 5. Retrieval should be hybrid, not embeddings-only

Continue's older `@Codebase` provider explicitly combined embeddings retrieval with keyword search, and its advanced guidance for large codebases now recommends custom code RAG plus MCP when you need more control ([Continue deprecated @Codebase](https://docs.continue.dev/reference/deprecated-codebase), [Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)). Graphiti independently converges on the same pattern, combining semantic embeddings, BM25-style keyword retrieval, and graph traversal ([Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)). Mem0 also frames modern memory as extraction plus retrieval rather than full-history prompting and reports large latency and token reductions versus full-context approaches ([Mem0 paper](https://arxiv.org/abs/2504.19413), [Mem0 README](https://raw.githubusercontent.com/mem0ai/mem0/main/README.md)).

Implication: the practical default is lexical plus semantic retrieval, optionally followed by reranking.

### 6. Runtime state memory is different from project memory

LangGraph is explicit that it is a low-level framework for long-running, stateful agents, and its checkpointers persist graph state at every superstep so a thread can resume later ([LangGraph README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md), [LangGraph Checkpoint README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/README.md)). That is valuable if you are building your own agent runtime, but it does not replace versioned repo knowledge.

Implication: use runtime memory frameworks for agent state; use repo files and retrieval for project memory.

### 7. Graph memory is a specialized upgrade, not the default first move

Microsoft GraphRAG is strongest where naive RAG fails: connecting distant facts, building holistic answers over large private corpora, and summarizing community-level themes ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Microsoft GraphRAG blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)). Graphiti and Zep push this further for dynamic data, using temporal validity windows, provenance, and hybrid graph retrieval for changing facts ([Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md), [Zep paper](https://arxiv.org/abs/2501.13956)).

Implication: add graph memory when your questions are relational, cross-cutting, or temporal. Do not start there just because it sounds advanced.

## Disagreements or Tensions

### `AGENTS.md` versus skills

This is the clearest disagreement in the current literature.

- OpenAI and OpenCode favor a layered model: small always-on instructions plus on-demand skills for reusable workflows ([OpenAI OSS maintenance blog](https://developers.openai.com/blog/skills-agents-sdk), [OpenCode skills docs](https://opencode.ai/docs/skills/)).
- Vercel's evals found that for general framework knowledge, passive `AGENTS.md` context outperformed skills because there was no skill-routing failure point ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

My conclusion: use `AGENTS.md` for persistent project memory and skills for specialized operations.

### Plain RAG versus graph memory

- GraphRAG and Graphiti both argue that naive vector retrieval fails on questions that require connecting multiple facts or reasoning about the whole corpus ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).
- Continue's guidance is more incremental and pragmatic: start with a custom code RAG pipeline, then add indexing and MCP plumbing before reaching for heavier techniques ([Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)).

My conclusion: start with hybrid RAG. Add graph memory only when you can point to recurring failure cases that require it.

### Conversational memory platforms versus repo-native memory

- Mem0 and Zep present compelling benchmark results for long-term memory and lower cost versus full-context prompting ([Mem0 paper](https://arxiv.org/abs/2504.19413), [Zep paper](https://arxiv.org/abs/2501.13956)).
- But those systems are primarily about cross-session agent memory, not the human-maintainable, reviewable source of truth for a software repository.

My conclusion: these systems are useful additions for agents you build yourself, but they should not replace versioned repo documents as project memory.

## Risks and Anti-patterns

- Treating chat summaries as authoritative project memory. Chat summaries are derived artifacts and drift easily.
- Putting all project knowledge into one giant root instruction file. Codex has explicit size limits, and all tools suffer when the always-on layer becomes noisy ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)).
- Using skills as the only place where architecture knowledge lives. Skills are not loaded reliably enough to be your sole project memory layer for general tasks ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).
- Building embeddings-only retrieval with no keyword search, no reranking, and no structural map. That misses exact identifiers and local structure too often ([Continue deprecated @Codebase](https://docs.continue.dev/reference/deprecated-codebase), [Aider repo map](https://aider.chat/docs/repomap.html)).
- Building GraphRAG first. Graph systems are powerful, but the setup cost is higher and the win is highly workload-dependent ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).
- Storing only opaque vector chunks with no human-readable source documents. If humans cannot inspect or correct the memory, it will rot.

## Final Recommendation

### The architecture I would build

For a large codebase in 2026, I would build this stack:

1. **Canonical repo memory**
   - Root `AGENTS.md`
   - Nested `AGENTS.md` or path-specific instruction files for major subsystems
   - `docs/architecture/`, `docs/adr/`, `docs/runbooks/`, `docs/api/`
   - Short postmortem or incident summaries only when they encode durable lessons

2. **Always-on navigation layer**
   - Keep the root `AGENTS.md` small.
   - Put commands, invariants, non-obvious architecture boundaries, and a compact index of deeper docs there.
   - Follow the Vercel pattern: store an index of where to fetch deeper knowledge, not the full knowledge itself ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

3. **Structural layer**
   - Generate a repo map or symbol map on a schedule or after important merges.
   - Feed that map to the assistant before large exploratory tasks.

4. **Retrieval layer**
   - Build an MCP server for project memory.
   - Index code, docs, ADRs, runbooks, and selected operational artifacts.
   - Use keyword plus embeddings plus reranking.
   - Refresh incrementally on changed files where possible ([Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag)).

5. **Workflow layer**
   - Put release review, verification, docs sync, incident triage, and migration playbooks into skills, not into the root memory file ([OpenAI OSS maintenance blog](https://developers.openai.com/blog/skills-agents-sdk), [OpenCode skills docs](https://opencode.ai/docs/skills/)).

6. **Optional advanced layer**
   - Add GraphRAG for "whole codebase / whole corpus" reasoning.
   - Add Graphiti if you need evolving facts, provenance, and historical truth, such as ownership changes, service dependencies, policy changes, or incident timelines ([GraphRAG docs](https://microsoft.github.io/graphrag/), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).

### Concrete open-source starter stack

If you want something practical and open-source-biased:

- **Front end:** OpenCode or Continue ([OpenCode rules docs](https://opencode.ai/docs/rules/), [Continue codebase awareness](https://docs.continue.dev/guides/codebase-documentation-awareness))
- **Portable memory format:** `AGENTS.md` plus repo docs ([AGENTS.md](https://agents.md/))
- **Structural map:** Aider-style repo map generation ([Aider repo map](https://aider.chat/docs/repomap.html))
- **Retrieval store:** LanceDB or another self-hosted vector store ([Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag))
- **Serving layer:** custom MCP server for search and fetch ([Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag))
- **Embeddings:** local if you want stronger open-code/privacy properties, or hosted if you want maximum retrieval quality. Continue explicitly recommends `voyage-code-3` for best code-retrieval accuracy, while Graphiti documents a fully local Ollama path using `nomic-embed-text`, which is more open but usually not state-of-the-art on retrieval quality ([Continue custom code RAG](https://docs.continue.dev/guides/custom-code-rag), [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md)).

### What I would not do

I would not make a proprietary memory store or chat-summary database the primary source of truth for the project. I would make the **repo** the source of truth and make retrieval, maps, and graph memory derived layers around it.

That is the best current balance of portability, correctness, maintainability, and open-tool compatibility.

## Sources Reviewed

- [AGENTS.md](https://agents.md/) - open format site
- [Custom instructions with AGENTS.md - Codex](https://developers.openai.com/codex/guides/agents-md) - official docs
- [Rules - OpenCode](https://opencode.ai/docs/rules/) - official docs
- [Agent Skills - OpenCode](https://opencode.ai/docs/skills/) - official docs
- [Using skills to accelerate OSS maintenance - OpenAI Developers](https://developers.openai.com/blog/skills-agents-sdk) - maintainer engineering blog
- [AGENTS.md outperforms skills in our agent evals - Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) - evaluation writeup
- [Adding repository custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) - official docs
- [Repository map - aider](https://aider.chat/docs/repomap.html) - official docs
- [How to Make Agent mode Aware of Codebases and Documentation - Continue Docs](https://docs.continue.dev/guides/codebase-documentation-awareness) - official docs
- [How to Build Custom Code RAG - Continue Docs](https://docs.continue.dev/guides/custom-code-rag) - official docs
- [@Codebase (Deprecated) - Continue Docs](https://docs.continue.dev/reference/deprecated-codebase) - official docs
- [LangGraph README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md) - official project README
- [LangGraph Checkpoint README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/README.md) - official project README
- [GraphRAG docs](https://microsoft.github.io/graphrag/) - official docs
- [GraphRAG: Unlocking LLM discovery on narrative private data - Microsoft Research](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/) - research blog
- [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md) - official project README
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956) - paper
- [Mem0 README](https://raw.githubusercontent.com/mem0ai/mem0/main/README.md) - official project README
- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413) - paper
