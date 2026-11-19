"""Render the recorded reply trials to a single, offline-readable HTML page."""

import hashlib
import json
import re
from collections import defaultdict
from html import escape
from pathlib import Path
from statistics import mean

HERE = Path(__file__).resolve().parent
MODELS = {"gpt-6.2-astra": "Astra 6.2", "claude-opus-5-5": "Opus 5.5"}

ROUND_NAMES = {
    "03": "First holdout",
    "04": "Replay of first holdout",
    "05": "Fresh verification",
    "06": "Replay of verification cases",
    "07": "Final fresh cases",
    "08": "Development regression check",
}


def load_runs():
    suites = {}
    for path in HERE.glob("*.json"):
        data = json.loads(path.read_bytes())
        if isinstance(data, list) and all("prompt" in case for case in data):
            suites[hashlib.sha256(path.read_bytes()).hexdigest()] = (
                path.stem,
                data,
            )
    rounds = defaultdict(list)
    for path in sorted((HERE / "rounds").glob("[0-9]*-*.jsonl")):
        header, *rows = [json.loads(line) for line in path.read_text().splitlines()]
        suite, cases = suites[header["suite_sha256"]]
        planned = {
            (arm, case["name"], rep)
            for arm in header["prompt_sha256"]
            for case in cases
            for rep in range(1, header["repeat"] + 1)
        }
        seen = set()
        for row in rows:
            slot = (row["arm"], row["case"], row["repetition"])
            if slot not in planned or slot in seen:
                raise ValueError(
                    f"{path.name}: unexpected or duplicate response {slot}"
                )
            seen.add(slot)
        number = path.name.split("-", 1)[0]
        rounds[number].append(
            {
                "file": path.name,
                "header": header,
                "suite": suite,
                "cases": cases,
                "rows": rows,
                "planned": len(planned),
                "complete": seen == planned,
            }
        )
    return rounds


def arm_stats(run, arm):
    rows = [row for row in run["rows"] if row["arm"] == arm]
    passed = sum(not row["failed"] for row in rows)
    length = f"{mean(row['words'] for row in rows):.1f}" if rows else "—"
    return passed, len(rows), length


def model_card(run):
    header = run["header"]
    model = header["model"]
    total = header["repeat"] * len(run["cases"])
    bars, lengths = [], []
    for arm in header["prompt_sha256"]:
        passed, count, length = arm_stats(run, arm)
        bars.append(
            f'<div class="score"><span>{escape(arm.title())}</span><span class="track" aria-hidden="true">'
            f'<i class="pass" style="width:{passed / total:.3%}"></i>'
            f'<i class="miss" style="width:{(count - passed) / total:.3%}"></i></span>'
            f'<strong title="Passed / recorded">{passed}/{count}</strong></div>'
        )
        lengths.append(f"{escape(arm)} {length}")
    coverage = f"{len(run['rows'])}/{run['planned']} replies"
    if not run["complete"]:
        coverage += ' · <span class="notice">Partial</span>'
    icon = "✦" if model == "gpt-6.2-astra" else "❀"
    return (
        f'<article class="model"><h4><span class="emblem" aria-hidden="true">{icon}</span> '
        f'{escape(MODELS.get(model, model))}</h4><p class="meta">{escape(str(header["effort_requested"]).title())} effort · '
        f'{coverage}</p>{"".join(bars)}<p class="length">Mean words · {" / ".join(lengths)}</p></article>'
    )


def load_reviews():
    reviews = {}
    for path in (HERE / "rounds").glob("*-review.json"):
        review = json.loads(path.read_text())
        for name, digest in review["sources"].items():
            if hashlib.sha256((path.parent / name).read_bytes()).hexdigest() != digest:
                raise ValueError(f"{path.name}: source changed after review: {name}")
        reviews[path.name.split("-", 1)[0]] = review
    return reviews


def pair(arms, metric):
    return " → ".join(
        f"{arms[arm][metric]}/{arms[arm]['responses']}"
        for arm in ("baseline", "candidate")
    )


def reviewed_round(number, review):
    rows = []
    conclusions = []
    for model, result in sorted(review["summary"].items()):
        arms = result["arms"]
        name = MODELS.get(model, model)
        for key, label in (
            ("automatic_pass", "Automatic checks"),
            ("pass", "Blind review"),
            ("completeness", "Complete"),
            ("concision", "Concise"),
            ("addressability", "IDs and grouping"),
        ):
            counts = "".join(
                f"<td>{arms[arm][key]}/{arms[arm]['responses']}</td>"
                for arm in ("baseline", "candidate")
            )
            rows.append(f"<tr><th>{escape(name)}</th><td>{label}</td>{counts}</tr>")
        baseline, candidate = arms["baseline"], arms["candidate"]
        conclusions.append(
            f"{name} went from {baseline['pass']}/{baseline['responses']} to "
            f"{candidate['pass']}/{candidate['responses']} on blind review."
        )
    if number == "03":
        conclusions.append(
            "The candidate improved Opus ID placement. Nine of its ten replies still missed the concision criterion."
        )
    if number == "05":
        conclusions.append(
            "Both passing Opus candidate replies were status updates that preserved prior IDs. Six replies still carried dispensable material."
        )
    return (
        f'<div class="review"><h4>Blind review · Round {escape(number)}</h4>'
        f"<p>{' '.join(conclusions)}</p><details><summary>Compare scores by criterion</summary>"
        "<table><thead><tr><th>Model</th><th>Criterion</th><th>Baseline</th><th>Candidate</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></details>"
        f'<p class="refs"><a href="rounds/{escape(number)}-review.json">Rubric and individual judgments</a></p></div>'
    )


def candidate_wording(patch):
    if not patch:
        return ""
    added = [
        line[1:]
        for line in (HERE / patch).read_text().splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]
    return (
        f'<section class="wording"><h2 class="section-title">Prompt wording</h2>'
        f"<details><summary>Read the exact revised instructions</summary>"
        f"<pre>{escape(chr(10).join(added))}</pre>"
        f'<a href="{patch}">View the prompt diff</a></details></section>'
    )


def ledger(run, judgments):
    header = run["header"]
    rows = run["rows"]
    entries = []
    for case in run["cases"]:
        replies = []
        for row in sorted(
            (row for row in rows if row["case"] == case["name"]),
            key=lambda row: (row["repetition"], row["arm"]),
        ):
            missed = row["failed"]
            reasons = (
                f'<p class="reason">{escape(" · ".join(missed))}</p>' if missed else ""
            )
            key = (run["file"], row["case"], row["arm"], row["repetition"])
            if key in judgments:
                judgment = judgments[key]
                reasons += (
                    f'<p class="assessment"><b>Blind review · {"Passed" if judgment["pass"] else "Missed"}</b><br>'
                    f"{escape(judgment['reason'])}</p>"
                )
            replies.append(
                f'<details class="reply"><summary>{escape(row["arm"].title())} · repetition {row["repetition"]} · '
                f"Automatic {'miss' if missed else 'pass'} · {row['words']} words</summary>{reasons}"
                f"<pre>{escape(row['reply']).replace(chr(10), '&#10;')}</pre></details>"
            )
        entries.append(
            f'<details class="case"><summary>{escape(case["name"].replace("-", " ").title())}</summary>'
            f'<p class="prompt">{escape(case["prompt"])}</p>{"".join(replies) or "<p>No replies recorded.</p>"}</details>'
        )
    title = f"Round {run['file'].split('-')[0]} · {MODELS.get(header['model'], header['model'])}"
    hashes = " · ".join(
        f"{escape(arm)} <code>{escape(digest)}</code>"
        for arm, digest in header["prompt_sha256"].items()
    )
    return (
        f'<details class="record"><summary>{escape(title)} · {len(rows)}/{run["planned"]} replies</summary>'
        f'<p class="refs"><a href="rounds/{escape(run["file"], quote=True)}">Raw JSONL</a> · '
        f"{escape(header['started_utc'])} · requested {escape(header['model'])}</p>"
        f'<div class="cases">{"".join(entries)}</div><p class="refs">Prompt SHA-256 · {hashes}</p></details>'
    )


def render():
    rounds = load_runs()
    reviews = load_reviews()
    judgments = {
        (entry["source"], entry["case"], entry["arm"], entry["repetition"]): entry
        for review in reviews.values()
        for entry in review["judgments"]
    }
    patches = {
        "01": "candidate.patch",
        "02": "rounds/revision-02.patch",
        "02b": "rounds/revision-02b.patch",
        "04": "rounds/revision-04.patch",
        "05": "rounds/revision-04.patch",
        "06": "rounds/revision-06.patch",
        "07": "rounds/revision-06.patch",
        "08": "rounds/revision-06.patch",
    }
    by_digest = {
        run["header"]["prompt_sha256"]["candidate"]: patch
        for number, patch in patches.items()
        for run in rounds.get(number, [])
        if "candidate" in run["header"]["prompt_sha256"]
    }
    cards, entries = [], []
    for number, runs in sorted(rounds.items(), reverse=True):
        suite = runs[0]["suite"]
        if any(run["suite"] != suite for run in runs):
            raise ValueError(f"Round {number} mixes suites")
        title = ROUND_NAMES.get(
            number, "Development cases" if suite == "cases" else escape(suite)
        )
        review = reviewed_round(number, reviews[number]) if number in reviews else ""
        patch = by_digest.get(runs[0]["header"]["prompt_sha256"].get("candidate"))
        link = f' · <a href="{patch}">Prompt change</a>' if patch else ""
        cards.append(
            f'<section class="round"><div class="round-head"><h3>Round {number} · {title}</h3>'
            f"<small>{len(runs[0]['cases'])} cases{link}</small></div>"
            f'<div class="models">{"".join(model_card(run) for run in runs)}</div>{review}</section>'
        )
        entries.extend(ledger(run, judgments) for run in runs)
    highlight = "<h2>Waiting for target-model replies</h2>"
    if rounds:
        number = "07" if "07" in rounds else max(rounds)
        latest = rounds[number]
        complete = {run["header"]["model"] for run in latest if run["complete"]} == set(
            MODELS
        )
        title = f"Round {number} · {ROUND_NAMES.get(number, 'Development cases')}"
        if number in reviews:
            summary = reviews[number]["summary"]
            parts = []
            for model, result in sorted(summary.items()):
                arms = result["arms"]
                run = next(run for run in latest if run["header"]["model"] == model)
                words = " → ".join(
                    arm_stats(run, arm)[2] for arm in ("baseline", "candidate")
                )
                parts.append(
                    f"<b>{escape(MODELS.get(model, model))}</b> · Blind {pair(arms, 'pass')}, automatic {pair(arms, 'automatic_pass')}, mean words {words}."
                )
            verdict = ""
            if number == "07":
                verdict = (
                    "<p class='verdict'><strong>Adopted revision 06.</strong> "
                    "Opus passed five of eight fresh replies with the new wording. "
                    "Two count answers still overexplained, and one status update opened with an unlabelled recap. "
                    "Astra passed all eight with either prompt.</p>"
                )
            highlight = f"<h2>{title} · baseline → candidate</h2>{verdict}<p>{'<br>'.join(parts)}</p>"
        elif complete:
            highlight = f"<h2>{title} · automatic scores available</h2><p>Blind judgments for this round have not been recorded.</p>"
        else:
            highlight = f"<h2>{title} · partial evidence</h2><p>See the recorded counts for each model below.</p>"
    latest_patch = (
        by_digest.get(
            rounds[max(rounds)][0]["header"]["prompt_sha256"].get("candidate")
        )
        if rounds
        else None
    )
    values = {
        "HIGHLIGHT": highlight,
        "WORDING": candidate_wording(latest_patch),
        "COUNT": str(sum(len(run["rows"]) for runs in rounds.values() for run in runs)),
        "ROUNDS": "\n".join(cards),
        "LEDGER": "\n".join(entries),
    }
    template = (HERE / "summary.template.html").read_text()
    (HERE / "summary.html").write_text(
        re.sub(r"@@([A-Z]+)@@", lambda match: values[match[1]], template)
    )


if __name__ == "__main__":
    render()
