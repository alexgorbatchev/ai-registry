import { factory_testRoot } from "./fixtures";

const root = factory_testRoot("hook-tests");
process.env.REGISTRY_TEST_TMPDIR = root;
process.env.TMPDIR = root;
