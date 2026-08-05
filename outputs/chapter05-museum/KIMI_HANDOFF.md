# KIMI HANDOFF — Chapter 5 · MINIATURE GALLERY (vertical slice 1)

Date: 2026-08-04 · Owner wave: Wave B (Kimi) · Status: standalone playable, NOT integrated

Scope claim: this is **one** reliable vertical slice of `THE MUSEUM OF ONE ANSWER`
(the Miniature Gallery). Chapter 5 as a whole (Film Corridor, Multiple
Portrait Hall) and the full game are **not** claimed complete.

Core sentence delivered: *"Where you place evidence changes the story the
museum makes physically real."* — also mounted in-world as the gallery plaque.

## 1. What the slice does

1. Butch (only controllable character) walks a fixed-camera 2.5D diorama
   gallery. No free camera, no photography mode; the gallery and the
   reconstruction are two fixed 960×600 compositions joined by a hard cut.
2. Walking to the pedestal + `E` opens the inspect close-up. `←/→` rotates the
   punched ticket; inside the lamplight window (130–230°) a hidden second
   punch pattern burns through (`HIDDEN MARK — punched twice`). `E` before the
   reveal produces an explicit rub-blank non-result, never silence. `Q` puts
   the ticket back.
3. The ticket can be placed into two clearly labelled display contexts:
   - **CASE A — THE DEPARTURE** → the glass diorama physically rebuilds into a
     platform with an open door (cyan thread), and the museum makes it real:
     the ENGINE ROUTE door grate travels up. Walking through it cuts to the
     reconstruction view — a short walkable route ending at the WITNESS MARK,
     which completes the slice.
   - **CASE B — THE ERROR LEDGER** → the same miniature physically rebuilds
     into a bricked-over platform (red thread), a seal plate locks the route
     door, and the wall plaque reads `VERDICT: MISPRINT`. Complete, readable
     wrong result.
4. The wrong result is revocable in place: `E` at the case takes the ticket
   back, the seal lifts, the diorama dissolves. No level reset, no replay
   penalty. The same ticket can then open the route via Case A.
5. `source → relationship → result` is the literal on-screen grammar: ticket
   (source) → case mount thread, amber while travelling (relationship) →
   miniature rebuild + physical door/grate/seal (result). Cyan/amber/red
   follow the locked global signal language.
6. All player-facing text is English and lives in one data file.

## 2. Input route (ordinary keyboard, standalone entry)

- Serve: `npx vite --config vite.chapter05.config.js` → `http://localhost:5185/museum.html`
  (the shared `npm run dev` on :5180 also serves `/museum.html`).
- Controls: `ARROWS/WASD` move · `E` interact · `Q` put back (inspect) ·
  `R` reset.
- Full route: walk right → `E` at pedestal → rotate right ~0.7 s → `E` pocket
  → walk to CASE B → `E` (wrong result, sealed) → `E` (take back) → walk to
  CASE A → `E` (route opens) → walk right through the door → walk to the
  WITNESS MARK → complete. `R` resets deterministically at any point.

## 3. Files changed (all new; zero existing files modified)

| Path | Role |
|---|---|
| `museum.html` | standalone entry page |
| `vite.chapter05.config.js` | dedicated dev/build config (port 5185, outDir `dist-chapter05/`); shared `vite.config.js` untouched |
| `src/chapters/museum/levelData.js` | layout, tuning, palette, all English strings |
| `src/chapters/museum/model/galleryModel.js` | pure logic: deterministic `update(dtMs, input)`, `snapshot()`, `reset()`, `drainEvents()`, `describeState()` text contract |
| `src/chapters/museum/MuseumScene.js` | Phaser presentation only; syncs every visual from the model snapshot |
| `src/chapters/museum/museum-main.js` | standalone boot + `window.render_game_to_text()` |
| `src/chapters/museum/assets/slots.js` | replaceable asset slots (original graphite/vellum blockout painters) |
| `src/chapters/museum/assets/ASSET_SLOTS.md` | runtime import contract per SHARED_ASSET_AND_VOICE_HANDOFF §4 |
| `tests/chapter05/galleryModel.test.mjs` | 10 focused tests |
| `outputs/chapter05-museum/qa/drive-and-shoot.mjs` | real-browser CDP QA driver (real keyboard events + screenshots) |
| `outputs/chapter05-museum/qa/text-states.jsonl` | `render_game_to_text()` at every beat of the real playthrough |
| `outputs/chapter05-museum/shots/01..06*.png` | entry / inspect / correct / wrong / withdraw / complete |
| `dist-chapter05/` | production build output of the standalone entry |

Forbidden areas verified untouched: `src/main.js`, `src/scenes/GameScene.js`,
shared routing/save/RESONANCE contracts, `package.json`, lockfile, all other
chapters and scenes. `git status` confirms every modified tracked file in the
worktree predates this slice (other owners' work, preserved). No commits, no
pushes, no staging.

## 4. Test / build / QA results (2026-08-04)

- Focused: `node --test tests/chapter05/*.test.mjs` → **10/10 pass**
  (inspect+reveal, rub-blank non-silence, both placements, wrong result
  announced via `route-sealed`, in-place withdrawal, door collider, A-withdraw
  reversibility, ten identical resets, reset-replay snapshot equivalence,
  JSON-safe text contract).
- Full suite: `node --test 'tests/**/*.test.mjs'` → **539/539 pass**
  (baseline before this slice: 513/513; concurrent owners added the rest).
- `npm run assets:check` → verified 10 panoramas / 30 textures.
- `npm run build` (shared) → pass; `npx vite build --config vite.chapter05.config.js` → pass.
- `git diff --check` → clean.
- Real playthrough: `node outputs/chapter05-museum/qa/drive-and-shoot.mjs`
  boots the actual entry in headless Chrome, plays with real CDP keyboard
  events (no QA jumps, no state writes) → **QA-DRIVER-RESULT: PASS**;
  `render_game_to_text()` matched the visible state at all 8 recorded beats,
  including a live `R` reset back to the pedestal state.

## 5. Known risks / limitations

1. All art is original blockout placeholder by design (asset slots); final
   graphite/vellum treatment belongs to Jason's pass. Wall panel frames are
   empty — deliberate, awaiting curated filler with provenance.
2. Butch can stand in front of a case while its label sits behind him; minor
   overlap, readability unaffected.
3. Rebuild/dissolve lock the case for 0.9–1.4 s (no mid-animation withdraw).
   Chosen for readability; trivially tunable in `TUNING`.
4. Movement is dt-based and deterministic, but the browser play route in the
   QA driver uses wall-clock holds, so its screenshot positions vary by a few
   px run to run. Logic tests use fixed 16 ms steps and are exact.
5. The slice's completion is terminal-until-`R` by design (plaque state).
6. `dist-chapter05/` is left in the worktree as build evidence; Codex may
   ignore/delete it at integration.

## 6. Future shared-integration needs (contracts for Codex, not implemented)

1. **Chapter lifecycle**: scene key `MuseumGallery`; boot via
   `museum-main.js` pattern. Needs a chapter-manifest entry + transition
   envelope at integration (owned by Codex).
2. **Events worth hoisting** (payload = `describeState()` diff):
   `museum:ticket-mark-revealed`, `museum:interpretation-active {caseId, interpretation}`,
   `museum:route-open`, `museum:route-sealed`, `museum:slice-complete`.
   Chapter 6's "place the punched ticket into the incomplete display" beat can
   reuse the ticket + placement contract verbatim.
3. **Save/checkpoint**: `snapshot()` is plain JSON; one restore hook
   (`createGalleryModel(snapshot)`) is the only addition needed — flagged, not
   built, per scope freeze.
4. **Audio/voice**: Archivist verdict stinger on `route-sealed` and ambient
   gallery room tone; English voice per the locked voice cards.
5. **Narrative continuity**: the ticket's two-station mark is a Chapter 5
   revelation seed (archives disagree about the player/Mara); later slices
   (Film Corridor, Portrait Hall) should reuse `source → relationship →
   result` framing rather than new verbs.

## 7. Next slices (not started)

- Film Corridor — time/reflection/viewpoint alignment.
- Multiple Portrait Hall — contradictory Mara records, break the frame.
