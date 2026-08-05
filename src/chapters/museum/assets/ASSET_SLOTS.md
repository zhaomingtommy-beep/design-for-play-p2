# MINIATURE GALLERY — runtime asset slot manifest

Chapter 5, slice 1. Contract per `docs/SHARED_ASSET_AND_VOICE_HANDOFF.md` §4.
Every visual layer enters the scene only through a slot defined in
`src/chapters/museum/assets/slots.js`. All current fills are original
graphite / vellum / paper blockout painted in code at boot; none are
downloaded imagery. Replacement rule: swap the slot's painter for the finished
export loader — scene code does not change.

| Slot id | Role | Source | Export (current) | Origin / depth | Status |
|---|---|---|---|---|---|
| `butch` | character | original blockout | generated texture 26×46, alpha | bottom-center, above floor | placeholder |
| `ticket` | interaction | original blockout | generated 22×12, alpha | center | placeholder |
| `ticket-big` | interaction | original blockout | generated 220×120, alpha | center (inspect overlay) | placeholder |
| `ticket-mark` | interaction | original blockout | generated 220×120, alpha | center, above `ticket-big` | placeholder |
| `pedestal` | interaction | original blockout | generated 56×74, alpha | bottom-center | placeholder |
| `mini-slab` | landmark | original blockout | generated 96×14, alpha | center, inside glass case | placeholder |
| `mini-pillar` | landmark | original blockout | generated 10×44, alpha | bottom-center, inside case | placeholder |
| `mini-bridge` | landmark | original blockout | generated 64×8, alpha | center, inside case | placeholder |
| `mini-wall` | landmark | original blockout | generated 70×52, alpha | bottom-center, inside case | placeholder |
| `mini-door` | landmark | original blockout | generated 26×40, alpha | bottom-center, inside case | placeholder |
| `mini-rubble` | landmark | original blockout | generated 90×26, alpha | bottom-center, inside case | placeholder |
| `grate` | interaction | original blockout | generated 64×118, alpha | bottom-center, route door | placeholder |
| `seal-plate` | interaction | original blockout | generated 70×26, alpha | center, over route door | placeholder |
| `witness-post` | landmark | original blockout | generated 30×64, alpha | bottom-center, reconstruction | placeholder |
| `mini-train` | landmark | original blockout | generated 120×34, alpha | bottom-center, reconstruction | placeholder |
| wall/floor/glass layers | background | original blockout | vector pass in `MuseumScene` (paper panels, glass tint, signal threads) | n/a | placeholder |

Signal language (locked, all slots must keep it): cyan = relationship holds,
amber = signal travelling, red = fault / refusal.

Future shared needs (handoff, not implemented here): paper-grain overlay from
the shared `Paper001` shelf after Jason's treatment pass; Seedance chapter
film for the gallery opening; Archivist verdict stinger (English voice per
voice card) on `route-sealed`.
