import { factory_testRoot } from "./fixtures";

const testRoot = factory_testRoot("session-analysis-tests");
process.env.REGISTRY_TEST_TMPDIR = testRoot;
process.env.TMPDIR = testRoot;
