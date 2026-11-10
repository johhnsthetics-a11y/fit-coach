import ActivityKit
import Capacitor
import Foundation
import UIKit
import UserNotifications

@objc(CoachFitWorkoutRestPlugin)
public class CoachFitWorkoutRestPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoachFitWorkoutRestPlugin"
    public let jsName = "CoachFitWorkoutRest"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCapabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openNotificationSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncRest", returnType: CAPPluginReturnPromise)
    ]

    private static let notificationIdentifier = "coachfit.workout-rest.finished"
    @MainActor private static var activityMutationTask: Task<Bool, Never>?

    private let synchronizationLock = NSLock()
    private var synchronizationGeneration = 0

    private func beginSynchronization() -> Int {
        synchronizationLock.lock()
        defer { synchronizationLock.unlock() }
        synchronizationGeneration += 1
        return synchronizationGeneration
    }

    private func isCurrentSynchronization(_ generation: Int) -> Bool {
        synchronizationLock.lock()
        defer { synchronizationLock.unlock() }
        return synchronizationGeneration == generation
    }

    @objc public func getCapabilities(_ call: CAPPluginCall) {
        let liveActivitiesSupported: Bool
        let liveActivitiesEnabled: Bool
        if #available(iOS 16.1, *) {
            liveActivitiesSupported = true
            liveActivitiesEnabled = ActivityAuthorizationInfo().areActivitiesEnabled
        } else {
            liveActivitiesSupported = false
            liveActivitiesEnabled = false
        }

        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let status = Self.notificationStatusName(settings.authorizationStatus)
                call.resolve([
                    "liveActivitiesSupported": liveActivitiesSupported,
                    "liveActivitiesEnabled": liveActivitiesEnabled,
                    "notificationAuthorizationStatus": status,
                    "notificationAllowed": Self.canScheduleNotifications(settings.authorizationStatus)
                ])
            }
        }
    }

    @objc public func requestNotificationPermission(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { _, error in
            if let error = error {
                DispatchQueue.main.async {
                    call.reject("Não foi possível solicitar permissão para avisos de descanso.", nil, error)
                }
                return
            }
            center.getNotificationSettings { settings in
                DispatchQueue.main.async {
                    let status = Self.notificationStatusName(settings.authorizationStatus)
                    call.resolve([
                        "notificationAuthorizationStatus": status,
                        "notificationAllowed": Self.canScheduleNotifications(settings.authorizationStatus)
                    ])
                }
            }
        }
    }

    @objc public func openNotificationSettings(_ call: CAPPluginCall) {
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else {
            call.reject("Não foi possível abrir os ajustes de notificação.")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(settingsURL, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Não foi possível abrir os ajustes de notificação.")
                }
            }
        }
    }

    @objc public func syncRest(_ call: CAPPluginCall) {
        guard let action = call.getString("action"), ["start", "pause", "end"].contains(action) else {
            call.reject("Ação inválida para sincronizar o descanso.")
            return
        }

        let generation = beginSynchronization()
        let resolveSuperseded: () -> Void = {
            DispatchQueue.main.async {
                call.resolve(["liveActivityEnabled": false, "notificationScheduled": false])
            }
        }
        let remainingSeconds = max(0, min(3600, call.getInt("remainingSeconds") ?? 0))
        let endAtMilliseconds = call.getDouble("endAtMs") ?? 0
        let endDate = endAtMilliseconds > 0
            ? Date(timeIntervalSince1970: endAtMilliseconds / 1000)
            : Date().addingTimeInterval(TimeInterval(max(1, remainingSeconds)))
        if action == "start" && endDate <= Date() {
            call.reject("O horário de término do descanso não é válido.")
            return
        }

        let exerciseName = String((call.getString("exerciseName") ?? "").prefix(80))
        let nextSetNumber = max(1, call.getInt("nextSetNumber") ?? 1)
        let totalSets = max(nextSetNumber, call.getInt("totalSets") ?? nextSetNumber)
        let state = CoachFitWorkoutRestAttributes.ContentState(
            exerciseName: exerciseName,
            nextSetNumber: nextSetNumber,
            totalSets: totalSets,
            endsAt: endDate,
            remainingSeconds: remainingSeconds,
            isPaused: action == "pause"
        )

        let notificationPolicy = call.getString("notificationPolicy") ?? "schedule"
        if action == "end" {
            Self.applyNotificationPolicy(notificationPolicy)
            Task { @MainActor in
                guard self.isCurrentSynchronization(generation) else {
                    resolveSuperseded()
                    return
                }
                let activityUpdated = await Self.enqueueActivityMutation(action: action, state: state)
                DispatchQueue.main.async {
                    guard self.isCurrentSynchronization(generation) else {
                        resolveSuperseded()
                        return
                    }
                    call.resolve([
                        "liveActivityEnabled": activityUpdated,
                        "notificationScheduled": false
                    ])
                }
            }
            return
        }

        let finishSync: (Bool) -> Void = { notificationScheduled in
            guard self.isCurrentSynchronization(generation) else {
                resolveSuperseded()
                return
            }
            Task { @MainActor in
                guard self.isCurrentSynchronization(generation) else {
                    resolveSuperseded()
                    return
                }
                let activityEnabled = await Self.enqueueActivityMutation(action: action, state: state)
                DispatchQueue.main.async {
                    guard self.isCurrentSynchronization(generation) else {
                        resolveSuperseded()
                        return
                    }
                    call.resolve([
                        "liveActivityEnabled": activityEnabled,
                        "notificationScheduled": notificationScheduled
                    ])
                }
            }
        }

        if action == "pause" {
            Self.applyNotificationPolicy("cancelAll")
            finishSync(false)
            return
        }

        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard self.isCurrentSynchronization(generation) else {
                resolveSuperseded()
                return
            }
            let allowed = Self.canScheduleNotifications(settings.authorizationStatus)
            guard allowed else {
                Self.applyNotificationPolicy("cancelPending")
                finishSync(false)
                return
            }
            let interval = max(1, endDate.timeIntervalSinceNow)
            let content = UNMutableNotificationContent()
            content.title = "Descanso concluído"
            content.body = "Hora de voltar ao treino."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            let request = UNNotificationRequest(
                identifier: Self.notificationIdentifier,
                content: content,
                trigger: trigger
            )
            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
            center.removeDeliveredNotifications(withIdentifiers: [Self.notificationIdentifier])
            center.add(request) { error in
                guard self.isCurrentSynchronization(generation) else {
                    resolveSuperseded()
                    return
                }
                finishSync(error == nil)
            }
        }
    }

    private static func notificationStatusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private static func canScheduleNotifications(_ status: UNAuthorizationStatus) -> Bool {
        status == .authorized || status == .provisional || status == .ephemeral
    }

    private static func applyNotificationPolicy(_ policy: String) {
        let center = UNUserNotificationCenter.current()
        if policy == "cancelAll" {
            center.removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
            center.removeDeliveredNotifications(withIdentifiers: [notificationIdentifier])
        } else if policy == "cancelPending" {
            center.removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
        }
    }

    @MainActor
    private static func enqueueActivityMutation(
        action: String,
        state: CoachFitWorkoutRestAttributes.ContentState
    ) async -> Bool {
        let previousTask = activityMutationTask
        let nextTask = Task { @MainActor in
            _ = await previousTask?.value
            if action == "end" {
                return await Self.endLiveActivities(with: state)
            }
            return await Self.updateLiveActivity(action: action, state: state)
        }
        activityMutationTask = nextTask
        return await nextTask.value
    }

    @MainActor
    private static func updateLiveActivity(
        action: String,
        state: CoachFitWorkoutRestAttributes.ContentState
    ) async -> Bool {
        guard #available(iOS 16.1, *) else { return false }
        let activities = Activity<CoachFitWorkoutRestAttributes>.activities

        if let existingActivity = activities.first {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(
                    state: state,
                    staleDate: state.isPaused ? nil : state.endsAt
                )
                await existingActivity.update(content)
            } else {
                await existingActivity.update(using: state)
            }
            for duplicateActivity in activities.dropFirst() {
                if #available(iOS 16.2, *) {
                    await duplicateActivity.end(nil, dismissalPolicy: .immediate)
                } else {
                    await duplicateActivity.end(using: nil, dismissalPolicy: .immediate)
                }
            }
            return true
        }

        guard action == "start", ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        let attributes = CoachFitWorkoutRestAttributes(sessionKey: "active-rest")
        do {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: state.endsAt)
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } else {
                _ = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
            }
            return true
        } catch {
            return false
        }
    }

    @MainActor
    private static func endLiveActivities(
        with state: CoachFitWorkoutRestAttributes.ContentState
    ) async -> Bool {
        guard #available(iOS 16.1, *) else { return false }
        let activities = Activity<CoachFitWorkoutRestAttributes>.activities
        for activity in activities {
            if #available(iOS 16.2, *) {
                await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
            } else {
                await activity.end(using: state, dismissalPolicy: .immediate)
            }
        }
        return !activities.isEmpty
    }
}
