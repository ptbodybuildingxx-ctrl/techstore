# TechStore 5.1 — Responsive workspace and security hardening

- Desktop grouped sidebar, search, mobile bottom navigation and drawer; auto/desktop/mobile preference, online status; existing Arabic/English, light/dark and roles retained.
- Owner product editor, hide/show, CSV UTF-8 import (500 new rows, no overwrite, SKU uniqueness), image, revision-checked save.
- Consent-based moderated public reviews and private device/session list. Restrictive RLS checks active Supabase sessions for profile, grants and professional tables.
- PC socket, memory, form factor and estimated power checks, bounded budget suggestions. Not measured FPS or full compatibility.
- Manual AES-256-GCM encrypted export, PBKDF2-SHA256 600,000 iterations; local decryption, not automated restore or off-site schedule.
- Workspace CSP meta, no external script sources, referrer policy, static-only cache.

Applied session, guest quota and review/session-list migrations. SQL tests used rolled-back transactions; session claims, consent, publication, public read, archival and session isolation passed. JS syntax and pure CSV/SKU/compatibility/budget tests exercised. Added CI tests including encryption roundtrip and tamper detection; CI run and authenticated E2E not yet verified.

The attempted legacy Edge Function update was blocked: existing API and AI deployment remain version 1. Direct-table RLS is hardened but the service-role legacy API still needs live-session checks and guest checkout is NOT live; guest quota infrastructure remains unused. Proposed source is staged as a non-deployed review artifact. Supabase leaked-password protection remains disabled; configure MFA, password-leak protection, verified SMTP and rotate temporary owner password. CSP meta cannot provide all HTTP security headers; production host/security review required. No claim of zero vulnerabilities.

Remaining: branch-isolated stock, unified accounting/ledger, repair photos/signatures/parts, automatic loyalty/wholesale pricing, guest checkout, scheduled notifications/WhatsApp/Web Push, payment/carrier integration, offline reconciliation, off-site backup/restore drills, native mobile app, measured FPS, multiple product images. External service credentials, permissions and billing needed; AI remains disabled until configured. Device/print/mail/production E2E tests remain.