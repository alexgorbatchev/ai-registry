import { expect, test } from 'bun:test';
import { renderAssessment } from '../renderAssessment';

test('renders completed allocations with readable sizes and safely quoted paths', () => {
  expect(
    renderAssessment({
      type: 'section',
      section: {
        name: 'largePaths',
        isComplete: true,
        data: [{ bytes: 1024 ** 3, path: '/scan/a\nb' }],
        errors: [],
      },
    }),
  ).toBe("largePaths: complete\n1.00 GB\t'/scan/a\\nb'");
});

test('renders nested metadata and partial output without truncating strings or arrays', () => {
  const output = 'x'.repeat(11000);
  expect(
    renderAssessment({
      type: 'section',
      section: {
        name: 'docker',
        isComplete: false,
        data: { output, ids: Array.from({ length: 110 }, (_, index) => index), unknown: null },
        errors: ['daemon unavailable'],
      },
    }),
  ).toBe(
    `docker: INCOMPLETE\n{ output:\n   '${output}',\n  ids:\n   [ ${Array.from({ length: 110 }, (_, index) => index).join(',\n     ')} ],\n  unknown: null }\nError: daemon unavailable`,
  );
});

test('renders pending scans and a final status that does not imply deletion safety', () => {
  expect(
    renderAssessment({
      type: 'progress',
      pending: ['overview'],
      scans: [{ root: '/scan', path: '/scan/project', entries: 123 }],
    }),
  ).toBe("Still inspecting: overview\nScanning '/scan': 123 entries; current '/scan/project'");
  expect(renderAssessment({ type: 'complete', isComplete: true, failed: [] })).toBe(
    'Assessment complete. All sections finished successfully.',
  );
  expect(renderAssessment({ type: 'complete', isComplete: false, failed: ['overview'] })).toBe(
    'Assessment INCOMPLETE. Failed sections: overview. Successful results are shown above.',
  );
});
