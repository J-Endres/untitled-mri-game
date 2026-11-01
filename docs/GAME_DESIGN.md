# Game design

## Core loop

1. Read the challenge: something unknown lies in the scanner, and there are limits for
   SAR, SNR and scan duration.
2. Build or modify a sequence from building blocks.
3. **Scan** - the sequence is simulated on the hidden phantom and the reconstruction appears
   at the top together with the measured values.
4. Iterate until the image is good enough and all limits are met.
5. **Guess** what is in the scanner. Correct answers that meet all limits get a score and a
   place on the leaderboard.

## Screen (portrait)

| Area   | Content                                                                    |
| ------ | -------------------------------------------------------------------------- |
| Header | Challenge title (tap for brief and limits), leaderboard                    |
| Top    | Reconstructed image; "Outdated" badge after edits. Metric chips vs. limits |
| Middle | Sequence editor (scrolls)                                                  |
| Bottom | _Guess_ and _Scan_                                                         |

Duration and SAR update live while editing, SNR only after a scan.

## Building blocks

| Block    | Parameters                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| RF pulse | flip angle, phase, shape (block/sinc), duration                                |
| ADC      | number of samples, dwell time                                                  |
| Gradient | axis, shape (trapezoid/triangle), area, area step per loop iteration, duration |
| Spoiler  | axis, area, duration                                                           |
| Delay    | duration                                                                       |
| Loop     | name, repetitions; contains other blocks                                       |

Interactions:

- Tap a block to edit it in a bottom sheet (also: unlink, wrap in loop, delete).
- Drag the ⠿ handle to reorder, also into and out of loops (long-press on touch).
- The 🔗 button between two blocks links them: their events play simultaneously
  (e.g. ADC + readout gradient). Disabled when they cannot play together.
- "+ Add" at the end of each list adds a block or loop there.

New players start from a simple gradient echo (FLASH) that almost meets the first
challenge (SNR is just below the limit), so there is something to look at and tweak right away.

## Scoring (draft)

Mock: `score = 1000 / (1 + duration in s)` if the answer is correct and all limits are met,
else 0. Ideas: bonus for fewer blocks, for SAR headroom, for higher resolution.

## Open questions

- How is SNR defined and measured, and how much noise is added to the noise-free simulation?
- Should the answer be multiple choice or free text / tapping a region in the image?
- Which phantoms make good challenges (BrainWeb slices, breast, geometric shapes, ...),
  and how is the difficulty ramped?
- Do we need slice selection (slice-selective RF + gradient) or do we keep 2D single-slice
  phantoms only at first?
- Hardware limits (max gradient amplitude/slew rate) - enforce while editing or only on export?
- Player identity for the leaderboard (anonymous nickname vs. login).

## Roadmap

1. ~~Repo setup, UI mockup with mock services~~ (this state)
2. Pulseq export with tests (loop unrolling, gradient shapes, raster times)
3. Backend: MRX pipeline (export -> trajex -> rapisim -> nufft reco), real SNR
4. Challenges from the backend, answer checking, real leaderboard
5. Polish: onboarding/tutorial challenge, sequence templates, undo, PWA install
