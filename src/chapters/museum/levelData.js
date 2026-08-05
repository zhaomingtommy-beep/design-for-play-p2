// CHAPTER 5 — THE MUSEUM OF ONE ANSWER
// Slice 1: MINIATURE GALLERY
//
// Core sentence: "Where you place evidence changes the story the museum makes
// physically real."
//
// This file is pure data: layout, tuning, palette, and every player-facing
// English string. The logic model (model/galleryModel.js) and the Phaser
// presentation (MuseumScene.js) both read from here so the slice stays a set
// of replaceable layers instead of a monolith.

export const VIEW = { w: 960, h: 600 };

// Museum palette from GAME_MASTER_V2 §11: "graphite archive, vellum, glass,
// selective living color" — ivory, graphite, oxidized brass, evidence accents.
// The shared signal language is preserved: cyan = relationship holds,
// amber = signal travelling, red = fault / refusal.
export const PAL = {
  ivory: 0xe9e2d0,
  vellum: 0xd8ccab,
  paperShadow: 0xb3a685,
  graphite: 0x2e3138,
  graphiteSoft: 0x565b64,
  brass: 0x9c7f4e,
  glass: 0x8fa8b4,
  ink: 0x1d2026,
  cyan: 0x2fd8c8,
  amber: 0xf2a541,
  red: 0xd64541,
};

export const TUNING = {
  walkSpeed: 0.22, // px per ms
  depthSpeed: 0.15, // px per ms on the shallow depth lane
  rotateSpeed: 0.2, // ticket degrees per ms while turning it in inspect mode
  rebuildMs: 1400, // diorama physical rebuild duration after a placement
  dissolveMs: 900, // diorama collapse duration after a withdrawal
  doorMs: 800, // route door / grate travel duration
  interactRange: 66, // px radius for the E prompt
  // The hidden mark only burns through while the ticket's back is turned into
  // the lamplight (degrees, front = 0).
  markWindowDeg: [130, 230],
};

// The gallery is one fixed-camera 2.5D diorama composition. y is the shallow
// depth lane: the player can step toward/away from the back wall.
export const GALLERY = {
  spawn: { x: 120, y: 470 },
  floorTop: 415,
  floorBottom: 545,
  xMin: 58,
  doorX: 892, // right-wall route door; locked until an interpretation opens it
  pedestal: { x: 215, y: 452 },
  cases: {
    // Two clearly visible display contexts on the back wall.
    A: { id: 'A', x: 505, y: 448, interpretation: 'departure' },
    B: { id: 'B', x: 745, y: 448, interpretation: 'error' },
  },
};

// The reconstruction is a second fixed-camera diorama view: a short walkable
// route that exists only while the DEPARTURE interpretation is active.
export const RECON = {
  enterX: 150, // where Butch steps in from the gallery door
  exitX: 96, // walking back left of this returns to the gallery
  endX: 700, // the witness mark at the end of the route
  xMax: 760,
  floorTop: 430,
  floorBottom: 540,
  spawnY: 480,
};

// Every player-facing string. English only, short and layered: wall plaques
// carry the museum's claims, the caption line carries what actually happened.
export const STRINGS = {
  title: 'THE MUSEUM OF ONE ANSWER',
  slice: 'MINIATURE GALLERY',
  plaque:
    '"Where you place evidence changes the story the museum makes physically real."',
  controls: 'ARROWS / WASD  MOVE   ·   E  INTERACT   ·   R  RESET',
  pedestalLabel: 'RECOVERED TICKET — ORIGIN DISPUTED',
  caseALabel: 'CASE A — THE DEPARTURE',
  caseASub: 'he boarded the train',
  caseBLabel: 'CASE B — THE ERROR LEDGER',
  caseBSub: 'the ticket is a misprint',
  doorPlaqueClosed: 'ENGINE ROUTE — NO SUCH PLATFORM',
  doorPlaqueOpen: 'ENGINE ROUTE — OPEN',
  promptExamine: '[E] EXAMINE THE TICKET',
  promptPlaceA: '[E] PLACE THE TICKET IN CASE A',
  promptPlaceB: '[E] PLACE THE TICKET IN CASE B',
  promptWithdrawA: '[E] TAKE THE TICKET BACK',
  promptWithdrawB: '[E] TAKE THE TICKET BACK',
  promptInspectTurn: '[LEFT/RIGHT] TURN THE TICKET · [E] RUB · [Q] PUT BACK',
  promptInspectTake: 'HIDDEN MARK FOUND · [E] POCKET THE TICKET · [Q] PUT BACK',
  rubBlank: 'Blank vellum. Turn it until the lamp burns through the punches.',
  markFound: 'HIDDEN MARK — punched twice. Two stations, one ticket.',
  placedA: 'The museum rebuilds the platform his way: a door that opens.',
  placedB: 'VERDICT: MISPRINT. The museum walls the platform over.',
  sealedNote: 'The route is sealed as an error. It was never real, says the wall.',
  unsealedNote: 'The seal lifts. The museum forgets its verdict.',
  withdrawn: 'Ticket recovered. Both cases wait again.',
  doorOpenNote: 'A route the museum said never existed is now walkable.',
  reconPlaque: 'THE ROUTE, AS THE TICKET REMEMBERS IT',
  completeLine: 'You walked the route the museum said never existed.',
  completeReset: 'MINIATURE GALLERY — SLICE COMPLETE · [R] WALK IT AGAIN',
};
