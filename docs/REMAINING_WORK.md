# SchoolShop: Remaining Work

This checklist is based on the current project documentation and repository
inspection. It is ordered approximately from easiest to most involved. Some
items are verification gaps rather than missing features.

## Easiest

- [ ] **Verify automatic payout releases with SasaPay.** The setting, daily
  release command, verified-mobile-account eligibility, processing state, and
  signed callback settlement are implemented. Verify the B2C request and
  callback field names against SasaPay's sandbox before enabling real transfers
  in production. Other payout account types remain manual.
- [ ] **Confirm the sold-out-item policy.** Decide whether a sold-out item
  should trigger a refund request immediately or be handled during publisher
  dispatch. Align implementation and user-facing messages with that decision.
- [ ] **Reconcile backend documentation.** Review the backend README's payment
  sections: some wording says payments are not switched on, while later
  sections document provider integrations. State clearly which modes work,
  which require configuration, and which remain unverified.

## Moderate

- [ ] **Complete the documented browser checks.** With mocks off, open and
  exercise the parent refund-request and download screens. Also test the admin
  organisation-document download path.
- [ ] **Run the backend tests and API contract check on PostgreSQL.** Verify
  migrations, API response schemas, and database behavior (especially row
  locking) using PostgreSQL, not only SQLite.
- [ ] **Verify catalog stock behavior.** Confirm publisher stock values are
  correct and test the user-visible result when a title is out of stock,
  including any resulting refund flow.

## Hard

- [ ] **Validate real provider integrations in their sandboxes.** Test Onfon
  SMS delivery and SasaPay payment prompts, callbacks, status checks, and
  refunds. Confirm callback field names and phone-number formats against the
  providers. Do not use production credentials for these checks.
- [ ] **Resolve payment edge cases.** Decide and test what happens when an
  order total includes cents but M-Pesa accepts only whole shillings. Review
  the generated-email behavior used for Paystack when a parent has no email.
- [ ] **Run role-by-role and whole-term end-to-end testing.** With mocks off,
  exercise parent, school, publisher, and admin workflows from booklist and
  order creation through payment, dispatch, delivery, collection, refunds,
  and payout recording.
- [ ] **Add automated checks and CI.** Run backend tests, the API contract
  check, and frontend type-check/build/lint in continuous integration. Add
  frontend tests for important user flows where appropriate.

## Most involved

- [ ] **Prepare production deployment.** Choose hosting and configure the
  production app/API, PostgreSQL, HTTPS, secrets, migrations, uploaded-file
  storage, and payment-provider webhooks.
- [ ] **Prepare ongoing operations.** Schedule the daily order-reminder job
  and define backups, monitoring, recovery, and a production rollout plan.

## Current validation limitations

The frontend build and lint and focused backend tests passed. Backend tests
used SQLite (51 passed); one existing payment test was excluded because its
Linux-only `%-d` date format raises an error on Windows. PostgreSQL row-locking
behavior, the live API contract check, and browser walkthroughs were not run.
The SasaPay payout request and callback contract still require sandbox
verification. Do not treat this checklist as a production-readiness sign-off
until those checks are complete.

## Project references

- Frontend status and launch checklist: [README.md](../README.md)
- Backend setup, API behavior, and provider notes: [SSBackend README.md](../../SSBackend/README.md)
- Backend phases and testing plan: [SSBackend BUILD_PLAN.md](../../SSBackend/BUILD_PLAN.md)
