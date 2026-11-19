"""Check that archived section trials still match their prompts, suites and grades."""

import hashlib
import json
import unittest
from pathlib import Path

from run import failures
from sections.prompts import build

HERE = Path(__file__).resolve().parent


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class SectionTrials(unittest.TestCase):
    def test_rounds_reconstruct_from_source(self):
        prompts = build()
        comparisons = sorted((HERE / "sections").glob("*/comparison.json"))
        self.assertTrue(comparisons)
        for path in comparisons:
            with self.subTest(round=path.parent.name):
                description = json.loads(path.read_text())
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
                for alias, model in (
                    ("astra", "gpt-6.2-astra"),
                    ("opus", "claude-opus-5-5"),
                ):
                    log = directory / f"{directory.name}-{alias}.jsonl"
                    header, *rows = map(json.loads, log.read_text().splitlines())
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
