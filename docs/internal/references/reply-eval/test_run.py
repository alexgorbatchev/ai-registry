import json
import unittest

from run import HERE, failures

CASES = {case["name"]: case for case in json.loads((HERE / "cases.json").read_text())}


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


if __name__ == "__main__":
    unittest.main()
