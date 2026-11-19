# Wording for operations and recovery

The control is the complete deployed prompt. The [prompt builder](prompts.py) inserts a short scope paragraph under Operating Instructions, Failure Investigation and Recovery, or both. Every original paragraph, including personality, stays in its original position. No second-pass editing is used.

All three edits run against fresh copies of the control on the six [operational cases](triggers.json). The combined edit also runs on six new [boundary cases](mode-boundaries.json), including a full shift handoff, an explicit diagnostic request and a recovery plan with a partial write. If a single edit has more Opus joint passes than the combined edit on the operational cases, run the strongest single edit on the boundary cases as well. Use mean words to break ties between single edits.

Both models use medium effort, two replies per case and arm, with Opus 5.5 through cl-envoy and Astra 6.2 through Codex. A blind Astra reviewer grades both arms under the same [rubric](mode-rubric.json). Dry humor and sarcastic asides in conversation are explicitly welcome. Deduct for factual errors, unnecessary procedures, redundant bookkeeping or broken IDs. Compare scores within rounds because the historic reviewer used a different rubric. Check the three explicit requests for detail separately before recommending an edit. The tool-free fixtures test what agents say about work; they cannot establish live repair or retry behavior.

Reproduce a round using the commands in the [section study](README.md#reproduction). Use `deployed.md` as the baseline and `scope-ops.md`, `scope-failure.md` or `scope-both.md` as the candidate. Pass `--rubric "$ev/sections/mode-rubric.json"` to the review command.

## Results

Each arrow runs from a fresh deployed F16 control to the edited prompt. Joint passes are out of 12 for each model and arm. Read the [individual answers and blind grades](../summary.html#mode-study).

| Edit | Requests | Opus passes | Opus mean words | Astra passes | Astra mean words |
| --- | --- | ---: | ---: | ---: | ---: |
| Scope operating instructions | Operational | 4 → 3 | 27.1 → 25.4 | 10 → 9 | 17.4 → 18.4 |
| Scope failure recovery | Operational | 4 → 4 | 24.6 → 21.4 | 10 → 9 | 17.7 → 17.4 |
| Scope both sections | Operational | 3 → 3 | 22.7 → 25.8 | 9 → 9 | 17.8 → 17.8 |
| Scope failure recovery | Boundary | 5 → 4 | 221.5 → 233.1 | 12 → 11 | 113.6 → 107.2 |
| Scope both sections | Boundary | 4 → 4 | 236.7 → 218.2 | 11 → 10 | 102.4 → 107.7 |

On the operational requests, recovery wording alone produced the highest Opus candidate score, qualifying it for the second boundary round. The shorter answers still included unsolicited diagnostics and sometimes converted a reported observation into an unsupported claim. With both edits, Opus began a receipt handoff with “Receipt job: complete” and ended it with “No further action is needed on this job.” In the cropping-and-receipts case it preserved **f3** and **f5** but turned one duplicate receipt into “Receipts print twice.”

The three boundary requests that explicitly asked for detail accounted for six replies per arm. Their joint scores were:

| Edit | Opus passes out of 6 | Astra passes out of 6 |
| --- | ---: | ---: |
| Scope failure recovery | 0 → 0 | 6 → 5 |
| Scope both sections | 0 → 0 | 5 → 4 |

Opus supplied detailed diagnostic procedures. With both edits, one recovery answer checked for payments before verifying that the writer had stopped, then allowed a retry without another reconciliation. The issue there was correctness as well as length. The reviewer also expected separate IDs for the two owners’ actions in the full handoff, a stricter reading than treating it as one requested draft.

Each suite contains six distinct prompts, each sampled twice per arm. One model judged the answers. The scores measure these cases and do not estimate a production-wide success rate.
