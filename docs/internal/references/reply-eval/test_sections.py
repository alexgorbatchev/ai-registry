"""Check that archived section trials still match their prompts, suites and grades."""

import hashlib
import json
import unittest
from pathlib import Path, PurePosixPath

from review_replay import INSTRUCTION, review_input
from run import failures
from sections.prompts import OPS_REMOVALS, build

HERE = Path(__file__).resolve().parent


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class SectionTrials(unittest.TestCase):
    def test_one_operating_paragraph_removed_per_step(self):
        prompts = build()
        previous = prompts["deployed"]
        before, rest = previous.split("# Operating Instructions\n\n")
        ops, after = rest.split("# Git Authorization\n\n")
        remaining = ops.strip().split("\n\n")
        for rank, (name, prefix) in enumerate(OPS_REMOVALS, 1):
            (removed,) = [
                paragraph for paragraph in remaining if paragraph.startswith(prefix)
            ]
            remaining.remove(removed)
            current = prompts[f"ops-{rank:02}-{name}"]
            self.assertEqual(current, previous.replace(removed + "\n\n", "", 1))
            previous = current
        self.assertEqual(remaining, [])
        self.assertEqual(
            previous,
            before + "# Operating Instructions\n\n# Git Authorization\n\n" + after,
        )

    def test_clean_path_receipts(self):
        for audit_path in (HERE / "sections").glob("*/ancestor-audit.json"):
            directory = audit_path.parent
            with self.subTest(round=directory.name):
                audit = json.loads((directory / "ancestor-audit.json").read_text())
                receipts = json.loads((directory / "raw-index.json").read_text())
                workdirs = audit["working_directory_by_raw_log_id"]
                self.assertEqual(set(workdirs), {r["raw_log_id"] for r in receipts})
                self.assertEqual(len(set(workdirs.values())), len(receipts))
                self.assertEqual(audit["matched_files"], [])
                self.assertTrue(
                    {"AGENTS.md", "CLAUDE.md"} <= set(audit["filenames_checked"])
                )
                launcher = PurePosixPath(audit["launcher"])
                self.assertTrue(launcher.is_absolute())
                for receipt in receipts:
                    cwd = PurePosixPath(workdirs[receipt["raw_log_id"]])
                    self.assertEqual(cwd.parent.parent, launcher)
                    self.assertEqual(cwd.name, "work")
                    proof = {
                        "cwd": str(cwd),
                        "checked": {str(p): [] for p in (cwd, *cwd.parents)},
                        "names": audit["filenames_checked"],
                    }
                    self.assertEqual(
                        digest(json.dumps(proof)),
                        receipt["files"]["ancestor-check.json"],
                    )

    def test_rounds_reconstruct_from_source(self):
        prompts = build()
        comparisons = sorted((HERE / "sections").glob("*/comparison.json"))
        self.assertTrue(comparisons)
        for path in comparisons:
            with self.subTest(round=path.parent.name):
                description = json.loads(path.read_text())
                if "rubric" in description:
                    self.assertEqual(
                        description["rubric_sha256"],
                        digest((HERE / description["rubric"]).read_text()),
                    )
                suite = (HERE / description["suite"]).read_text()
                cases = {case["name"]: case for case in json.loads(suite)}
                prompt_hashes = {
                    arm: digest(prompts[description[arm]])
                    for arm in ("baseline", "candidate")
                }
                directory = path.parent
                reviews = json.loads((directory / "judgments.json").read_text())
                self.assertCountEqual([c["case"] for c in reviews], cases)
                grades = {
                    trial: (case["case"], grade["reply_sha256"])
                    for case in reviews
                    for grade in case["judgments"]
                    for trial in grade["graded_trials"]
                }
                receipts = {
                    r["raw_log_id"]: r
                    for r in json.loads((directory / "raw-index.json").read_text())
                }
                for review in reviews:
                    self.assertTrue(
                        receipts[review["judge_log_id"]]["native_transcripts"]
                    )
                all_answers = []
                for alias, model in (
                    ("astra", "gpt-6.2-astra"),
                    ("opus", "claude-opus-5-5"),
                ):
                    log = directory / f"{directory.name}-{alias}.jsonl"
                    header, *rows = map(json.loads, log.read_text().splitlines())
                    all_answers.extend(rows)
                    self.assertEqual(header["suite_sha256"], digest(suite))
                    self.assertEqual(header["prompt_sha256"], prompt_hashes)
                    self.assertEqual(
                        (header["model"], header["effort_requested"], header["repeat"]),
                        (model, "medium", 2),
                    )
                    self.assertCountEqual(
                        [(r["arm"], r["case"], r["repetition"]) for r in rows],
                        [
                            (a, c, k)
                            for a in prompt_hashes
                            for c in cases
                            for k in (1, 2)
                        ],
                    )
                    for row in rows:
                        trial = row["raw_log_id"]
                        self.assertEqual(
                            grades.pop(trial), (row["case"], digest(row["reply"]))
                        )
                        self.assertTrue(receipts[trial]["native_transcripts"])
                        self.assertIn(model, row["models"])
                        self.assertEqual(row["words"], len(row["reply"].split()))
                        self.assertEqual(
                            row["failed"], failures(cases[row["case"]], row["reply"])
                        )
                self.assertFalse(grades)
                if "rubric" in description:
                    rubric = json.loads((HERE / description["rubric"]).read_text())
                    for review in reviews:
                        _, _, prompt = review_input(
                            directory, cases[review["case"]], rubric, all_answers
                        )
                        self.assertEqual(
                            review["input_sha256"], digest(INSTRUCTION + prompt)
                        )
