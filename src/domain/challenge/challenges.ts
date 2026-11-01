import type { Challenge } from './types'

/**
 * MOCK: hard-coded challenges. Later these come from the backend together with
 * the (hidden) phantom, so that the correct answer never reaches the client.
 */
export const challenges: Challenge[] = [
  {
    id: 'first-light',
    title: 'First Light',
    brief:
      'Something is lying in the scanner. Build a sequence that produces a recognisable image ' +
      'and tell us what it is. Keep the patient safe and the scan short.',
    constraints: [
      { metric: 'sar', bound: 'max', limit: 2 },
      { metric: 'snr', bound: 'min', limit: 10 },
      { metric: 'durationS', bound: 'max', limit: 2 },
    ],
    answerOptions: ['Brain', 'Breast', 'Geometric shapes', 'Empty scanner'],
  },
]
