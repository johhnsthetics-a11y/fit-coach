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
                call.resolve(["products": products.map(productDictionary)])
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

        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Plano não encontrado na App Store.")
                    return
                }

                switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        guard transaction.appAccountToken == accountToken else {
                            call.reject("A compra não pertence à conta Coach Fit Pro conectada.")
                            return
                        }
                        await transaction.finish()
                        call.resolve([
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

    private func productDictionary(_ product: Product) -> [String: Any] {
        var value: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "type": String(describing: product.type)
        ]
        if let subscription = product.subscription {
            value["subscriptionPeriodValue"] = subscription.subscriptionPeriod.value
            value["subscriptionPeriodUnit"] = String(describing: subscription.subscriptionPeriod.unit)
            if let offer = subscription.introductoryOffer {
                value["introductoryDisplayPrice"] = offer.displayPrice
                value["introductoryPeriodCount"] = offer.periodCount
            }
        }
        return value
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
