export interface LeaderboardEntry {
  player: string
  score: number
  durationS: number
  sar: number
  snr: number
}

export interface LeaderboardService {
  top(challengeId: string): Promise<LeaderboardEntry[]>
}

/** MOCK: static entries until there is a backend. */
export const mockLeaderboardService: LeaderboardService = {
  async top() {
    return [
      { player: 'spin_doctor', score: 812, durationS: 0.23, sar: 1.4, snr: 14.2 },
      { player: 'k-space-cadet', score: 690, durationS: 0.45, sar: 0.9, snr: 21.0 },
      { player: 'larmor_lover', score: 543, durationS: 0.84, sar: 0.3, snr: 30.5 },
      { player: 'gradient_echo', score: 401, durationS: 1.49, sar: 1.9, snr: 11.3 },
    ]
  },
}
