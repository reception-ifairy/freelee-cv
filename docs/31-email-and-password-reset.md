# Transactional Email & Password Reset

Until now this app could not send a single email. That was not a cosmetic gap: a customer who forgot
their password had **no way back into their account** short of asking the owner to edit the database
by hand. This phase adds an email transport and the first thing that depends on it.

## The transport

`src/lib/email/` is deliberately small, and shaped like `src/lib/media/` — an interface plus drivers,
so the provider is a configuration decision rather than a code change.

| File | Role |
|---|---|
| `types.ts` | `EmailDriver` interface, `EmailMessage` shape |
| `log-driver.ts` | Prints the whole message to the server log |
| `resend-driver.ts` | Resend's HTTP API |
| `send.ts` | Picks a driver per call and sends |

### The log driver is a real driver, not a stub

With no key configured, mail is printed to `pm2 logs` in full, including any link it contains:

```
[email:log] No email provider configured — printing instead of sending.
  to:      someone@example.com
  subject: Reset your Freelee password
  | Hello Reset Tester,
  | ...
  | https://freelee.cv/reset-password?token=5ef7e8eb…
```

This is how the reset flow was verified end to end before any provider existed, and it stays useful:
the owner can complete a reset for a stuck customer by reading the link out of the log. It is not a
silent failure — nothing is discarded.

### Switching to Resend

Set both in **Settings → Email**:

- `resend_api_key`
- `email_from` — e.g. `Freelee <hello@yourdomain.com>`; the domain must be verified with Resend

The driver is chosen **per call**, not cached at startup, so rotating the key takes effect on the
next email with no restart.

> ⚠️ **The Resend driver has not made a real request.** There is no key on this deployment. The
> request shape follows their documented API, but every other integration this month had a bug that
> only appeared on a live call. Assume this one does too until someone runs it.

## Password reset

### Flow

1. `/forgot-password` → `requestPasswordResetAction`
2. A 32-byte random token is generated; only its **SHA-256 hash** is stored in
   `password_reset_tokens`. The raw token exists only in the email.
3. `/reset-password?token=…` → `completePasswordResetAction`
4. The password is updated and **every other outstanding token for that user is invalidated in the
   same transaction**, so an attacker holding a second link from earlier cannot use it.

### Two deliberate security decisions

**Account enumeration.** `/forgot-password` returns the identical message whether or not the address
has an account:

> If that address has an account, a reset link is on its way. It expires in 60 minutes.

Verified with both a real and a fake address — byte-identical responses. Without this, the form is a
free tool for checking which of a leaked email list are customers here.

**One message for every failure mode.** Expired, already-used, and never-existed all produce:

> That link has expired or already been used. Request a new one.

Distinguishing them would confirm that a guessed token was once valid.

### Schema

`drizzle/0027_password_reset.sql` — applied to the live database.

```sql
CREATE TABLE password_reset_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

`used_at` is kept rather than deleting the row, so a reused link can be told apart from a forged one
in the logs.

## What was actually verified

Run against the live site with Playwright, using the log driver:

| Check | Result |
|---|---|
| Login page links to `/forgot-password` | ✅ |
| Known address → generic success | ✅ |
| Unknown address → **identical** message | ✅ |
| `/reset-password` with no token → refuses, offers a new link | ✅ |
| Mismatched passwords rejected | ✅ "Those passwords do not match." |
| Under 8 characters rejected | ✅ "Use at least 8 characters." |
| Valid reset accepted | ✅ "Password updated. You can sign in now." |
| Same link used twice | ✅ blocked |
| `password_hash` actually changed in Postgres | ✅ new bcrypt hash |
| Token row marked consumed | ✅ 1 token, 1 consumed |
| **Signing in with the new password** | ✅ lands on `/dashboard` |

The last row is the one that matters — the earlier rows would all pass even if the write silently
went nowhere.

## Still open

- Resend driver unverified against the live API.
- No rate limiting on `/forgot-password`. It is enumeration-safe but not flood-safe: someone can
  make the box send mail repeatedly. Worth an IP/address throttle before this gets any real traffic.
- No email change / verification flow — reset is the only email-driven journey so far.
