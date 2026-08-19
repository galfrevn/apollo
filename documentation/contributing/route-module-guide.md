# Route Module Contribution Guide

Apollo route modules should keep transport concerns separate from domain behavior so they remain straightforward to test. A good contribution identifies the request shape, validates untrusted input at the boundary, and returns a stable response for both success and expected failure cases.

When adding or changing a route, document its authentication assumptions, side effects, and error behavior. Prefer a focused test for malformed input and one for the successful path. If a route calls an external service, use a deterministic test double rather than requiring a live credential or network request.

Pull requests should explain the user-visible behavior, list the checks that were run, and avoid mixing route changes with unrelated formatting. Examples must use synthetic identifiers and placeholder secrets.
