import ActivityKit
import Foundation

public struct CoachFitWorkoutRestAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public let exerciseName: String
        public let nextSetNumber: Int
        public let totalSets: Int
        public let endsAt: Date
        public let remainingSeconds: Int
        public let isPaused: Bool

        public init(
            exerciseName: String,
            nextSetNumber: Int,
            totalSets: Int,
            endsAt: Date,
            remainingSeconds: Int,
            isPaused: Bool
        ) {
            self.exerciseName = exerciseName
            self.nextSetNumber = nextSetNumber
            self.totalSets = totalSets
            self.endsAt = endsAt
            self.remainingSeconds = remainingSeconds
            self.isPaused = isPaused
        }
    }

    public let sessionKey: String

    public init(sessionKey: String) {
        self.sessionKey = sessionKey
    }
}
