import Foundation
import Capacitor
import StoreKit

// Test access is local to this running app session, never a production transfer.
private actor SandboxSessionAccess {
    private var accounts: Set<UUID> = []
    func allow(_ account: UUID) { accounts.insert(account) }
    func contains(_ account: UUID) -> Bool { accounts.contains(account) }
}

@objc(CoachFitStoreKitPlugin)
public class CoachFitStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    private let sandboxSession = SandboxSessionAccess()

    public let identifier = "CoachFitStoreKitPlugin"
    public let jsName = "CoachFitStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise)
    ]

    @objc func getProducts(_ call: CAPPluginCall) {
        let productIds = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: productIds)
                let storefront = await Storefront.current
                var productInfo: [[String: Any]] = []
                for product in products {
                    productInfo.append(await productDictionary(product))
                }
                call.resolve([
                    "products": productInfo,
                    "storefrontCountryCode": storefront?.countryCode.uppercased() ?? ""
                ])
            } catch {
                call.reject("Não foi possível carregar os planos da App Store.", nil, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Identificador do plano ausente.")
            return
        }

        guard let rawAccountId = call.getString("accountId"), let accountToken = UUID(uuidString: rawAccountId) else {
            call.reject("Entre na sua conta Coach Fit Pro antes de assinar pela App Store.")
            return
        }
        guard let expectedProductTerms = call.getObject("expectedProductTerms") else {
            call.reject("Atualize os preços da App Store antes de continuar. Nenhuma compra foi iniciada.")
            return
        }

        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Plano não encontrado na App Store.")
                    return
                }

                let storefront = await Storefront.current
                var currentProduct = await productDictionary(product)
                let storefrontCountryCode = storefront?.countryCode.uppercased() ?? ""
                currentProduct["storefrontCountryCode"] = storefrontCountryCode
                guard !purchaseTermsChanged(expectedProductTerms, currentProduct) else {
                    call.resolve([
                        "priceChanged": true,
                        "products": [currentProduct],
                        "storefrontCountryCode": storefrontCountryCode
                    ])
                    return
                }

                if await hasActiveCoachFitSubscriptionLinkedToAnotherAccount(accountToken) {
                    call.reject("Esta Apple ID já possui uma assinatura ativa do Coach Fit Pro que não está vinculada à conta do app conectada. Entre na conta usada originalmente ou fale com o suporte antes de tentar novamente. Nenhuma nova compra foi iniciada.", "apple_account_mismatch")
                    return
                }

                // Avoid asking Apple to purchase an entitlement that is already
                // active for this Coach Fit account, including grace-period access.
                if let entitlement = await currentEntitlement(for: productId, accountToken: accountToken) {
                    call.resolve([
                        "verified": true,
                        "purchased": true,
                        "cancelled": false,
                        "pending": false,
                        "alreadyActive": true,
                        "transaction": transactionDictionary(entitlement, testAccount: accountToken, currentEntitlement: true)
                    ])
                    return
                }

                // Introductory offers are applied by Apple automatically for
                // eligible Apple Accounts. appAccountToken binds our account;
                // it does not reset or override introductory-offer eligibility.
                // Purchase uses this same Product instance that matched the
                // terms shown in the app; Apple remains the final confirmation.
                switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        let transactionAccountToken = transaction.appAccountToken
                        guard transactionAccountToken != nil || isSandboxTransaction(transaction) else {
                            call.reject("A App Store não vinculou esta transação à conta Coach Fit Pro conectada. O acesso não foi liberado; não tente comprar novamente e fale com o suporte.", "apple_account_token_missing")
                            return
                        }
                        guard transactionAccountToken == accountToken || isSandboxTransaction(transaction) else {
                            call.reject("A assinatura retornada pela Apple está vinculada a outra conta Coach Fit Pro. O acesso não foi liberado; entre na conta usada originalmente ou fale com o suporte antes de outra tentativa.", "apple_account_token_mismatch")
                            return
                        }
                        guard transaction.productID == productId, transaction.revocationDate == nil else {
                            call.reject("A compra da Apple não corresponde ao plano selecionado ou foi revogada.")
                            return
                        }
                        if isSandboxTransaction(transaction) { await sandboxSession.allow(accountToken) }

                        // StoreKit currentEntitlements is authoritative when a
                        // subscription is in grace period or the purchase result
                        // carries an older transaction whose expiry has passed.
                        let expiry = transaction.expirationDate
                        if !(expiry.map { $0 > Date() } ?? false) {
                            guard let entitlement = await currentEntitlement(for: productId, accountToken: accountToken) else {
                                await transaction.finish()
                                call.reject("A App Store não confirmou uma assinatura ativa para este plano. Atualize o status ou restaure a compra antes de tentar novamente.")
                                return
                            }
                            await transaction.finish()
                            call.resolve([
                                "verified": true,
                                "purchased": true,
                                "cancelled": false,
                                "pending": false,
                                "alreadyActive": true,
                                "transaction": transactionDictionary(entitlement, testAccount: accountToken, currentEntitlement: true)
                            ])
                            return
                        }

                        await transaction.finish()
                        call.resolve([
                            "verified": true,
                            "purchased": true,
                            "cancelled": false,
                            "pending": false,
                            "transaction": transactionDictionary(transaction, testAccount: accountToken)
                        ])
                    case .unverified(_, let error):
                        call.reject("A compra não pôde ser verificada.", nil, error)
                    }
                case .userCancelled:
                    call.resolve(["purchased": false, "cancelled": true, "pending": false])
                case .pending:
                    call.resolve(["purchased": false, "cancelled": false, "pending": true])
                @unknown default:
                    call.reject("A App Store retornou um estado de compra desconhecido.")
                }
            } catch {
                call.reject("Não foi possível concluir a compra pela App Store.", nil, error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        guard let rawAccountId = call.getString("accountId"), let accountToken = UUID(uuidString: rawAccountId) else {
            call.reject("Entre na sua conta Coach Fit Pro antes de restaurar compras.")
            return
        }
        Task {
            do {
                try await AppStore.sync()
                await sandboxSession.allow(accountToken)
                call.resolve(["restored": true])
            } catch {
                call.reject("Não foi possível restaurar as compras.", nil, error)
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        let acceptedProductIds = Set(call.getArray("productIds", String.self) ?? [])
        guard let rawAccountId = call.getString("accountId"), let accountToken = UUID(uuidString: rawAccountId) else {
            call.reject("Identificador da conta Coach Fit Pro ausente.")
            return
        }
        Task {
            let sandboxAllowed = await sandboxSession.contains(accountToken)
            var entitlements: [[String: Any]] = []
            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result else { continue }
                guard acceptedProductIds.isEmpty || acceptedProductIds.contains(transaction.productID) else { continue }
                guard transaction.appAccountToken == accountToken
                    || (isSandboxTransaction(transaction) && sandboxAllowed) else { continue }
                entitlements.append(entitlementDictionary(transaction, testAccount: accountToken))
            }
            call.resolve(["entitlements": entitlements])
        }
    }

    private func currentEntitlement(for productId: String, accountToken: UUID) async -> Transaction? {
        let sandboxAllowed = await sandboxSession.contains(accountToken)
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productID == productId,
                  transaction.revocationDate == nil else { continue }
            guard transaction.appAccountToken == accountToken
                || (isSandboxTransaction(transaction) && sandboxAllowed) else { continue }
            return transaction
        }
        return nil
    }

    private func productDictionary(_ product: Product) async -> [String: Any] {
        var value: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "priceAmount": NSDecimalNumber(decimal: product.price).stringValue,
            "currencyCode": product.priceFormatStyle.currencyCode,
            "type": String(describing: product.type)
        ]
        if let subscription = product.subscription {
            value["subscriptionPeriodValue"] = subscription.subscriptionPeriod.value
            value["subscriptionPeriodUnit"] = String(describing: subscription.subscriptionPeriod.unit)
            value["subscriptionGroupId"] = subscription.subscriptionGroupID
            if let offer = subscription.introductoryOffer {
                // StoreKit determines eligibility for the Apple Account and
                // subscription group. A listed offer is NOT proof of eligibility.
                let eligible = await subscription.isEligibleForIntroOffer
                value["introductoryOfferAvailable"] = true
                value["introductoryOfferEligible"] = eligible
                value["introductoryDisplayPrice"] = offer.displayPrice
                value["introductoryPriceAmount"] = NSDecimalNumber(decimal: offer.price).stringValue
                value["introductoryPeriodCount"] = offer.periodCount
                value["introductoryPaymentMode"] = String(describing: offer.paymentMode)
                value["introductoryPeriodValue"] = offer.period.value
                value["introductoryPeriodUnit"] = String(describing: offer.period.unit)
            } else {
                value["introductoryOfferAvailable"] = false
                value["introductoryOfferEligible"] = false
                value["introductoryPriceAmount"] = ""
            }
        }
        return value
    }

    private func purchaseTermsChanged(_ expected: JSObject, _ current: [String: Any]) -> Bool {
        let stringFields = [
            "id", "currencyCode", "storefrontCountryCode",
            "subscriptionPeriodUnit", "introductoryPaymentMode",
            "introductoryPeriodUnit"
        ]
        for key in stringFields {
            if (expected[key] as? String ?? "") != (current[key] as? String ?? "") { return true }
        }

        for key in ["priceAmount", "introductoryPriceAmount"] {
            let expectedRaw = expected[key] as? String ?? ""
            let currentRaw = current[key] as? String ?? ""
            if expectedRaw.isEmpty != currentRaw.isEmpty { return true }
            if !expectedRaw.isEmpty {
                let locale = Locale(identifier: "en_US_POSIX")
                guard let expectedAmount = Decimal(string: expectedRaw, locale: locale),
                      let currentAmount = Decimal(string: currentRaw, locale: locale),
                      expectedAmount == currentAmount else { return true }
            }
        }

        let booleanFields = ["introductoryOfferAvailable", "introductoryOfferEligible"]
        for key in booleanFields {
            if (expected[key] as? Bool ?? false) != (current[key] as? Bool ?? false) { return true }
        }

        let numberFields = ["subscriptionPeriodValue", "introductoryPeriodValue", "introductoryPeriodCount"]
        for key in numberFields {
            let expectedValue = (expected[key] as? NSNumber)?.intValue ?? 0
            let currentValue = (current[key] as? NSNumber)?.intValue ?? 0
            if expectedValue != currentValue { return true }
        }
        return false
    }

    private func hasActiveCoachFitSubscriptionLinkedToAnotherAccount(_ accountToken: UUID) async -> Bool {
        let now = Date()
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  !isSandboxTransaction(transaction),
                  transaction.productID.hasPrefix("br.com.coachfitpro.ios.profissional."),
                  transaction.appAccountToken != accountToken,
                  transaction.revocationDate == nil,
                  let expiry = transaction.expirationDate,
                  expiry > now else { continue }
            return true
        }
        return false
    }

    private func isSandboxTransaction(_ transaction: Transaction) -> Bool {
        guard transaction.productID.hasPrefix("br.com.coachfitpro.ios.profissional.") else { return false }
        if #available(iOS 16.0, *) {
            return transaction.environment == .sandbox
        }
        return false
    }

    private func transactionDictionary(_ transaction: Transaction, testAccount: UUID? = nil, currentEntitlement: Bool = false) -> [String: Any] {
        var value: [String: Any] = [
            "id": String(transaction.id),
            "originalId": String(transaction.originalID),
            "accountId": transaction.appAccountToken?.uuidString.lowercased() ?? "",
            "productId": transaction.productID,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate)
        ]
        if let testAccount, isSandboxTransaction(transaction) {
            value["originalAccountId"] = transaction.appAccountToken?.uuidString.lowercased() ?? ""
            value["accountId"] = testAccount.uuidString.lowercased()
            value["testSessionAccess"] = true
            value["environment"] = "Sandbox"
        }
        if currentEntitlement {
            value["currentEntitlement"] = true
        }
        if let expirationDate = transaction.expirationDate {
            value["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
        }
        // Never substitute Product.displayPrice for the signed transaction's
        // amount. StoreKit Decimal is in currency units, not JWS milliunits.
        if #available(iOS 17.2, *),
           let price = transaction.price, let currency = transaction.currency {
            value["transactionPrice"] = NSDecimalNumber(decimal: price).stringValue
            value["transactionCurrencyCode"] = currency.identifier
        }
        if transaction.offerType == .introductory {
            value["appliedOfferType"] = "introductory"
        } else if transaction.offerType == nil {
            value["appliedOfferType"] = "none"
        } else {
            value["appliedOfferType"] = "other"
        }
        return value
    }

    private func entitlementDictionary(_ transaction: Transaction, testAccount: UUID? = nil) -> [String: Any] {
        // Entries come from Apple's currentEntitlements sequence, which includes
        // subscriptions that are subscribed or in grace period.
        let active = transaction.revocationDate == nil
        var value = transactionDictionary(transaction, testAccount: testAccount, currentEntitlement: active)
        value["active"] = active
        value["revoked"] = transaction.revocationDate != nil
        return value
    }
}
