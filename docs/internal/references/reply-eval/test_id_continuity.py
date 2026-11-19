"""Check topic binding independently of extra text, ordering and fresh ID choices."""

import hashlib
import json
import unittest

from id_continuity import ARMS, HERE, MODELS, build, score


class ContinuityTests(unittest.TestCase):
    def test_model_assigns_initial_ids_and_reserves_them_through_the_lookup(self):
        first = "**f3** West hinge bent.\n\n**f4** East latch stuck."
        third = "**f5** South seal torn.\n\n**f4** East latch sticks in the cold."
        last = "**f3** West hinge bent.\n\n**f5** South seal torn."
        self.assertTrue(score([first, "3 mm", third, last])["all_turns"])
        extra = score(["**a1** Unable to post.\n\n" + first, "3 mm", third, last])
        self.assertTrue(extra["continuity"])
        self.assertFalse(extra["all_turns"])
        self.assertFalse(
            score([first, "3 mm", third.replace("f5", "f3"), last])["update"]
        )
        self.assertFalse(
            score([first, "3 mm", third, last.replace("f3", "f4")])["recall"]
        )

    def test_archived_conversations(self):
        directory = HERE / "sections/id-continuity"
        prompts = build()
        for provider in MODELS:
            for arm in ARMS:
                for repetition in range(1, 5):
                    path = directory / f"{provider}-{arm}-{repetition}.json"
                    record = json.loads(path.read_text())
                    self.assertEqual(record["scores"], score(record["replies"]))
                    self.assertEqual(record["model"], MODELS[provider])
                    self.assertEqual(record["effort"], "medium")
                    self.assertEqual(
                        record["prompt_sha256"],
                        hashlib.sha256(prompts[ARMS[arm]].encode()).hexdigest(),
                    )
                    self.assertEqual(len(record["replies"]), 4)
                    for i, reply in enumerate(record["replies"], 1):
                        self.assertEqual(
                            hashlib.sha256(reply.encode()).hexdigest(),
                            record["files"][f"{i}/reply.txt"],
                        )
                        self.assertIn(f"{i}/ancestors.json", record["files"])
                    self.assertTrue(any(p.endswith(".jsonl") for p in record["files"]))
