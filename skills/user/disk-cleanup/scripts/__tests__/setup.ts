import { factory_testRoot } from './fixtures';

const root = factory_testRoot('disk-cleanup-tests');
process.env.REGISTRY_TEST_TMPDIR = root;
process.env.TMPDIR = root;
