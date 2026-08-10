# Email

Email is Apollo's way of handing you something too long to speak: a research report, a
note you dictated, a list you want off the device.

## Tool

- `send_email` — `subject` and `body`; the recipient is not a parameter

## Why it needs no confirmation

The recipient is pinned to the `APOLLO_OWNER_EMAIL` var (`wrangler.jsonc`), so the model
cannot address anyone else. That is what keeps the tool `safe` in router terms: the
blast radius of a hallucinated call is one email to your own inbox. Anything that could
reach a third party would need `safety: 'unsafe'` and the confirmation flow described in
[Tools](tools.md).

## Delivery

Resend, secret `RESEND_API_KEY` (`src/notifications/email.ts`). On the free tier without
a verified domain, Resend only delivers to the account owner's own address — which is
exactly the constraint above, enforced twice. Missing key returns a spoken "el email no
está configurado todavía" instead of failing the turn.

## Automatic report delivery

Deep research does not wait to be asked: `src/workflows/background.ts` emails the full
markdown report to the owner as a workflow step, while the device only speaks the short
summary. The send is best-effort — a missing key or a failed send is logged and never
sinks research that already succeeded. See [Research](research.md).

## Navigation

Prev: [Dollar rates](rates.md) · Next: [Sandbox](sandbox.md)
