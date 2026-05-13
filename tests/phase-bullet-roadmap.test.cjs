// allow-test-rule: source-text-is-the-product
// ROADMAP.md is a product file authored as text; the bug is that the legacy
// heading-only insertion path failed to recognize bullet-style entries. The
// regression guard must inspect the rewritten ROADMAP.md to confirm the new
// phase landed as a sibling bullet (not a heading appended at the bottom).

/**
 * Regression test for phase add / phase insert on checkbox-bullet ROADMAPs.
 *
 * Bug 1 — `phase add` on a bullet-style ROADMAP (no `### Phase N:` headings,
 * just `- [ ] **Phase N** — desc` bullets nested under a `🚧` milestone
 * section) silently inserted nothing (no error, no entry) or fell back to
 * appending a `### Phase N:` heading at the bottom of the file, breaking the
 * roadmap's visual structure.
 *
 * Bug 2 — `phase insert N <desc>` against the same bullet-style ROADMAP
 * exited with `Phase N not found`, even though the bullet `- [ ] **Phase N**`
 * was clearly present, because the parent-phase lookup matched only
 * `### Phase N:` headings.
 *
 * Fix — `cmdPhaseAdd` now prefers the in-progress (🚧) milestone section
 * and inserts a sibling bullet `- [ ] **Phase N** — <desc>` there; falls
 * back to the legacy heading path only when no 🚧 section exists.
 * `cmdPhaseInsert` detects bullet-style parents and inserts a sibling
 * decimal bullet immediately after the parent.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const BULLET_ROADMAP = `# Roadmap

## Milestones

- 🚧 **v0.2** — Phases 1 scheduled

## Phases

### v0.2 — In progress 🚧

- [ ] **Phase 1** — Foundation ([README](phases/01-foundation/README.md))

---
`;

describe('phase add on bullet-style ROADMAP (regression)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('inserts a sibling bullet under the in-progress milestone section', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), BULLET_ROADMAP);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'should be phase 2 (one past highest existing)');
    assert.strictEqual(output.slug, 'user-dashboard');

    // Directory created via the normal phase-add path.
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-user-dashboard')),
      'phase directory should be created'
    );

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // The fix must produce a bullet entry, not a heading entry — the legacy
    // bug was appending `### Phase 2:` at the bottom, mangling the file.
    assert.match(
      roadmap,
      /^- \[ \] \*\*Phase 2\*\*/m,
      'roadmap should contain a checkbox bullet for the new phase'
    );

    // And the bullet must live inside the in-progress milestone section.
    const inProgressSectionIdx = roadmap.indexOf('🚧');
    const newBulletIdx = roadmap.indexOf('- [ ] **Phase 2**');
    assert.ok(inProgressSectionIdx >= 0, 'in-progress section marker should still exist');
    assert.ok(
      newBulletIdx > inProgressSectionIdx,
      'new phase bullet must appear AFTER the 🚧 milestone header, not at end of file'
    );

    // And the fix must NOT also leave a stray `### Phase 2:` heading.
    assert.doesNotMatch(
      roadmap,
      /^### Phase 2:/m,
      'should not also emit a heading-style entry (would duplicate the phase)'
    );
  });

  test('generates README scaffold in the new phase directory', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), BULLET_ROADMAP);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase add Reporting Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const readmePath = path.join(
      tmpDir, '.planning', 'phases', '02-reporting-dashboard', 'README.md'
    );
    assert.ok(fs.existsSync(readmePath), 'README.md scaffold should be generated');
  });
});

describe('phase insert on bullet-style ROADMAP (regression)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('inserts decimal sibling bullet after the parent bullet phase', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), BULLET_ROADMAP);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Hotfix Auth Bug', tmpDir);
    // Before the fix this returned `Phase 1 not found` because the lookup
    // matched only `### Phase 1:` headings.
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.1', 'should be decimal 01.1');
    assert.strictEqual(output.after_phase, '1');

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01.1-hotfix-auth-bug')),
      'decimal phase directory should be created'
    );

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // Must be inserted as a sibling bullet, not a heading.
    assert.match(
      roadmap,
      /^- \[ \] \*\*Phase 01\.1\*\*/m,
      'roadmap should contain a sibling bullet for the inserted decimal phase'
    );

    // And it must appear AFTER the parent bullet `**Phase 1**`.
    const parentIdx = roadmap.indexOf('**Phase 1**');
    const childIdx = roadmap.indexOf('**Phase 01.1**');
    assert.ok(parentIdx >= 0, 'parent bullet should still be present');
    assert.ok(
      childIdx > parentIdx,
      'inserted decimal bullet must appear after the parent bullet'
    );
  });
});
