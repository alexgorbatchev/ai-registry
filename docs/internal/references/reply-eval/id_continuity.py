"""Run and score four-turn conversations in isolated native CLI sessions."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from run import HERE, PREFIX, native_command, verify_instructions
from sections.prompts import build

MODELS = {"codex": "gpt-6.2-astra", "claude": "claude-opus-5-5"}
ARMS = {
    "baseline": "evidence-control",
    "candidate": "evidence-ending",
    "source": "source-ending",
}
QUESTIONS = json.loads((HERE / "sections/id-continuity.json").read_text())
NAMES = (
    "AGENTS.md",
    "AGENTS.override.md",
    "CLAUDE.md",
    "CLAUDE.local.md",
    ".claude/CLAUDE.md",
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def bindings(reply):
    """Keep the subject with its own labeled text, regardless of first-turn order."""
    matches = list(PREFIX.finditer(reply))
    pairs = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(reply)
        subjects = set(
            re.findall(r"\b(east|west|south)\b", reply[match.end() : end].lower())
        )
        pairs.append((subjects.pop() if len(subjects) == 1 else None, match.group(1)))
    return pairs


def score(replies):
    first_pairs = bindings(replies[0])
    first = {
        subject: label for subject, label in first_pairs if subject in ("east", "west")
    }
    introduced = [v for _, v in first_pairs if re.fullmatch(r"f[1-9]\d*", v)]
    established = (
        set(first) == {"east", "west"}
        and len(set(first.values())) == 2
        and all(v in introduced for v in first.values())
    )
    initial = established and len(first_pairs) == 2
    lookup = bool(
        re.search(
            r"\b(3|three)\s*(mm|millimet(?:er|re)s?)\b", replies[1], re.IGNORECASE
        )
    )
    lookup = (
        lookup
        and not PREFIX.search(replies[1])
        and not re.search(r"\b(brass|2|two)\b", replies[1], re.IGNORECASE)
    )
    third, fourth = bindings(replies[2]), bindings(replies[3])
    update = recall = False
    if established:
        reserved = introduced + [
            v for v in PREFIX.findall(replies[1]) if re.fullmatch(r"f[1-9]\d*", v)
        ]
        new_id = "f" + str(1 + max(int(v[1:]) for v in reserved))
        update = len(third) == 2 and dict(third) == {
            "east": first["east"],
            "south": new_id,
        }
        south = dict(third).get("south")
        recall = south is not None and fourth == [
            ("west", first["west"]),
            ("south", south),
        ]
    return {
        "initial": initial,
        "lookup": lookup,
        "update": update,
        "recall": recall,
        "continuity": established and update and recall,
        "all_turns": initial and lookup and update and recall,
    }


def conversation(spec, work_root, raw, prompts):
    provider, arm, rep = spec
    args = argparse.Namespace(
        provider=provider, model=MODELS[provider], effort="medium"
    )
    system = prompts[ARMS[arm]]
    attempt = raw / str(uuid.uuid4())
    attempt.mkdir(mode=0o700)
    sessions = attempt / "sessions"
    sessions.mkdir()
    dump(
        attempt / "request.json",
        {
            "provider": provider,
            "model": args.model,
            "arm": arm,
            "repetition": rep,
            "instruction": system,
            "questions": QUESTIONS,
            "effort": args.effort,
        },
    )
    replies = []
    with tempfile.TemporaryDirectory(prefix="reply-eval-", dir=work_root) as scratch:
        home, work = (Path(scratch) / name for name in ("home", "work"))
        home.mkdir()
        work.mkdir()
        env, base = native_command(args, system, attempt, home, sessions)
        session_id = None
        for index, prompt in enumerate(QUESTIONS, 1):
            turn = attempt / str(index)
            turn.mkdir()
            checked = {
                str(p): [name for name in NAMES if os.path.lexists(p / name)]
                for p in (work, *work.parents)
            }
            dump(turn / "ancestors.json", checked)
            if any(checked.values()):
                raise ValueError("Ancestor instructions in native conversation")
            command = base.copy()
            if provider == "claude":
                command[command.index("--debug-file") + 1] = str(turn / "debug.log")
                if session_id is not None:
                    command.extend(["--resume", session_id])
            else:
                command[command.index("-o") + 1] = str(turn / "reply.txt")
                if session_id is not None:
                    command[-1:] = ["resume", session_id, "-"]
            with (
                (turn / "stdout").open("wb") as stdout,
                (turn / "stderr").open("wb") as stderr,
            ):
                result = subprocess.run(
                    command,
                    input=prompt.encode(),
                    cwd=work,
                    env=env,
                    stdout=stdout,
                    stderr=stderr,
                    timeout=180,
                    check=False,
                )
            (turn / "exit-code").write_text(str(result.returncode))
            result.check_returncode()
            (log,) = sessions.rglob("*.jsonl")
            events = [json.loads(line) for line in log.read_text().splitlines()]
            if provider == "claude":
                response = json.loads((turn / "stdout").read_text())
                assert response["subtype"] == "success" and not response.get("is_error")
                assert args.model in response["modelUsage"]
                reply, actual_id = response["result"], response["session_id"]
                seen = [
                    e.get("message", {}).get("content")
                    for e in events
                    if e["type"] == "user"
                ]
                recorded = [
                    p.get("text")
                    for e in events
                    if e["type"] == "assistant"
                    for p in e["message"]["content"]
                    if p["type"] == "text"
                ]
            else:
                actual_id = next(
                    e["payload"]["id"] for e in events if e["type"] == "session_meta"
                )
                banner = (turn / "stderr").read_text().splitlines()
                assert (
                    f"model: {args.model}" in banner
                    and "reasoning effort: medium" in banner
                )
                reply = (turn / "reply.txt").read_text().strip()
                messages = [
                    e["payload"] for e in events if e["type"] == "response_item"
                ]
                seen = [
                    p.get("text")
                    for m in messages
                    if m.get("role") == "user"
                    for p in m["content"]
                ]
                recorded = [
                    p.get("text")
                    for m in messages
                    if m.get("role") == "assistant"
                    for p in m["content"]
                ]
            if index == 1:
                session_id = actual_id
                verify_instructions(provider, [log], system, prompt)
            assert actual_id == session_id and reply.strip() in [
                s.strip() for s in recorded if s
            ]
            assert [s for s in seen if s in QUESTIONS] == QUESTIONS[:index]
            (turn / "reply.txt").write_text(reply)
            replies.append(reply)
    files = {
        p.relative_to(attempt).as_posix(): digest(p.read_bytes())
        for p in sorted(attempt.rglob("*"))
        if p.is_file()
    }
    return {
        "provider": provider,
        "model": args.model,
        "effort": args.effort,
        "arm": arm,
        "repetition": rep,
        "prompt_sha256": digest(system.encode()),
        "raw_log_id": attempt.name,
        "replies": replies,
        "scores": score(replies),
        "files": files,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--raw", type=Path, required=True)
    args = parser.parse_args()
    args.raw = args.raw.resolve()
    args.raw.mkdir(mode=0o700, parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    prompts = build()

    def run(spec):
        provider, arm, rep = spec
        path = args.output / f"{provider}-{arm}-{rep}.json"
        if path.is_file():
            return
        result = conversation(spec, root, args.raw, prompts)
        dump(path.with_suffix(".partial"), result)
        path.with_suffix(".partial").replace(path)

    with tempfile.TemporaryDirectory(prefix="reply-chat-") as scratch:
        root = Path(scratch).resolve()
        with ThreadPoolExecutor(8) as pool:
            list(
                pool.map(
                    run, [(p, a, n) for p in MODELS for a in ARMS for n in range(1, 5)]
                )
            )


if __name__ == "__main__":
    main()
