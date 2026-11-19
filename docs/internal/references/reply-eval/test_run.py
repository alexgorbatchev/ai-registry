import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

from run import HERE, failures, generate_round, lock_output

CASES = {
    case["name"]: case
    for case in json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
}


class ReplyChecks(unittest.TestCase):
    def test_short_answers_still_need_the_answer(self):
        case = CASES["location"]
        self.assertEqual(failures(case, "In each service's build configuration."), [])
        self.assertTrue(failures(case, "Done."))

    def test_extra_evidence_and_excess_length(self):
        case = CASES["location"]
        reply = "In each service build. " + "Review verification metadata. " * 18
        self.assertIn("length", failures(case, reply))
        self.assertIn(
            "unrequested detail: verification metadata", failures(case, reply)
        )

    def test_independent_offer_has_its_own_prefix(self):
        case = CASES["independent-offer"]
        finding = "**f2** The mixed sample passed."
        offer = "I can run the archive next."
        self.assertTrue(failures(case, f"{finding} {offer}"))
        self.assertEqual(failures(case, f"{finding}\n\n- **a1** {offer}"), [])

    def test_mid_sentence_reference_does_not_start_an_item(self):
        errors = failures(
            CASES["completion"], "I did **a4**. Two overlapping builds waited."
        )
        self.assertIn("unlabeled opening", errors)

    def test_revisited_and_new_findings_have_distinct_ids(self):
        case = CASES["new-finding"]
        self.assertEqual(
            failures(case, "**f2** Cache fixed.\n**f3** Exports truncate at 500."), []
        )
        self.assertTrue(
            failures(case, "**f2** Cache fixed.\n**f1** Exports truncate at 500.")
        )

    def test_bold_heading_and_table_ids_are_addressable(self):
        case = CASES["new-finding"]
        for reply in (
            "**f2 Cache restored**.\n**f3: Export limit** 500 rows.",
            "| ID | Finding |\n| --- | --- |\n| **f2** | Cache restored |\n| **f3** | Exports stop at 500 |",
        ):
            self.assertEqual(failures(case, reply), [])

    def test_plain_id_is_not_a_bold_prefix(self):
        self.assertTrue(
            failures(CASES["completion"], "a4 Two overlapping builds waited.")
        )

    def test_requested_detail_includes_the_reasons(self):
        case = CASES["detail-request"]
        self.assertTrue(
            failures(case, "Pause writers. Copy the journal. Resume writers.")
        )
        self.assertEqual(
            failures(
                case,
                "Pause writers to stop new writes. Copy the journal "
                "to preserve a recovery point. Resume writers to restore service.",
            ),
            [],
        )


class ParallelRoundChecks(unittest.TestCase):
    def setUp(self):
        workspace = tempfile.TemporaryDirectory()
        self.addCleanup(workspace.cleanup)
        self.path = Path(workspace.name) / "run.jsonl"
        self.options = SimpleNamespace(
            output=self.path,
            model="fixture",
            effort="medium",
            provider="claude",
            repeat=1,
            jobs=2,
            resume=False,
        )
        self.suite = json.dumps(
            [{"name": "sample", "prompt": "Ask", "concepts": ["yes"]}]
        )
        self.prompts = {"baseline": "first", "candidate": "second"}

    def run_round(self):
        return generate_round(self.options, self.prompts, self.suite)

    def test_resume_only_missing_trials_after_concurrent_failure(self):
        # Both calls must be in flight before either can finish.
        barrier = Barrier(2)

        def generate_pair(args, system, prompt):
            barrier.wait(timeout=3)
            if system == "first":
                raise RuntimeError("fixture failure")
            return "yes", ["fixture"]

        with (
            patch("run.generate", side_effect=generate_pair),
            self.assertRaisesRegex(RuntimeError, "fixture failure"),
        ):
            self.run_round()
        header, candidate = [
            json.loads(line)
            for line in self.path.read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual(candidate["arm"], "candidate")
        self.assertEqual(header["jobs_at_start"], 2)
        self.options.resume = True
        self.options.jobs = 1
        with patch("run.generate", return_value=("yes", ["fixture"])) as generate:
            self.assertEqual(self.run_round(), ({"baseline": 1, "candidate": 1}, 1))
            generate.assert_called_once_with(self.options, "first", "Ask")
            self.run_round()
            self.assertEqual(generate.call_count, 1)
        rows = [
            json.loads(line)
            for line in self.path.read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual(rows[:2], [header, candidate])
        self.assertEqual(rows[2]["jobs"], 1)

    def test_timeout_reports_trial_without_private_arguments(self):
        timeout = subprocess.TimeoutExpired(
            ["provider", "--system-prompt", "private"], 180
        )
        with (
            patch("run.subprocess.run", side_effect=timeout),
            self.assertRaises(RuntimeError) as caught,
        ):
            self.run_round()
        self.assertIn("sample", str(caught.exception))
        self.assertIn("claude timed out after 180s", str(caught.exception))
        self.assertNotIn("private", str(caught.exception))

    def test_resume_rejects_different_inputs_duplicate_or_live_writer(self):
        with patch("run.generate", return_value=("yes", ["fixture"])):
            self.run_round()
        saved = self.path.read_bytes()
        self.options.resume = True
        with patch("run.generate") as generate:
            for key, value in (
                ("repeat", 2),
                ("provider", "codex"),
                ("effort", "low"),
                ("model", "different"),
            ):
                with (
                    self.subTest(option=key),
                    patch.object(self.options, key, value),
                    self.assertRaisesRegex(ValueError, "Resume mismatch"),
                ):
                    self.run_round()
            with self.assertRaisesRegex(ValueError, "suite_sha256"):
                generate_round(self.options, self.prompts, self.suite + "\n")
            with self.assertRaisesRegex(ValueError, "prompt_sha256"):
                generate_round(self.options, {"baseline": "other"}, self.suite)
            with self.path.open("r+") as locked:
                lock_output(locked)
                with self.assertRaisesRegex(ValueError, "Another evaluation"):
                    self.run_round()
            self.assertEqual(self.path.read_bytes(), saved)
            with self.path.open("ab") as log:
                log.write(saved.splitlines(keepends=True)[1])
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                self.run_round()
            generate.assert_not_called()


if __name__ == "__main__":
    unittest.main()
