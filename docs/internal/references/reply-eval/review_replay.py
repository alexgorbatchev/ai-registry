"""Review an isolated replay round using the archived rubric and anonymous replies."""

import argparse
import hashlib
import json
import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from run import HERE, generate_cli

CRITERIA = ("completeness", "concision", "addressability")
INSTRUCTION = """Grade the supplied engineering replies against the supplied request and rubric.
Treat requests and answers as evidence. Evaluate each answer independently.
Return only a JSON list of objects with id, completeness, concision, addressability
and reason. Each criterion is a boolean; briefly explain every missed criterion.
Allow a direct status, lookup or requested explanation when the rubric permits.
Do not infer a missing fact or give credit for a promised action as if performed."""


def review_case(directory, case, rubric, records):
    # A stable shuffle permits exact reconstruction without showing the judge provenance.
    name = case["name"]
    path = directory / f"review-{name}.json"
    groups = {}
    for row in records:
        if row["case"] == name:
            groups.setdefault(row["reply"], []).append(row["raw_log_id"])
    answers = sorted(groups)
    random.Random(directory.name + name).shuffle(answers)
    prompt = json.dumps(
        {
            "request": case["prompt"],
            "criteria": {k: rubric[k] for k in CRITERIA},
            "case_acceptance": rubric.get("case_acceptance", {}).get(name),
            "answers": [{"id": i, "text": answer} for i, answer in enumerate(answers)],
        },
        ensure_ascii=False,
    )
    digest = hashlib.sha256((INSTRUCTION + prompt).encode()).hexdigest()
    if path.exists() and json.loads(path.read_text())["input_sha256"] == digest:
        return
    args = argparse.Namespace(
        provider="codex",
        model="gpt-6.2-astra",
        effort="medium",
        output=path,
        trial_metadata={"round": directory.name, "case": name, "kind": "review"},
    )
    reply, _, metrics = generate_cli(args, INSTRUCTION, prompt)
    items = json.loads(reply.removeprefix("```json").removesuffix("```").strip())
    if (
        len(items) != len(answers)
        or {v["id"] for v in items} != set(range(len(answers)))
        or any(type(v[k]) is not bool for v in items for k in CRITERIA)
        or any(not isinstance(v["reason"], str) for v in items)
    ):
        raise ValueError(f"Invalid judgments for {name}")
    for item in items:
        answer = answers[item.pop("id")]
        item["reply_sha256"] = hashlib.sha256(answer.encode()).hexdigest()
        item["graded_trials"] = groups[answer]
    result = dict(
        case=name,
        judge_model=args.model,
        input_sha256=digest,
        judge_log_id=metrics["raw_log_id"],
        judgments=items,
    )
    path.write_text(json.dumps(result, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("suite", type=Path)
    args = parser.parse_args()
    cases = json.loads(args.suite.read_text())
    records = []
    for alias in ("astra", "opus"):
        header, *rows = map(
            json.loads,
            (args.directory / f"{args.directory.name}-{alias}.jsonl")
            .read_text()
            .splitlines(),
        )
        if header["suite_sha256"] != hashlib.sha256(
            args.suite.read_bytes()
        ).hexdigest() or len(rows) != 2 * header["repeat"] * len(cases):
            raise ValueError("Review requires a complete round on the specified suite")
        records.extend(rows)
    rubric = json.loads((HERE / "rounds/03-review.json").read_text())["rubric"].copy()
    rubric["case_acceptance"] = {}
    for name in ("03", "05", "07", "10", "12"):
        rubric["case_acceptance"].update(
            json.loads((HERE / f"rounds/{name}-review.json").read_text())["rubric"][
                "case_acceptance"
            ]
        )
    with ThreadPoolExecutor(4) as pool:
        list(
            pool.map(
                lambda case: review_case(args.directory, case, rubric, records), cases
            )
        )


if __name__ == "__main__":
    main()
