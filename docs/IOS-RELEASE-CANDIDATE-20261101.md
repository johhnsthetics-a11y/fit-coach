# Coach Fit Pro — iOS release candidate, 2026-11-01

**Status:** Release candidate for TestFlight validation. **Not yet authorized for public App Store publication.**

## Included fixes

- Keep the complete current React/Vite/Capacitor/Supabase app; no replacement by an older App.jsx and no database migrations.
- Fetch native professional subscription prices only from StoreKit 2 `Product.displayPrice`, including the monthly, six-month and annual product identifiers. Never substitute Cartpanda prices, show a fictitious promotion, or force BRL for a non-Brazil storefront.
- Enable Apple purchases and restore for authenticated professional accounts using StoreKit 2 verified transactions tied by `appAccountToken` to the exact Supabase account UUID. On an account switch, entitlements from the previous account cannot unlock the next.
- Preserve Cartpanda purchase experience on web and all existing subscriptions and affiliated-professional access. Do not change purchase URLs or production data.
- Prevent opening external Cartpanda checkout from the iOS student/patient paywall; paid access previously granted is unaffected. Separate student/patient Apple IAP is **not** implemented.
- Simplify native login without showing web landing promotion prices; preserve web landing.
- Show loading, error, cancellation, pending payment, restore and localized subscription pricing. Include subscription management instructions, terms, privacy and native safe-area handling.
- Extend automated tests of Apple-localized prices, account binding, iOS purchase/restore, native web-checkout separation, and iOS compilation.

## Deployment sequence

1. Review changes in PR #85 and verify GitHub Actions **Quality checks** plus **Coach Fit Pro - iOS TestFlight (manual)** are green.
2. Do **not** merge or publish to the public App Store before a successful signed TestFlight upload and on-device functional verification.
3. Run GitHub Actions with branch `fix/ios-native-subscription-20261101`, operation `testflight`, version `1.0`, a new unused build number such as `2`. Requires the seven existing repository Secrets. Ensure the provisioning profile matches the Apple Distribution certificate.
4. In TestFlight on a real iPhone, verify: professional login/signup; three prices match the App Store purchase sheet; first purchase; cancellation; pending transaction; restore for same Coach account; verify switching to another account **does not** grant access; renewal/expiration/revocation; theme light/dark, notch and bottom navigation; chat, diet, training, account deletion.
5. Check existing professional Cartpanda subscriptions, affiliate access, student/patient access, and web Cartpanda checkout independently after changes.
6. Verify App Store Connect in-app purchase product status and Apple App Review requirements, and confirm production banking, agreements, support/privacy/terms, test credentials and screenshots.
7. Merge PR only after successful on-device verification. Subsequent TestFlight builds can use the main branch and higher build numbers.

## Remaining release risks / limitations

- Apple purchase entitlement is **verified on-device by StoreKit 2** and bound to the account UUID. It is **not reconciled to the Supabase server** and does not automatically activate paid access in the web/PWA; it needs a server-verification/notification integration for cross-platform access, refund and subscription reporting. The current Supabase project contains no Apple entitlement backend or App Store Server Notification endpoint. This must be addressed for a unified cross-platform subscription product.
- Existing StoreKit purchases created **without** an `appAccountToken` cannot be automatically associated with a Coach Fit Pro account under the strict identity check; handle these manually through support/account recovery before public release.
- Student/patient subscription checkout remains available on web only. It is not purchasable in iOS; Apple IAP for student/patient plans or a confirmed compliant alternative is a separate business and App Store configuration decision.
- GitHub CI compilation does not validate signed archive export, App Store Connect upload, real Apple sandbox purchases, checkout review, legal compliance or all UI interactions on real devices.
- The live Supabase security advisor reports `SECURITY DEFINER` functions executable to `anon`; these could be intentional invite-code APIs, but should be audited before claiming an overall security certification. No RLS policy or production database change was applied by this PR.

**Release gate:** Do not report “100% ready for public publication” until these outstanding requirements have been verified.
