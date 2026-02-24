### Coding Guidelines

- **No explanatory comments**: Do not add comments explaining what the code does. The code must be self-explanatory through clear structure and naming.

- **Meaningful variable names**: Use descriptive and intention-revealing names.

  **Bad variable names:**
  - `a`
  - `x`
  - `tmp`
  - `data`
  - `obj`
  - `value`
  - `result`

  **Good variable names:**
  - `totalInvoiceAmount`
  - `authenticatedUser`
  - `pendingOrders`
  - `retryAttemptCount`
  - `isFeatureEnabled`

- **Small, focused functions**: Each function should have a single responsibility and be small enough to understand at a glance.

- **No premature abstraction**: Only introduce abstractions when duplication actually appears.

- **Prefer immutability**: Avoid mutable shared state whenever possible.

- **Fail fast**: Validate inputs early and explicitly.

- **Design Patterns**:
  - Prefer Object-Oriented Programming (OOP).
  - Use appropriate design patterns when they solve a real problem.
  - Avoid overengineering or applying patterns without clear justification.
  - Favor composition over inheritance when possible.

---

### Testing

#### Philosophy

**Core principle:** Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe what the system does, not how it does it. A good test reads like a specification — e.g. "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (e.g. querying a database directly instead of using the interface). Warning sign: the test breaks when you refactor but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**Do:**
- Verify behavior through the public API only.
- Use descriptive `describe` and `it` names that read like specifications (e.g. "SQS preset: pre-configured queue without manual LocalStack setup", "returns relevant markets for query").
- Write tests that would survive an internal refactor as long as behavior is unchanged.

**Do not:**
- Reference story IDs (e.g. US-01) in test names; use behavior-focused names.
- Mock internal collaborators or test private methods.
- Assert on implementation details (e.g. exact internal function calls, data structure shapes that are not part of the contract).

#### Anti-pattern: Horizontal slices

**Do not** write all tests first, then all implementation. That is "horizontal slicing" — treating RED as "write all tests" and GREEN as "write all code." It produces poor tests:

- Tests written in bulk target imagined behavior, not actual behavior.
- You end up testing the shape of things (data structures, function signatures) rather than user-facing behavior.
- Tests become insensitive to real changes — they pass when behavior breaks, fail when behavior is fine.
- You commit to test structure before understanding the implementation.

**Correct approach: vertical slices (tracer bullets).** One test → one implementation → repeat. Each test responds to what you learned from the previous cycle.

**Wrong (horizontal):**
```
RED:   test1, test2, test3, test4, test5
GREEN: impl1, impl2, impl3, impl4, impl5
```

**Right (vertical):**
```
RED→GREEN: test1 → impl1
RED→GREEN: test2 → impl2
RED→GREEN: test3 → impl3
...
```

#### Workflow

**1. Planning**

Before writing any code:

- Confirm with the user what interface changes are needed.
- Confirm which behaviors to test (prioritize).
- Identify opportunities for deep modules (small interface, deep implementation).
- Design interfaces for testability.
- List the behaviors to test (not implementation steps).
- Get user approval on the plan.

Ask: "What should the public interface look like? Which behaviors are most important to test?" You can't test everything. Focus on critical paths and complex logic.

**2. Tracer bullet**

Write one test that confirms one thing about the system:

- **RED:** Write test for first behavior → test fails.
- **GREEN:** Write minimal code to pass → test passes.

This is the tracer bullet — it proves the path works end-to-end.

**3. Incremental loop**

For each remaining behavior:

- **RED:** Write next test → fails.
- **GREEN:** Minimal code to pass → passes.

Rules: one test at a time; only enough code to pass the current test; don't anticipate future tests; keep tests focused on observable behavior.

**4. Refactor**

After all tests pass, look for refactor candidates: extract duplication, deepen modules, apply SOLID where natural. Run tests after each refactor step. Never refactor while RED; get to GREEN first.

#### Checklist per cycle

- [ ] Test describes behavior, not implementation.
- [ ] Test uses public interface only.
- [ ] Test would survive an internal refactor.
- [ ] Code is minimal for this test.
- [ ] No speculative features added.

#### Step 1: Write user journeys

Format: **As a [role], I want to [action], so that [benefit].**

Example: *As a user, I want to search for markets semantically, so that I can find relevant markets even without exact keywords.*

#### Step 2: Generate test cases

For each user journey, create test cases with `describe` / `it` that name the behavior:

```javascript
describe('Semantic Search', () => {
  it('returns relevant markets for query', async () => {
    // Test implementation
  })

  it('handles empty query gracefully', async () => {
    // Test edge case
  })

  it('falls back to substring search when Redis unavailable', async () => {
    // Test fallback behavior
  })

  it('sorts results by similarity score', async () => {
    // Test sorting logic
  })
})
```

Use descriptive `describe` names (e.g. "SQS preset: pre-configured queue without manual LocalStack setup") so that test output reads like a specification of what the system does.