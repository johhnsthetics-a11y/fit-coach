import Foundation
import Capacitor
import StoreKit

@objc(CoachFitStoreKitPlugin)
public class CoachFitStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
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

                // Introductory offers are applied by Apple automatically for
                // eligible Apple Accounts. appAccountToken binds our account;
                // it does not reset or override introductory-offer eligibility.
                // Purchase uses this same Product instance that matched the
                // terms shown in the app; Apple remains the final confirmation.
                switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        guard transaction.appAccountToken == accountToken else {
                            call.reject("A compra não pertence à conta Coach Fit Pro conectada.")
                            return
                        }
                        // Only a live, Apple-verified subscription for this
                        // exact product/account can unlock professional tools.
                        guard transaction.productID == productId,
                              transaction.revocationDate == nil,
                              let expiry = transaction.expirationDate,
                              expiry > Date() else {
                            call.reject("A assinatura ainda não está ativa. Verifique a confirmação da Apple ou restaure a compra.")
                            return
                        }
                        await transaction.finish()
                        call.resolve([
                            "verified": true,
                            "purchased": true,
                            "cancelled": false,
                            "pending": false,
                            "transaction": transactionDictionary(transaction)
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
        Task {
            do {
                try await AppStore.sync()
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
            var entitlements: [[String: Any]] = []
            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result else { continue }
                guard acceptedProductIds.isEmpty || acceptedProductIds.contains(transaction.productID) else { continue }
                guard transaction.appAccountToken == accountToken else { continue }
                entitlements.append(entitlementDictionary(transaction))
            }
            call.resolve(["entitlements": entitlements])
        }
    }

    private func productDictionary(_ product: Product) async -> [String: Any] {
        var value: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
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
                value["introductoryPeriodCount"] = offer.periodCount
                value["introductoryPaymentMode"] = String(describing: offer.paymentMode)
                value["introductoryPeriodValue"] = offer.period.value
                value["introductoryPeriodUnit"] = String(describing: offer.period.unit)
            } else {
                value["introductoryOfferAvailable"] = false
                value["introductoryOfferEligible"] = false
            }
        }
        return value
    }

    private func purchaseTermsChanged(_ expected: JSObject, _ current: [String: Any]) -> Bool {
        let stringFields = [
            "id", "displayPrice", "currencyCode", "storefrontCountryCode",
            "subscriptionPeriodUnit", "introductoryDisplayPrice",
            "introductoryPaymentMode", "introductoryPeriodUnit"
        ]
        for key in stringFields {
            if (expected[key] as? String ?? "") != (current[key] as? String ?? "") { return true }
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

    private func transactionDictionary(_ transaction: Transaction) -> [String: Any] {
        var value: [String: Any] = [
            "id": String(transaction.id),
            "originalId": String(transaction.originalID),
            "accountId": transaction.appAccountToken?.uuidString.lowercased() ?? "",
            "productId": transaction.productID,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate)
        ]
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

    private func entitlementDictionary(_ transaction: Transaction) -> [String: Any] {
        let active = transaction.revocationDate == nil
            && (transaction.expirationDate == nil || transaction.expirationDate! > Date())
        var value = transactionDictionary(transaction)
        value["active"] = active
        value["revoked"] = transaction.revocationDate != nil
        return value
    }
}
