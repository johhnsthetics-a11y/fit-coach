# Coach Fit Pro — iOS 1.0 (18): TestFlight

Branch: `work/build18-storekit-price-parity-20261103`
Base: `work/build16-demo-20261103`, incorporating the build 17 UI changes supplied in the build 18 ZIP.

## What is included
- Native StoreKit fresh-product price, currency, storefront, billing-cycle and introductory-offer parity check before calling `Product.purchase`.
- If terms change: do not open checkout, refresh visible quote and require a second explicit review.
- Native screen presents Apple-confirmed standard and eligible introductory prices separately, blocks incomplete quotes and preserves Apple verification/account token binding.
- Updated iOS version 1.0 (18), service worker cache, regression tests and subscription UI styling.
- Existing workouts, diets, chat safety, affiliates and Supabase migrations are unchanged.

## Build and TestFlight
1. In GitHub repository secrets, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon key only; never service_role).
2. In Actions -> Coach Fit Pro - iOS TestFlight (manual) -> Run workflow, choose this branch, operation `verify`, version `1.0`, build `18`.
3. After all checks succeed, rerun the workflow on the same branch with operation `testflight` and version/build unchanged.
4. In TestFlight on physical iPhone, test valid accounts, StoreKit price and currency, eligible/ineligible intro offer, restore purchase, cancellation, chat and demonstration paths.
5. Apple purchase sheet is the ultimate confirmation: cancel if displayed terms disagree.

## Validation status
The supplied audit reports subscription 47/47, general 461/461, lint, typecheck, Vite build, Capacitor sync and browser QA completed. In a separate environment, the five subscription/StoreKit test suites also passed 47/47 without installing project dependencies. Xcode compilation, Apple signing and TestFlight upload have not yet been run for this GitHub branch.

No Supabase migrations or demonstration SQL seeds were executed here. The optional trainer/student QA seed is contained in the supplied Build 18 ZIP. The release branch does not contain `.env.production`; CI builds use GitHub secrets.
