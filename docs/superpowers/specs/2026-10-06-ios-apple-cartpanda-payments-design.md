# Coach Fit Pro iOS Payments Design

**Date:** 2026-10-06  
**Status:** Design approved in chat; awaiting written-spec review  
**Scope:** iOS purchase and entitlement flow only. Existing web billing remains unchanged.

## Goal

Prepare Coach Fit Pro for iOS distribution with Apple In-App Purchase and Cartpanda available as payment options where Apple's Brazil-specific rules permit, while preserving current login, access, professional/student relationships, and affiliate attribution.

## Current state

- The app is React 18 + Vite, deployed as a PWA. This repository has no native iOS/Xcode project or StoreKit integration.
- Cartpanda checkout and its Supabase webhook currently activate professional and eligible student/patient subscriptions.
- Student/patient checkout eligibility depends on their professional relationship and current business rules; non-affiliated professionals' client access must not become newly chargeable.
- The existing App Store starter document describes older, more restrictive payment choices and must be superseded for the Brazil-specific path before implementation.

## Selected architecture

Use a Capacitor-based iOS shell around the existing React application, with a small native Swift/StoreKit bridge for Apple IAP and Apple's external-purchase APIs. Keep the web application and current Cartpanda checkout flow intact. Do not rewrite the product natively or create a separate web billing experience.

Supabase remains the authoritative access ledger. StoreKit purchase results and Cartpanda webhooks are independently verified by trusted server-side code and normalized into a provider-aware subscription record. The client may initiate checkout and refresh access, but must never grant access based only on a local success screen or client-supplied payment status.

## Purchase experience

1. Preserve current account creation, invitation, role detection, affiliate checks, and entitlement rules.
2. For an eligible iOS purchase screen in the Brazil storefront and supported iOS version, show Apple IAP and Cartpanda as alternatives. Apple IAP must have equal or greater visual prominence and use Apple's required branding. The purchase flow must not steer users away from Apple.
3. Before a Cartpanda external checkout, use the eligibility/payment checks and StoreKit notice required for external purchase links, then open the configured Cartpanda checkout in the browser. On return, refresh the signed-in account's entitlement from Supabase.
4. On iOS versions, storefronts, or app states not eligible for Apple's alternative-payment path, do not expose a Cartpanda purchase CTA. Offer Apple IAP where configured; otherwise show the existing account/access state without a prohibited external purchase prompt.
5. On the web/PWA, retain the existing Cartpanda flow without UI or pricing changes.
6. Existing Cartpanda subscribers remain valid and keep access according to their existing subscription status. This work must not cause duplicate subscriptions or force migration to Apple.

## Product and account mapping

- Map each App Store product to an explicit product family, role (`professional`, `student`, or `patient`), billing period, and entitlement. Include the currently offered professional cycles and the applicable student/patient subscription only where the current affiliation rules require payment.
- Keep free/unlocked access for student/patient accounts whose professional is not subject to the app subscription charge.
- Preserve role and relationship established by the invitation/account flow; never infer the purchaser's role from an editable client field or trust a checkout return URL.
- Keep Cartpanda products and current affiliate rules intact. Record provider/source on each confirmed payment so Apple sales and Cartpanda sales can be reconciled separately.

## Server-side payment and entitlement lifecycle

- Apple IAP: validate StoreKit-signed transaction data server-side using Apple's documented verification mechanisms; process App Store Server Notifications V2 for renewals, billing retry/grace state, refunds, revocations, and expiration.
- Cartpanda: retain the existing webhook validation, idempotency, and checkout correlation. Add only the external-purchase reporting/token handling required for iOS Cartpanda transactions; do not alter the current web webhook contract unnecessarily.
- Normalize verified events into an entitlement ledger with provider, product, account, original transaction/subscription ID, current period, status, and event identity.
- Enforce idempotency using provider transaction/event IDs. Replayed notifications must not duplicate access grants, subscription periods, affiliate payments, or commissions.
- Access is derived from the verified server-side entitlement state. Refresh on app foreground/return from checkout and support logout/login/session restoration without leaking another account's state.
- Keep all Apple private keys, App Store API credentials, Cartpanda secrets, and service-role credentials server-side. Never ship them in Vite variables or the iOS bundle.

## Affiliate and financial reporting

- Preserve existing attribution captured before purchase and issue a commission only after a verified, paid transaction, following the current rules for that referral type.
- Apple and Cartpanda payments must be distinguishable in the Admin Master affiliate finance views and export data; do not count the same economic payment from both a StoreKit notification and a client callback.
- Do not silently change the existing commission percentage or calculation base. Before enabling Apple purchases in production, the business owner must confirm whether the existing commission base is gross customer price or net proceeds after Apple/Cartpanda fees and taxes. The Apple marketplace commission, Cartpanda processing fees, taxes, refunds, and affiliate payout must be modeled explicitly so the sale is not unprofitable.
- For Cartpanda alternative purchases in Brazil, implement Apple's required External Purchase Server reporting and monthly reporting schedule. The business remains responsible for applicable taxes, refunds, cancellation, subscription support, and required Apple commissions.

## Security and privacy

- No access grant based on query-string flags, browser return parameters, client-side receipt claims, or a successful redirect alone.
- Verify purchaser-to-account association server-side; use a stable app account identifier where supported, and prevent an Apple transaction from being attached to multiple Coach Fit accounts.
- Preserve Supabase RLS and existing authorization boundaries. Provider webhook and notification endpoints must authenticate/verify provider signatures and be replay-safe.
- Do not log full payment credentials, secrets, or unnecessary personal data.

## Required release dependencies

- Account holder accepts the current Apple Developer Program agreement and completes Paid Apps agreements/tax/banking setup as applicable.
- Reserve the final Bundle ID and create the App Store Connect app and subscription products/groups.
- Request and receive Apple's `StoreKit External Purchases or Offers` entitlement for Brazil; configure the matching Xcode entitlement and provisioning profile.
- Confirm Cartpanda Pay's PCI DSS Level 1 status and that its support process covers unauthorized transactions, subscription management, cancellations, and refunds. Include its provider name and readiness in App Review notes.
- Build/sign/test the native iOS app on macOS with Xcode. Windows-only Vite builds cannot produce a distributable signed iOS archive.
- Provide the public support, privacy, and terms pages; test account; review notes; and real device/TestFlight validation.

## Delivery phases

1. Native shell and bridge: establish Capacitor iOS project, universal/deep-link return, Supabase session restoration, and a minimal StoreKit bridge; verify existing app flows still work on device.
2. Apple subscriptions: configure App Store Connect products, implement purchase/restore, server verification, notification handling, and provider-aware entitlements.
3. Cartpanda alternative: implement Brazil/version eligibility checks, Apple's disclosure flow, checkout return, external purchase reporting, and reconciliation without changing web behavior.
4. Affiliate/reporting reconciliation: expose provider-separated verified events and preserve existing commission policy; resolve gross/net commission basis before production enablement.
5. TestFlight and release: test new purchase, renewal, failure/retry, cancellation, refund/revocation, restore, duplicate event, Cartpanda return, role mapping, affiliate attribution, and unsupported storefront/version behavior.

## Acceptance criteria

- The same React product remains usable on web, with existing Cartpanda checkout unchanged.
- On eligible Brazil iOS devices, a qualifying purchase screen presents both Apple and Cartpanda options in compliance with Apple's current design and notice requirements.
- Ineligible contexts never receive a prohibited Cartpanda purchase link from the iOS app.
- Verified Apple and Cartpanda transactions grant/revoke the correct account's access exactly once and survive refresh, relaunch, and re-login.
- Existing affiliate attribution and non-affiliate free-access behavior remain unchanged; verified commissions and payment source are auditable without duplicate entries.
- TestFlight validation covers lifecycle events and account isolation before App Review submission.

## Official references

- [Apple: Payment options available on the App Store in Brazil](https://developer.apple.com/br/support/payment-options-on-the-app-store-in-brazil/)
- [Apple: Changes to iOS in Brazil](https://developer.apple.com/support/app-distribution-in-brazil)
- [Supabase: Product security](https://supabase.com/docs/guides/security/product-security)

