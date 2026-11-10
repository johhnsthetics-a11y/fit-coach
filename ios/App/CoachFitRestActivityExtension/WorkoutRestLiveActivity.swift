import ActivityKit
import SwiftUI
import WidgetKit

private enum CoachFitRestPalette {
    static let background = Color(red: 0.035, green: 0.055, blue: 0.060)
    static let accent = Color(red: 0.306, green: 0.914, blue: 0.816)
    static let secondary = Color(red: 0.690, green: 0.765, blue: 0.750)
}

private func restCountdownText(_ state: CoachFitWorkoutRestAttributes.ContentState, stale: Bool = false) -> Text {
    if stale {
        return Text("00:00")
    }
    if state.isPaused {
        let minutes = state.remainingSeconds / 60
        let seconds = state.remainingSeconds % 60
        return Text(String(format: "%d:%02d", minutes, seconds))
    }
    return Text(
        timerInterval: Date.now...max(Date.now, state.endsAt),
        countsDown: true,
        showsHours: false
    )
}

private func restActivityIsStale(_ context: ActivityViewContext<CoachFitWorkoutRestAttributes>) -> Bool {
    if #available(iOS 16.2, *) {
        return context.isStale
    }
    return false
}
private struct RestLockScreenView: View {
    let context: ActivityViewContext<CoachFitWorkoutRestAttributes>

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Label("DESCANSO", systemImage: "timer")
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(CoachFitRestPalette.accent)
                Text(context.state.exerciseName.isEmpty ? "Próxima série" : context.state.exerciseName)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(.white)
                Text(restActivityIsStale(context) ? "Hora de voltar" : context.state.isPaused ? "Descanso pausado" : "Próxima: série \(context.state.nextSetNumber) de \(context.state.totalSets)")
                    .font(.subheadline)
                    .foregroundStyle(CoachFitRestPalette.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                restCountdownText(context.state, stale: restActivityIsStale(context))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(CoachFitRestPalette.accent)
                    .accessibilityLabel("Tempo de descanso")
                Text(context.state.isPaused && !restActivityIsStale(context) ? "PAUSADO" : restActivityIsStale(context) ? "CONCLUÍDO" : "RESTANTE")
                    .font(.caption2.weight(.bold))
                    .tracking(1)
                    .foregroundStyle(CoachFitRestPalette.secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}

struct CoachFitWorkoutRestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CoachFitWorkoutRestAttributes.self) { context in
            RestLockScreenView(context: context)
                .activityBackgroundTint(CoachFitRestPalette.background)
                .activitySystemActionForegroundColor(CoachFitRestPalette.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Image(systemName: "timer")
                            .foregroundStyle(CoachFitRestPalette.accent)
                        Text(context.state.exerciseName.isEmpty ? "Descanso" : context.state.exerciseName)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    restCountdownText(context.state, stale: restActivityIsStale(context))
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(CoachFitRestPalette.accent)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(restActivityIsStale(context) ? "Hora de voltar ao treino" : context.state.isPaused ? "Descanso pausado" : "Próxima: série \(context.state.nextSetNumber) de \(context.state.totalSets)")
                        .font(.caption)
                        .foregroundStyle(CoachFitRestPalette.secondary)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(CoachFitRestPalette.accent)
            } compactTrailing: {
                restCountdownText(context.state, stale: restActivityIsStale(context))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(CoachFitRestPalette.accent)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(CoachFitRestPalette.accent)
            }
            .keylineTint(CoachFitRestPalette.accent)
        }
    }
}

@main
struct CoachFitRestActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        CoachFitWorkoutRestLiveActivity()
    }
}
