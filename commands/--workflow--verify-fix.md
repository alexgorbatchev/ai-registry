---
description: Verify fix by temporarily disabling it and running tests
targets: ['*']
---

Lets temporarily disable the fix and run the tests to verify that our fix and tests are correct. We should expect to see failures.

If there are no failures, that means our fix is not covered by our tests. In that case:

- Create a new test or modify an existing test to cover the fix.
- Re-run the tests to see the failures.
- Re-apply the fix.
- Re-run the tests to verify the fix.

**CRITICAL**: If the test passes without the fix, the test must be reworked, otherwise it's a useless test.
