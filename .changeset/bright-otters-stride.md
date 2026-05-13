---
type: Fixed
---
**`phase add` and `phase insert` now handle checkbox-bullet roadmaps** — `phase add` inserts under the in-progress (🚧) milestone section as a `- [ ] **Phase N** —` bullet and generates a minimal README scaffold; `phase insert` detects bullet-style parent phases and inserts a sibling bullet (previously errored with "Phase X not found" on bullet-style roadmaps). Heading-style roadmaps still get the legacy `### Phase N:` insertion.
