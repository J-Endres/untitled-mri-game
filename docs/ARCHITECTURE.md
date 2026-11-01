# Architecture

A static single-page app (Vite + React + TypeScript). For now everything runs in the browser:
the app talks to the MRX MCP gateway directly. Leaderboard and challenges are still mocked.

```
┌──────────────────────────── browser ────────────────────────────┐
│ ui/ ──▶ state/ ──▶ domain/ (model, operations, metrics, pulseq)  │       ┌── MRX MCP gateway ──┐
│             └────▶ services/ SimulationService (mrx/) ───────────┼──────▶│ bifti, rapisim,     │
│                              LeaderboardService (mock)           │ HTTPS │ trajex, reco, files │
└──────────────────────────────────────────────────────────────────┘       └─────────────────────┘
```

## Layers

- **`src/domain/`** - framework-free TypeScript.
  - `sequence/` - the sequence model (`types.ts`), factories, immutable tree operations
    (insert, move, link/unlink, wrap/unwrap), metrics (duration, heuristic SAR) and
    validation (which events may play together).
  - `challenge/` - challenge definitions, constraints and scoring.
  - `pulseq/` - Pulseq 1.4 writer (loop unrolling, trapezoids, RF/ADC/shape libraries).
- **`src/services/`** - interfaces for everything that crosses the network, plus `mock*`
  implementations. `App.tsx` decides which implementation is used: MRX if
  `VITE_MRX_API_KEY` is set, the offline mock otherwise.
  - `mrx/` - minimal MCP client (Streamable HTTP), `.npy` reader/writer, image/SNR helpers and
    the simulation pipeline.
- **`src/state/`** - `sequenceReducer` (UI actions -> domain operations) and `useSimulation`
  (async scan state, discards stale results).
- **`src/ui/`** - React components. `sequence/` is the drag-and-drop editor, `sheets/` holds
  the bottom-sheet popups. `EditorContext` provides the sequence and edit callbacks so the
  recursive lists and the sheets do not need prop drilling.

State is plain `useReducer` + context. There is no global store library, no router and no UI
kit - the app is one screen with popups. Revisit if that stops being true.

## Sequence model

The model mirrors Pulseq so that export is a straightforward walk over the tree:

```ts
Sequence = { nodes: SeqNode[] }
SeqNode  = Block | Loop
Block    = { events: SeqEvent[] }          // all events play simultaneously (= Pulseq block)
Loop     = { count, label, body: SeqNode[] }
SeqEvent = RfEvent | AdcEvent | GradientEvent | SpoilerEvent | DelayEvent
```

- A block with one event is shown as a single card; with several events it is shown as a
  "simultaneous" group. _Linking_ merges two adjacent blocks, _unlinking_ splits an event out.
  A block may hold at most one RF, one ADC, one delay and one gradient per axis
  (`validation.ts`).
- Loops are an editor convenience and are unrolled on export. A gradient's `areaStep` changes
  its area per iteration of the innermost enclosing loop (centred), which expresses phase
  encoding without per-line editing.
- Units: durations in µs, angles in degrees, gradient areas in 1/m (k-space units, as in Pulseq).

## Simulation pipeline (MRX)

One scan (`src/services/mrx/mrxSimulation.ts`):

1. `writePulseq` (domain) turns the sequence into a Pulseq 1.4 file. Loops are unrolled,
   gradient areas become trapezoids on a 10 µs raster with slew-limited ramps. Hardware limits
   (max amplitude) are not enforced yet.
2. `upload_file` stores the `.seq`.
3. In parallel: `trajex_extract_trajectory` (k-space per ADC sample) and `rapisim_simulate` on
   the challenge's phantom (`bifti_get_phantom`, resliced; `sampler: "fft"`).
4. Noise is added in the browser (the simulation is noise-free) and the noisy signal is uploaded
   with `create_upload_url`.
5. `reco_reconstruct` with `method: "nufft"`. FOV is fixed at 200 mm; the matrix is the smallest
   one whose Nyquist limit covers the sampled k-space (the tool rejects anything else).
6. The magnitude image is normalised and shown; SNR is measured on it.

Metrics:

- **Duration** is exact from the sequence (`domain/sequence/metrics.ts`).
- **SAR** is a heuristic based on B1² of the RF pulses. Rapisim does not report SAR.
- **SNR**: complex Gaussian noise per sample, `sigma = NOISE_REL · M0 · sqrt(20 µs / dwell)`.
  `M0` is the phantom's total equilibrium magnetisation, measured once per phantom with a
  reference scan (90° pulse + one sample at k = 0), so the noise level does not depend on the
  simulator's signal scale. SNR = mean object magnitude / noise sigma, with object and
  background separated by Otsu's threshold and sigma from the Rayleigh-distributed background.
  Artefacts in the background therefore lower the SNR too. `NOISE_REL` is a first estimate and
  needs calibrating against real runs.

Known limitations of running in the browser (to be fixed together with OAuth / a backend):
the API key and the phantom choice are visible to the player, every scan leaves files in the
user's MRX storage, and it relies on the gateway allowing cross-origin requests.

## Testing

- Vitest unit tests for everything in `domain/` (including the Pulseq writer) and the pure
  helpers in `services/mrx/`.
- UI is checked manually in a phone viewport for now; add Playwright tests once the UI
  settles.

## Decisions

Short log of choices that are not obvious from the code. Add an entry when you make one.

- **2026-11 - Vite + React + TypeScript.** Widely known, fast tooling, good touch DnD support
  (`@dnd-kit`). Canvas is enough for the image; no game engine needed for a list-based UI.
- **2026-11 - Model = Pulseq blocks + loops.** Keeps export trivial and makes "linking" a
  direct operation on blocks.
- **2026-11 - MRX called from the browser for now.** Fastest way to a playable prototype. Uses a
  test API key that must be removed before release; later OAuth (which also identifies users for
  leaderboard submissions). A backend may still be needed to hide the phantom from players.
- **2026-11 - Own minimal MCP client instead of the SDK.** We only need `initialize` and
  `tools/call`; ~100 lines instead of a large dependency.
- **2026-11 - No state library, no router.** One screen; `useReducer` + context suffice.
