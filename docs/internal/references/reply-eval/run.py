"""Replay reply cases in fresh requests. Write observations as each request finishes."""

import argparse
import errno
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError
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


def verify_instructions(provider, logs, system):
    expected = system.strip()
    received = []
    for log in logs:
        with log.open() as events:
            for line in events:
                event = json.loads(line)
                if provider == "claude":
                    attachment = event.get("attachment", {})
                    if attachment.get("type") == "instructions":
                        received.extend(
                            file["content"].strip() for file in attachment["files"]
                        )
                else:
                    message = event.get("payload", {})
                    if (
                        event["type"] == "response_item"
                        and message.get("role") == "user"
                    ):
                        for item in message.get("content", []):
                            received.extend(
                                re.findall(
                                    r"<INSTRUCTIONS>\n(.*?)\n</INSTRUCTIONS>",
                                    item.get("text", ""),
                                    re.DOTALL,
                                )
                            )
    if received != [expected]:
        raise RuntimeError(
            "Native transcript did not confirm the isolated instruction file"
        )


def start_attempt(args, system, prompt):
    # Raw transcripts may contain local instructions and provider metadata.
    raw_root = getattr(args, "raw_root", HERE.parents[3] / ".state/reply-eval/raw")
    raw_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    attempt = raw_root / str(uuid.uuid4())
    attempt.mkdir(mode=0o700)
    metadata = dict(
        args.trial_metadata,
        provider=args.provider,
        model=args.model,
        effort=args.effort,
        output=args.output.name,
    )
    (attempt / "request.json").write_text(
        json.dumps(dict(metadata, instruction=system, prompt=prompt))
    )
    print(f"Raw attempt {attempt.name}: {metadata}", flush=True)
    return attempt


def generate_cli(args, system, prompt):
    attempt = start_attempt(args, system, prompt)
    sessions = attempt / "sessions"
    sessions.mkdir()
    editing = bool(getattr(args, "edit_source", None))
    with tempfile.TemporaryDirectory(prefix="reply-eval-") as scratch:
        work = Path(scratch) / "work"
        home = Path(scratch) / "home"
        work.mkdir()
        home.mkdir()
        env = os.environ.copy()
        if args.provider == "codex":
            original = Path(env.get("CODEX_HOME", Path.home() / ".codex"))
            for name in ("auth.json", "models_cache.json"):
                if (original / name).is_file():
                    shutil.copyfile(original / name, home / name)
            env["CODEX_HOME"] = str(home)
            (home / "sessions").symlink_to(sessions.resolve(), target_is_directory=True)
            instructions = home / ("editor.md" if editing else "AGENTS.md")
            instructions.write_text(system)
            output = attempt / "reply.txt"
            command = [
                "codex",
                "exec",
                "--ignore-user-config",
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
            ]
            if editing:
                command.extend(
                    ["-c", f"model_instructions_file={json.dumps(str(instructions))}"]
                )
            command.extend(["-o", str(output.resolve()), "-"])
        else:
            env["CLAUDE_CONFIG_DIR"] = str(home)
            (home / "projects").symlink_to(sessions.resolve(), target_is_directory=True)
            command = [
                os.environ.get("REPLY_EVAL_CLAUDE_BIN", "claude"),
                "-p",
                "--strict-mcp-config",
                "--tools",
                "",
                "--disable-slash-commands",
                "--setting-sources",
                "user",
                "--output-format",
                "json",
                "--model",
                args.model,
                "--effort",
                args.effort,
                "--debug-file",
                str((attempt / "debug.log").resolve()),
            ]
            if editing:
                command.extend(["--system-prompt", system])
            else:
                (home / "CLAUDE.md").write_text(system)
        with (
            (attempt / "stdout").open("wb") as stdout,
            (attempt / "stderr").open("wb") as stderr,
        ):
            try:
                proc = subprocess.run(
                    command,
                    input=prompt.encode(),
                    stdout=stdout,
                    stderr=stderr,
                    cwd=work,
                    env=env,
                    timeout=180,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                (attempt / "failure.json").write_text(
                    json.dumps({"timeout_seconds": exc.timeout})
                )
                raise
        (attempt / "exit-code").write_text(str(proc.returncode))
        if proc.returncode:
            raise RuntimeError(
                f"{args.provider} exited {proc.returncode}; raw attempt {attempt.name}"
            )
        logs = list(sessions.rglob("*.jsonl"))
        if not logs:
            raise RuntimeError(f"No native transcript in raw attempt {attempt.name}")
        if not editing:
            verify_instructions(args.provider, logs, system)
        metrics = {"raw_log_id": attempt.name}
        if args.provider == "codex":
            banner = (attempt / "stderr").read_text().splitlines()
            for key, expected in (
                ("model", args.model),
                ("reasoning effort", args.effort),
            ):
                if f"{key}: {expected}" not in banner:
                    raise RuntimeError(f"Codex did not confirm {key} {expected}")
            return output.read_text().strip(), [args.model], metrics
        data = json.loads((attempt / "stdout").read_bytes())
        if (
            data.get("is_error")
            or data["subtype"] != "success"
            or args.model not in data["modelUsage"]
        ):
            raise RuntimeError(f"Claude generation failed; raw attempt {attempt.name}")
        if "total_cost_usd" in data:
            metrics["cost_usd"] = data["total_cost_usd"]
        return data["result"], list(data["modelUsage"]), metrics


def generate(args, system, prompt):
    if args.provider in ("claude", "codex"):
        return generate_cli(args, system, prompt)
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
    attempt = start_attempt(args, system, prompt)
    (attempt / "body.json").write_bytes(request.data)
    try:
        with build_opener(NoRedirect()).open(request, timeout=180) as response:
            payload = response.read()
    except HTTPError as error:
        (attempt / "response").write_bytes(error.read())
        (attempt / "http-status").write_text(str(error.code))
        raise
    (attempt / "response").write_bytes(payload)
    data = json.loads(payload)
    choice = data["choices"][0]
    if choice["finish_reason"] != "stop":
        raise RuntimeError(f"Incomplete response: {choice['finish_reason']}")
    return choice["message"]["content"], [data["model"]], {"raw_log_id": attempt.name}


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
        source_identity.update(
            provider=source_provider,
            model=source_model,
            effort_requested=header["effort_requested"],
        )
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
        call_args = argparse.Namespace(**vars(args))
        call_args.trial_metadata = dict(arm=arm, case=name, repetition=repetition)
        reply, models, metrics = generate(call_args, prompts[arm], prompt)
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
    if args.provider in ("claude", "codex"):
        identity["transport"] = "isolated-native-session-v1"
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
