"""Render the recorded reply trials to a single, offline-readable HTML page."""

import hashlib
import json
import re
from collections import defaultdict
from html import escape
from pathlib import Path
from statistics import mean

HERE = Path(__file__).resolve().parent
MODELS = {
    "gpt-6.2-astra": "Astra 6.2",
    "claude-opus-5-5": "Opus 5.5",
    "claude-haiku-5-5": "Haiku 5.5",
    "gpt-6-luna": "Luna 6",
}

ROUND_NAMES = {
    "03": "First holdout",
    "04": "Replay of first holdout",
    "05": "Fresh verification",
    "06": "Replay of verification cases",
    "07": "Final fresh cases",
    "08": "Development regression check",
    "09": "Replay against the adopted prompt",
    "10": "Fresh challenge",
    "11": "Challenge replay with worked examples",
    "12": "Fresh transfer with worked examples",
    "13": "Second-pass edit · challenge drafts",
    "14": "Second-pass edit · transfer drafts",
    "15": "Cross-model edit · challenge replay",
    "16": "Cross-model edit · transfer replay",
    "17": "Low-effort editors · challenge replay",
    "18": "Low-effort editors · transfer replay",
    "19": "Low-effort edits of Astra drafts · challenge replay",
    "20": "Low-effort edits of Astra drafts · transfer replay",
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


EDIT_SOURCES = {
    "13": "10",
    "14": "12",
    "15": "10",
    "16": "12",
    "17": "10",
    "18": "12",
    "19": "10",
    "20": "12",
}


def count_generations(rounds):
    count = sum(len(run["rows"]) for runs in rounds.values() for run in runs)
    reused = 0
    for number, source_number in EDIT_SOURCES.items():
        originals = {
            (run["file"], row["case"], row["repetition"]): row["reply"]
            for run in rounds.get(source_number, [])
            for row in run["rows"]
            if row["arm"] == "baseline"
        }
        for run in rounds.get(number, []):
            source_path = HERE / "rounds" / run["header"]["source_file"]
            if (
                hashlib.sha256(source_path.read_bytes()).hexdigest()
                != run["header"]["source_sha256"]
            ):
                raise ValueError(f"{run['file']}: editing source changed")
            for row in run["rows"]:
                if row["arm"] == "baseline":
                    key = run["header"]["source_file"], row["case"], row["repetition"]
                    if originals.get(key) != row["reply"]:
                        raise ValueError(
                            f"Round {number} draft differs from its source at {key}"
                        )
                    reused += 1
    return count - reused, reused


def model_label(number, model):
    if number in ("19", "20"):
        return f"Astra 6.2 draft → {MODELS[model]} edit"
    if number in ("15", "16", "17", "18"):
        return f"Opus 5.5 draft → {MODELS[model]} edit"
    return MODELS.get(model, model)


def arm_label(number, arm):
    if number in EDIT_SOURCES:
        return "Raw draft" if arm == "baseline" else "Edited reply"
    versions = {"09": "09", "10": "09", "11": "11", "12": "11"}
    if number in versions:
        version = "06" if arm == "baseline" else versions[number]
        return f"Revision {version}"
    return arm.title()


def model_card(run):
    header = run["header"]
    model = header["model"]
    total = header["repeat"] * len(run["cases"])
    bars, lengths = [], []
    for arm in header["prompt_sha256"]:
        passed, count, length = arm_stats(run, arm)
        label = escape(arm_label(run["file"].split("-")[0], arm))
        bars.append(
            f'<div class="score"><span>{label}</span><span class="track" aria-hidden="true">'
            f'<i class="pass" style="width:{passed / total:.3%}"></i>'
            f'<i class="miss" style="width:{(count - passed) / total:.3%}"></i></span>'
            f'<strong title="Passed / recorded">{passed}/{count}</strong></div>'
        )
        lengths.append(f"{label} {length}")
    edit_metrics = ""
    edits = [
        row
        for row in run["rows"]
        if header.get("mode") == "edit" and row["arm"] == "candidate"
    ]
    if edits:
        duration = mean(row["elapsed_seconds"] for row in edits)
        costs = [row["cost_usd"] for row in edits if "cost_usd" in row]
        cost = (
            f"${sum(costs):.3f} reported for {len(costs)} edits"
            if costs
            else "cost unavailable"
        )
        edit_metrics = (
            f'<p class="length">Editor call · {duration:.1f} s on average · {cost}</p>'
        )
    coverage = f"{len(run['rows'])}/{run['planned']} replies"
    if not run["complete"]:
        coverage += ' · <span class="notice">Partial</span>'
    icon = "✦" if model == "gpt-6.2-astra" else "❀"
    return (
        f'<article class="model"><h4><span class="emblem" aria-hidden="true">{icon}</span> '
        f'{escape(model_label(run["file"].split("-")[0], model))}</h4><p class="meta">{escape(str(header["effort_requested"]).title())} effort · '
        f'{coverage}</p>{"".join(bars)}<p class="length">Mean words · {" / ".join(lengths)}</p>{edit_metrics}</article>'
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


def adoption_result(review):
    opus = review["summary"]["claude-opus-5-5"]["arms"]
    gain = opus["candidate"]["pass"] - opus["baseline"]["pass"]
    reasons = []
    if gain < 3:
        reasons.append(
            f"Opus joint passes changed by {gain:+d}, below the required gain of three"
        )
    for model, result in review["summary"].items():
        arms = result["arms"]
        criteria = [
            ("completeness", "complete replies"),
            ("addressability", "correctly addressed replies"),
        ]
        if model == "gpt-6.2-astra":
            criteria.append(("pass", "joint passes"))
        for metric, label in criteria:
            before, after = arms["baseline"][metric], arms["candidate"][metric]
            if after < before:
                reasons.append(f"{MODELS[model]} {label} fell from {before} to {after}")
    if reasons:
        return "The candidate missed the promotion rule. " + ". ".join(reasons) + "."
    return "The candidate met the numerical promotion rule."


def reviewed_round(number, review):
    rows = []
    conclusions = []
    for model, result in sorted(review["summary"].items()):
        arms = result["arms"]
        name = model_label(number, model)
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
    if number == "12":
        conclusions.append(
            "The worked examples were adopted as revision 11. They gained three Opus joint passes on both the challenge replay and fresh transfer cases, with no paired losses."
        )
    if number in ("10", "12"):
        conclusions.append(adoption_result(review))
        conclusions.append(
            "The adoption rule required at least three additional joint passes on Opus, no loss of joint passes on Astra, and no loss of completeness or ID accuracy on either model."
        )
    if number == "07":
        conclusions.append(
            "Revision 06 was adopted after this comparison with the original baseline. The later trials compare against that adopted version."
        )
    return (
        f'<div class="review"><h4>Blind review · Round {escape(number)}</h4>'
        f"<p>{' '.join(conclusions)}</p><details><summary>Compare scores by criterion</summary>"
        f"<table><thead><tr><th>Model</th><th>Criterion</th><th>{arm_label(number, 'baseline')}</th>"
        f"<th>{arm_label(number, 'candidate')}</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table><p>{escape(review['method'])}</p></details>"
        f'<p class="refs"><a href="rounds/{escape(number)}-review.json">Rubric and individual judgments</a></p></div>'
    )


def candidate_wording(patch, label):
    if not patch:
        return ""
    added = [
        line[1:]
        for line in (HERE / patch).read_text().splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]
    return (
        f"<details><summary>{escape(label)}</summary>"
        f"<pre>{escape(chr(10).join(added))}</pre>"
        f'<a href="{patch}">View the prompt diff</a></details>'
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
                f'<details class="reply"><summary>{escape(arm_label(run["file"].split("-")[0], row["arm"]))} · repetition {row["repetition"]} · '
                f"Automatic {'miss' if missed else 'pass'} · {row['words']} words</summary>{reasons}"
                f"<pre>{escape(row['reply']).replace(chr(10), '&#10;')}</pre></details>"
            )
        entries.append(
            f'<details class="case"><summary>{escape(case["name"].replace("-", " ").title())}</summary>'
            f'<p class="prompt">{escape(case["prompt"])}</p>{"".join(replies) or "<p>No replies recorded.</p>"}</details>'
        )
    title = f"Round {run['file'].split('-')[0]} · {model_label(run['file'].split('-')[0], header['model'])}"
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
        "09": "rounds/revision-09.patch",
        "10": "rounds/revision-09.patch",
        "11": "rounds/revision-11.patch",
        "12": "rounds/revision-11.patch",
    }
    by_digest = {
        run["header"]["prompt_sha256"]["candidate"]: patch
        for number, patch in patches.items()
        for run in rounds.get(number, [])
        if "candidate" in run["header"]["prompt_sha256"]
    }
    total, reused = count_generations(rounds)
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
        if number in EDIT_SOURCES:
            source = EDIT_SOURCES[number]
            link = f' · <a href="editor.md">Editor instructions</a> · raw drafts reused from round {source}'
        cards.append(
            f'<section class="round" id="round-{number}"><div class="round-head"><h3>Round {number} · {title}</h3>'
            f"<small>{len(runs[0]['cases'])} cases{link}</small></div>"
            f'<div class="models">{"".join(model_card(run) for run in runs)}</div>{review}</section>'
        )
        entries.extend(ledger(run, judgments) for run in runs)
    highlight = "<h2>Waiting for target-model replies</h2>"
    if rounds:
        number = next(
            (key for key in ("14", "12", "10", "07") if key in rounds), max(rounds)
        )
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
            if number in ("10", "12"):
                verdict = f"<p class='verdict'><strong>{escape(adoption_result(reviews[number]))}</strong></p>"
            if number == "14":
                verdict = (
                    "<p class='verdict'><strong>Adopted the single-pass worked examples.</strong> On the same transfer cases, second-pass editing and "
                    "single-pass worked examples both passed seven of twelve Opus replies on blind review. "
                    "Astra passed all twelve with all three methods. The editor remains experimental and adds a model call.</p>"
                )
            arms_title = " → ".join(
                arm_label(number, arm).lower() for arm in ("baseline", "candidate")
            )
            highlight = (
                f"<h2>{title} · {arms_title}</h2>{verdict}<p>{'<br>'.join(parts)}</p>"
            )
        elif complete:
            highlight = f"<h2>{title} · automatic scores available</h2><p>Blind judgments for this round have not been recorded.</p>"
        else:
            highlight = f"<h2>{title} · partial evidence</h2><p>See the recorded counts for each model below.</p>"
    if {"11", "12", "13", "14", "15", "16"} <= reviews.keys():

        def passes(numbers, model, arm):
            return sum(
                reviews[number]["summary"][model]["arms"][arm]["pass"]
                for number in numbers
            )

        edits = [
            row
            for number in ("15", "16")
            for run in rounds[number]
            for row in run["rows"]
            if row["arm"] == "candidate"
        ]
        trials = len(edits)
        seconds = mean(row["elapsed_seconds"] for row in edits)
        raw = passes(("15", "16"), "gpt-6.2-astra", "baseline")
        cross = passes(("15", "16"), "gpt-6.2-astra", "candidate")
        same = passes(("13", "14"), "claude-opus-5-5", "candidate")
        opus = passes(("11", "12"), "claude-opus-5-5", "candidate")
        astra = passes(("11", "12"), "gpt-6.2-astra", "candidate")
        highlight = (
            "<h2>Adopted single-pass examples. Tested a separate editor.</h2>"
            f"<p class='verdict'>On the same {trials} Opus drafts, blind passes rose from <strong>{raw} raw</strong> "
            f"to <strong>{same} with an Opus edit</strong> and <strong>{cross} with an Astra edit</strong>. "
            f"The Astra edit added {seconds:.1f} s on average. No second pass is enabled by default.</p>"
            f"<p>With the adopted examples, single-pass Astra passed {astra}/{trials} and Opus {opus}/{trials} "
            "on separately generated replies. The test covered 12 distinct synthetic prompts, each repeated twice. "
            "One reviewer scored the replies and knew a cross-model edit was being tested.</p>"
        )
    editor_rows = []
    for source, numbers in (("Opus 5.5", ("17", "18")), ("Astra 6.2", ("19", "20"))):
        if not set(numbers) <= reviews.keys():
            continue
        cells = []
        for model, arm in (
            ("gpt-6-luna", "baseline"),
            ("gpt-6-luna", "candidate"),
            ("claude-haiku-5-5", "candidate"),
        ):
            scores = [reviews[n]["summary"][model]["arms"][arm] for n in numbers]
            passed = sum(score["pass"] for score in scores)
            total_scored = sum(score["responses"] for score in scores)
            cells.append(f"<td>{passed}/{total_scored}</td>")
        editor_rows.append(f"<tr><th scope='row'>{source}</th>{''.join(cells)}</tr>")
    if editor_rows:
        highlight = (
            "<h2>Does a low-effort editing pass help?</h2>"
            "<div class='review'><table><thead><tr><th>Draft model</th><th>Raw</th>"
            "<th>Luna 6 edit</th><th>Haiku 5.5 edit</th></tr></thead>"
            f"<tbody>{''.join(editor_rows)}</tbody></table></div>"
            "<p>Each row uses the same drafts in all three columns. Counts show replies passing "
            "completeness, concision and ID review across 12 prompts repeated twice. "
            "Both editors used low effort. Editing runs only in this experiment.</p>"
        )
    latest_patch = (
        by_digest.get(
            rounds[max(rounds)][0]["header"]["prompt_sha256"].get("candidate")
        )
        if rounds
        else None
    )
    wording = candidate_wording(latest_patch, "Read the exact revised instructions")
    if "09" in rounds or "10" in rounds:
        wording = candidate_wording(
            "rounds/revision-06.patch", "Revision 06 · adopted in aa692f8"
        )
        wording += candidate_wording(
            "rounds/revision-09.patch",
            "Revision 09 · changes tested against revision 06",
        )
    if "11" in rounds or "12" in rounds:
        wording += candidate_wording(
            "rounds/revision-11.patch",
            "Revision 11 · adopted single-pass worked examples",
        )
    if any(number in rounds for number in EDIT_SOURCES):
        wording += (
            "<details><summary>Second-pass editor · exact system instructions</summary>"
            f"<pre>{escape((HERE / 'editor.md').read_text())}</pre>"
            '<a href="editor.md">Editor source</a></details>'
        )
    comparisons = ""
    if "14" in rounds:
        outcomes = []
        for number in ("10", "12"):
            if number not in reviews:
                continue
            summary = reviews[number]["summary"]
            scores = " · ".join(
                f"{MODELS[model]} {pair(result['arms'], 'pass')}"
                for model, result in sorted(summary.items())
            )
            outcomes.append(
                f'<article class="model"><h4><a href="#round-{number}">Round {number} · {arm_label(number, "candidate")}</a></h4>'
                f'<p class="meta">Revision 06 → candidate · blind passes</p><p>{scores}</p>'
                f'<p class="length">{escape(adoption_result(reviews[number]))}</p></article>'
            )
        comparisons = (
            '<section class="wording"><h2 class="section-title">Single-pass wording trials</h2>'
            f'<div class="models">{"".join(outcomes)}</div></section>'
        )
    values = {
        "HIGHLIGHT": highlight,
        "COMPARISONS": comparisons,
        "WORDING": f'<section class="wording"><h2 class="section-title">Prompt wording</h2>{wording}'
        '<p><a href="../../../../system/system.md">Full shared prompt</a></p></section>',
        "COUNT": str(total),
        "REUSED": f"The ledger contains {total + reused} comparison rows, including {reused} reused baseline entries. The headline counts each generation once."
        if reused
        else "",
        "ROUNDS": "\n".join(cards),
        "LEDGER": "\n".join(entries),
    }
    template = (HERE / "summary.template.html").read_text()
    (HERE / "summary.html").write_text(
        re.sub(r"@@([A-Z]+)@@", lambda match: values[match[1]], template)
    )


if __name__ == "__main__":
    render()
