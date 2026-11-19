"""Replay reply cases in fresh requests. Write observations as each request finishes."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import time
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
    if args.provider == "claude":
        command = [
            "claude",
            "-p",
            "--safe-mode",
            "--restricted",
            "--strict-mcp-config",
            "--tools",
            "",
            "--no-session-persistence",
            "--output-format",
            "json",
            "--model",
            args.model,
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
        return data["result"], list(data["modelUsage"])
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
    return choice["message"]["content"], [data["model"]]


def regrade(path):
    header, *rows = [json.loads(line) for line in path.read_text().splitlines()]
    cases_text = (HERE / "cases.json").read_text()
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["claude", "chat"], default="claude")
    parser.add_argument("--model")
    parser.add_argument(
        "--regrade", type=Path, help="score a complete saved run offline"
    )
    parser.add_argument("--baseline", type=Path, default=SOURCE)
    parser.add_argument("--candidate", type=Path, help="full replacement prompt")
    parser.add_argument("--repeat", type=int, default=2)
    parser.add_argument("--output", type=Path, help="new JSONL file")
    parser.add_argument("--check", action="store_true", help="fail on any rubric miss")
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("--repeat must be positive")
    if args.regrade:
        passed = regrade(args.regrade)
        if args.check and not passed:
            raise SystemExit(1)
        return
    if not args.model or not args.output:
        parser.error("generation requires --model and --output")
    prompts = {"baseline": args.baseline.read_text()}
    if args.candidate:
        prompts["candidate"] = args.candidate.read_text()
    cases_text = (HERE / "cases.json").read_text()
    cases = json.loads(cases_text)
    started = time.monotonic()
    passed = dict.fromkeys(prompts, 0)
    with args.output.open("x") as log:

        def record(row):
            print(json.dumps(row, ensure_ascii=False), file=log, flush=True)

        record(
            {
                "provider": args.provider,
                "model": args.model,
                "repeat": args.repeat,
                "started_utc": datetime.now(UTC).isoformat(),
                "suite_sha256": hashlib.sha256(cases_text.encode()).hexdigest(),
                "prompt_sha256": {
                    k: hashlib.sha256(v.encode()).hexdigest()
                    for k, v in prompts.items()
                },
            }
        )
        for rep in range(args.repeat):
            for index, case in enumerate(cases):
                arms = list(prompts)
                if (rep + index) % 2:
                    arms.reverse()
                for arm in arms:
                    reply, models = generate(args, prompts[arm], case["prompt"])
                    if not reply or not reply.strip():
                        raise ValueError("Empty reply")
                    failed = failures(case, reply)
                    passed[arm] += int(not failed)
                    record(
                        {
                            "case": case["name"],
                            "arm": arm,
                            "repetition": rep + 1,
                            "models": models,
                            "words": len(reply.split()),
                            "failed": failed,
                            "reply": reply,
                        }
                    )
                    print(f"{arm} {case['name']}: {failed or 'pass'}", flush=True)
    total = args.repeat * len(cases)
    for arm, count in passed.items():
        print(f"{arm}: {count}/{total} automatic passes")
    if args.check and any(count < total for count in passed.values()):
        raise SystemExit(1)
    print(f"Completed in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()
