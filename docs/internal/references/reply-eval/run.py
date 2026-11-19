"""Replay reply cases in fresh requests. Write observations as each request finishes."""

import argparse
import errno
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[3] / "system/system.md"
PREFIX = re.compile(
    r"(?m)^[ \t]*(?:(?:[-*]|\d+\.)[ \t]+|\|[ \t]*)?"
    r"\*\*((?:[qfadli]\d+)+)(?=\*\*|[: .,—–-])[^\n*]*\*\*"
)


def failures(case, reply):
    failed = []
    for concept in case["concepts"]:
        if not re.search(concept, reply, re.IGNORECASE):
            failed.append(f"missing concept: {concept}")
    for detail in case.get("omit", []):
        if detail.lower() in reply.lower():
            failed.append(f"unrequested detail: {detail}")
    if "max_words" in case and len(reply.split()) > case["max_words"]:
        failed.append("length")
    starts = re.findall(PREFIX, reply)
    if "labels" in case:
        for required in case["labels"]:
            if not any(re.fullmatch(required, label) for label in starts):
                failed.append(f"missing item prefix: {required}")
        opening = re.sub(r"^\|[^\n]+\n\|[ :|-]+\n", "", reply.strip(), count=1)
        if not PREFIX.match(opening):
            failed.append("unlabeled opening")
    if "max_labels" in case and len(starts) > case["max_labels"]:
        failed.append("too many labeled items")
    return failed


class NoRedirect(HTTPRedirectHandler):
    """Keep credentials and prompts on the configured API endpoint."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def generate(args, system, prompt):
    if args.provider == "codex":
        with tempfile.TemporaryDirectory(prefix="reply-eval-") as scratch:
            instruction_file = Path(scratch) / "system.md"
            instruction_file.write_text(system, encoding="utf-8")
            output = Path(scratch) / "reply.txt"
            command = [
                "codex",
                "exec",
                "--ignore-user-config",
                "--ephemeral",
                "--disable",
                "shell_tool",
                "--skip-git-repo-check",
                "-s",
                "read-only",
                "-m",
                args.model,
                "-c",
                "project_doc_max_bytes=0",
                "-c",
                f"model_reasoning_effort={json.dumps(args.effort)}",
                "-c",
                f"model_instructions_file={json.dumps(str(instruction_file))}",
                "-o",
                str(output),
                "-",
            ]
            proc = subprocess.run(
                command,
                input=prompt,
                text=True,
                cwd=scratch,
                capture_output=True,
                timeout=180,
                check=False,
            )
            for key, expected in (
                ("model", args.model),
                ("reasoning effort", args.effort),
            ):
                if f"{key}: {expected}" not in proc.stderr.splitlines():
                    raise RuntimeError(f"Codex did not confirm {key} {expected}")
            if proc.returncode or not output.exists():
                raise RuntimeError(f"Codex generation failed (exit {proc.returncode})")
            return output.read_text(encoding="utf-8").strip(), [args.model], {}
    if args.provider == "claude":
        command = [
            os.environ.get("REPLY_EVAL_CLAUDE_BIN", "claude"),
            "-p",
            "--safe-mode",
            "--strict-mcp-config",
            "--tools",
            "",
            "--no-session-persistence",
            "--output-format",
            "json",
            "--model",
            args.model,
            "--effort",
            args.effort,
            "--system-prompt",
            system,
        ]
        result = subprocess.run(
            command,
            input=prompt,
            text=True,
            capture_output=True,
            timeout=180,
            check=False,
        )
        if not result.stdout.strip():
            raise RuntimeError(
                result.stderr.strip()[:400] or "Claude returned no result"
            )
        data = json.loads(result.stdout)
        if result.returncode or data.get("is_error") or data["subtype"] != "success":
            raise RuntimeError(data.get("result") or "Claude generation failed")
        models = list(data["modelUsage"])
        if args.model not in models:
            raise RuntimeError(f"Claude did not report usage for {args.model}")
        metrics = (
            {"cost_usd": data["total_cost_usd"]} if "total_cost_usd" in data else {}
        )
        return data["result"], models, metrics
    body = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    }
    request = Request(
        os.environ["REPLY_EVAL_BASE_URL"].rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["REPLY_EVAL_API_KEY"],
            "Content-Type": "application/json",
            "User-Agent": "reply-eval/1.0",
        },
    )
    with build_opener(NoRedirect()).open(request, timeout=180) as response:
        data = json.load(response)
    choice = data["choices"][0]
    if choice["finish_reason"] != "stop":
        raise RuntimeError(f"Incomplete response: {choice['finish_reason']}")
    return choice["message"]["content"], [data["model"]], {}


def regrade(path, suite=HERE / "cases.json"):
    header, *rows = [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()
    ]
    cases_text = suite.read_text(encoding="utf-8")
    if header["suite_sha256"] != hashlib.sha256(cases_text.encode()).hexdigest():
        raise ValueError("Saved responses use a different case suite")
    cases = {case["name"]: case for case in json.loads(cases_text)}
    expected = {
        (arm, case, rep)
        for arm in header["prompt_sha256"]
        for case in cases
        for rep in range(1, header["repeat"] + 1)
    }
    counts = dict.fromkeys(header["prompt_sha256"], 0)
    for row in rows:
        arm, name, rep = row["arm"], row["case"], row["repetition"]
        expected.remove((arm, name, rep))
        failed = failures(cases[name], row["reply"])
        counts[arm] += int(not failed)
        print(f"{arm} {name} #{rep}: {failed or 'pass'}")
    if expected:
        raise ValueError(f"Incomplete run: missing {len(expected)} responses")
    total = header["repeat"] * len(cases)
    for arm, passed in counts.items():
        print(f"{arm}: {passed}/{total} automatic passes")
    return all(passed == total for passed in counts.values())


def scheduled_trials(cases, arms, repeat):
    """Keep each pair adjacent in launch order and alternate its first arm."""
    for rep in range(repeat):
        for index, case in enumerate(cases):
            order = reversed(arms) if (rep + index) % 2 else arms
            for arm in order:
                yield (arm, case["name"], rep + 1), case


def pair_source_drafts(path, identity, trials, source_provider=None, source_model=None):
    """Bind every edited trial to its previously generated baseline response."""
    raw = path.read_bytes()
    header, *rows = map(json.loads, raw.splitlines())
    if bool(source_provider) != bool(source_model):
        raise ValueError("Specify both source provider and model")
    source_identity = dict(identity)
    if source_provider:
        source_identity.update(provider=source_provider, model=source_model)
        identity.update(
            source_provider=source_provider,
            source_model=source_model,
            source_effort_requested=header["effort_requested"],
        )
    for key in ("provider", "model", "effort_requested", "suite_sha256", "repeat"):
        if header[key] != source_identity[key]:
            raise ValueError(f"Source mismatch: {key}")
    expected = set(trials)
    for row in rows:
        key = row["arm"], row["case"], row["repetition"]
        if key not in expected:
            raise ValueError(f"Duplicate or unexpected source trial: {key}")
        expected.remove(key)
        if row["arm"] == "baseline":
            if (
                not row["reply"].strip()
                or source_identity["model"] not in row["models"]
            ):
                raise ValueError(f"Invalid source draft: {key}")
            provenance = {
                "source_file": path.name,
                "draft_sha256": hashlib.sha256(row["reply"].encode()).hexdigest(),
            }
            for arm in ("baseline", "candidate"):
                trial = arm, row["case"], row["repetition"]
                trials[trial] = dict(trials[trial], draft=row, provenance=provenance)
    if expected:
        raise ValueError(f"Incomplete source: missing {len(expected)} responses")
    identity.update(
        mode="edit",
        source_file=path.name,
        source_sha256=hashlib.sha256(raw).hexdigest(),
    )
    identity["prompt_sha256"]["baseline"] = header["prompt_sha256"]["baseline"]


def evaluate(args, prompts, trial, case):
    arm, name, repetition = trial
    prompt = case["prompt"]
    provenance = case.get("provenance", {})
    if "draft" in case:
        draft = case["draft"]
        if arm == "baseline":
            return dict(draft, **provenance, failed=failures(case, draft["reply"]))
        prompt = json.dumps(
            {"request": prompt, "draft": draft["reply"]}, ensure_ascii=False
        )
    started = time.monotonic()
    try:
        reply, models, metrics = generate(args, prompts[arm], prompt)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"{args.provider} timed out after {exc.timeout}s") from None
    if not reply or not reply.strip():
        raise ValueError("Empty reply")
    return {
        "arm": arm,
        "case": name,
        "repetition": repetition,
        "models": models,
        "words": len(reply.split()),
        "reply": reply,
        "failed": failures(case, reply),
        "jobs": args.jobs,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        **provenance,
        **metrics,
    }


def run_pending(args, prompts, trials, record):
    trials = iter(trials.items())
    errors = []
    pending = {}
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        while True:
            while not errors and len(pending) < args.jobs:
                item = next(trials, None)
                if item is None:
                    break
                trial, case = item
                pending[pool.submit(evaluate, args, prompts, trial, case)] = trial
            if not pending:
                break
            finished, _ = wait(pending, return_when=FIRST_COMPLETED)
            for future in finished:
                trial = pending.pop(future)
                error = future.exception()
                if error is not None:
                    # Drain the requests already in flight so their responses survive.
                    errors.append(f"{trial}: {error}")
                    continue
                record(future.result())
    if errors:
        raise RuntimeError("\n".join(errors))


def lock_output(log):
    """Keep one writer per round until the descriptor closes."""
    try:
        if os.name == "nt":
            import msvcrt

            # Lock past the log contents so progress readers can read every row.
            log.seek(1 << 30)
            try:
                msvcrt.locking(log.fileno(), msvcrt.LK_NBLCK, 1)
            finally:
                log.seek(0)
        else:
            import fcntl

            fcntl.flock(log, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as exc:
        if exc.errno not in (errno.EACCES, errno.EAGAIN):
            raise
        raise ValueError("Another evaluation owns this output") from exc


def generate_round(args, prompts, cases_text):
    cases = json.loads(cases_text)
    trials = dict(scheduled_trials(cases, list(prompts), args.repeat))
    total = args.repeat * len(cases)
    if not cases or len(trials) != total * len(prompts):
        raise ValueError("Each suite needs nonempty cases with unique names")
    passed = dict.fromkeys(prompts, 0)
    identity = {
        "provider": args.provider,
        "model": args.model,
        "repeat": args.repeat,
        "effort_requested": args.effort if args.provider != "chat" else None,
        "suite_sha256": hashlib.sha256(cases_text.encode()).hexdigest(),
        "prompt_sha256": {
            arm: hashlib.sha256(prompt.encode()).hexdigest()
            for arm, prompt in prompts.items()
        },
    }
    if getattr(args, "edit_source", None):
        pair_source_drafts(
            args.edit_source,
            identity,
            trials,
            getattr(args, "source_provider", None),
            getattr(args, "source_model", None),
        )
    with args.output.open("r+" if args.resume else "x+", encoding="utf-8") as log:
        lock_output(log)
        if args.resume:
            header_line = log.readline()
            if not header_line.endswith("\n"):
                raise ValueError("Incomplete JSONL header; inspect the saved file")
            header = json.loads(header_line)
            if (
                header.get("mode"),
                header.get("source_model"),
                header.get("source_provider"),
            ) != (
                identity.get("mode"),
                identity.get("source_model"),
                identity.get("source_provider"),
            ):
                raise ValueError("Resume mismatch: mode")
            for key, value in identity.items():
                if header.get(key) != value:
                    raise ValueError(f"Resume mismatch: {key}")
            for line in log:
                row = json.loads(line)
                if not line.endswith("\n"):
                    raise ValueError(
                        "Incomplete final JSONL line; inspect the saved file"
                    )
                trial = row["arm"], row["case"], row["repetition"]
                case = trials.pop(trial, None)
                if case is None:
                    raise ValueError(f"Duplicate or unexpected saved trial: {trial}")
                if not isinstance(row["reply"], str) or not row["reply"].strip():
                    raise ValueError(f"Empty saved reply: {trial}")
                if "draft" in case:
                    for key, value in case["provenance"].items():
                        if row.get(key) != value:
                            raise ValueError(f"Resume mismatch: {key}")
                    if (
                        row["arm"] == "baseline"
                        and row["reply"] != case["draft"]["reply"]
                    ):
                        raise ValueError("Saved baseline differs from source draft")
                passed[row["arm"]] += int(not failures(case, row["reply"]))
            log.seek(0, os.SEEK_END)
        else:
            header = dict(
                identity,
                started_utc=datetime.now(UTC).isoformat(),
                jobs_at_start=args.jobs,
            )
            print(json.dumps(header), file=log, flush=True)

        def record(row):
            print(json.dumps(row, ensure_ascii=False), file=log, flush=True)
            arm = row["arm"]
            passed[arm] += int(not row["failed"])
            print(
                f"{arm} {row['case']} #{row['repetition']}: {row['failed'] or 'pass'}",
                flush=True,
            )

        run_pending(args, prompts, trials, record)
    return passed, total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--provider", choices=["claude", "codex", "chat"], default="claude"
    )
    parser.add_argument("--model")
    parser.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    parser.add_argument("--suite", type=Path, default=HERE / "cases.json")
    parser.add_argument(
        "--regrade", type=Path, help="score a complete saved run offline"
    )
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--candidate", type=Path, help="full replacement prompt")
    parser.add_argument(
        "--edit-source", type=Path, help="paired run whose baseline drafts to edit"
    )
    parser.add_argument(
        "--editor", type=Path, help="system prompt for the editing pass"
    )
    parser.add_argument(
        "--source-provider",
        choices=["claude", "codex", "chat"],
        help="expected original provider for cross-model editing",
    )
    parser.add_argument(
        "--source-model", help="expected original model for cross-model editing"
    )
    parser.add_argument("--repeat", type=int, default=2)
    parser.add_argument("--output", type=Path, help="new JSONL file")
    parser.add_argument(
        "--jobs", default=1, type=int, help="maximum concurrent requests"
    )
    parser.add_argument(
        "--resume", action="store_true", help="complete an existing matching run"
    )
    parser.add_argument("--check", action="store_true", help="fail on any rubric miss")
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error("--jobs must be positive")
    if args.repeat < 1:
        parser.error("--repeat must be positive")
    if args.regrade:
        passed = regrade(args.regrade, args.suite)
        if args.check and not passed:
            raise SystemExit(1)
        return
    if not args.model or not args.output:
        parser.error("generation requires --model and --output")
    if (args.source_model or args.source_provider) and not args.edit_source:
        parser.error("source model and provider apply only to editing")
    if args.edit_source or args.editor:
        if not (args.edit_source and args.editor) or args.baseline or args.candidate:
            parser.error(
                "use --edit-source and --editor together, without --baseline or --candidate"
            )
        prompts = {"baseline": "", "candidate": args.editor.read_text(encoding="utf-8")}
    else:
        prompts = {"baseline": (args.baseline or SOURCE).read_text(encoding="utf-8")}
        if args.candidate:
            prompts["candidate"] = args.candidate.read_text(encoding="utf-8")
    cases_text = args.suite.read_text(encoding="utf-8")
    started = time.monotonic()
    passed, total = generate_round(args, prompts, cases_text)
    for arm, count in passed.items():
        print(f"{arm}: {count}/{total} automatic passes")
    if args.check and any(count < total for count in passed.values()):
        raise SystemExit(1)
    print(f"Completed in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()
