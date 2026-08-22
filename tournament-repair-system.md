# Tournament Repair System — Swiss & Double Elimination

*A language-, framework-, and persistence-agnostic domain specification.*

## 0. Scope and reading order

This document specifies a **repair mechanism** for live tournaments, built as a special case of a more general capability: **deterministic reconstruction of tournament state from authoritative facts.** Repair is not a bag of match-patching scripts — it is "rebuild, but starting one step further back than usual."

Everything here is domain-level pseudocode. No language, database, ORM, or transport is assumed. Section 3 onward builds strictly on the vocabulary defined in Sections 1–2; read them first.

---

## 1. Domain Model

### 1.1 Entities

```
Tournament
    id
    format                 // "SWISS" | "DOUBLE_ELIMINATION" | ...
    config                 // format-specific rules (round count, tiebreak order,
                            //   bracket size policy, best-of, grand-final-reset policy...)
    status                 // SETUP | IN_PROGRESS | COMPLETED | CANCELLED
    currentRevision         -> BracketRevision.id

Participant
    id
    tournamentId
    seed                    // authoritative, assigned at registration close
    registrationData        // deck list, roster, etc. — opaque to the engine
    adminStatus              // ACTIVE | WITHDRAWN | DISQUALIFIED
                             // (authoritative; engine never invents this)

Match
    id
    tournamentId
    format-specific locator // Swiss: (round number); DE: (bracket, stage, index)
    slotA, slotB             // ParticipantRef | Pending(sourceMatchId, WINNER|LOSER) | BYE
    result                   // null | { winnerSlot | DRAW, score?, recordedAt, recordedBy }
    state                    // PENDING | READY | ONGOING | COMPLETED | VOID
    // DE only:
    winnerDestination        // { matchId, slot } | CHAMPION | null
    loserDestination         // { matchId, slot } | ELIMINATED | null
    activationPredicate      // see §6.4 — when this node becomes playable

Round                        // Swiss only; a repair boundary, not a DE concept
    id
    tournamentId
    number
    status                   // PENDING | ONGOING | COMPLETED | INVALIDATED

Repair                       // audit entity, see §11
BracketRevision              // versioning entity, see §10
TournamentLock                // concurrency entity, see §12
```

### 1.2 Events (the authoritative log)

Authoritative facts are **not** stored as mutable rows. They are stored as an append-only sequence of domain events. This one decision is what makes everything downstream — determinism, repair, rollback, audit — fall out for free rather than needing bespoke machinery.

```
TournamentCreated(config)
ParticipantRegistered(participantId, seed, registrationData)
ParticipantWithdrawn(participantId, atEventSeq)
ParticipantDisqualified(participantId, atEventSeq, reason)
RoundOpened(roundNumber)                          // Swiss
MatchResultRecorded(matchId, winnerSlot|DRAW, score?, recordedBy)
ManualPairingOverride(roundNumber|bracketNode, forcedSlots, reason, recordedBy)
ResultCorrected(originalEventSeq, matchId, correctedResult, reason, initiatedBy, correctionId)
```

`ResultCorrected` is the only event a repair ever appends. **Repair never deletes or rewrites history** — it appends a correction event and asks the engine to recompute everything from the point that correction first has an effect.

---

## 2. State Model

Four categories, deliberately kept separate:

| Category | Examples | Rule |
|---|---|---|
| **Authoritative** | config, participants, seeds, the event log itself, admin overrides | Only source of truth. Repaired by *appending*, never edited in place. |
| **Derived (projection)** | standings, player bracket/losses/status, pairings, next opponent, bracket occupancy, rankings, progress, stats | Pure function of the authoritative log. Never independently mutated. Safe to delete and recompute at any time. |
| **Runtime/transient** | locks, in-flight repair staging state, pairing suggestions not yet committed | Never persisted as tournament history; invisible to consumers once released. |
| **Audit** | `Repair` records, `BracketRevision` records | Immutable once written. Describes *how* the authoritative log changed over time, not what the tournament currently looks like. |

**Governing rule:** there is exactly one mutable authoritative structure per tournament — its event log. Every other structure (`Match.state`, `Participant`'s current bracket, standings tables, etc.) is a **projection**: `TournamentState = fold(TournamentEngine.apply, initialState, eventLog)`. If a projection is persisted for query performance, it is documented as a cache and must be byte-for-byte reproducible by replaying the log — that is the whole test suite for "is this actually derived or did it quietly become a second source of truth."

---

## 3. Tournament Engine Abstraction

```
interface TournamentEngine:
    initialState(config, participants) -> TournamentState
    apply(state: TournamentState, event: Event) -> TournamentState        // pure, total
    generateNext(state: TournamentState) -> GeneratedStep                  // next round's pairings,
                                                                            //  or newly-activated bracket matches
    isComplete(state: TournamentState) -> bool
    validate(state: TournamentState) -> ValidationResult

interface RepairableEngine extends TournamentEngine:
    locateBoundary(state, target: MatchRef | RoundRef) -> RepairBoundary
    affectedScope(state, boundary: RepairBoundary) -> Set<NodeId>          // transitive closure
    restorePoint(state, boundary: RepairBoundary) -> EventSeq              // last authoritative
                                                                            //  event unaffected by boundary
```

`apply` is the *only* place format rules live. It must be a pure function: `(state, event) -> state`, no clock reads, no randomness, no I/O. This single constraint is what makes determinism (§4), rebuild (§20.1), and idempotent replay all the same mechanism.

```
TournamentEngine
├── SwissEngine            (RepairBoundary = Round)
└── DoubleEliminationEngine (RepairBoundary = downstream subgraph of a Match)
```

The **repair coordinator** (§7) calls only `RepairableEngine` methods. It contains no `if format == SWISS` branching — each engine answers "what's the boundary," "what's affected," and "where do I restore from" in its own vocabulary, and the coordinator drives the same five steps regardless.

---

## 4. Determinism

Given identical `(config, participants, seeds, eventLog)`, `fold(apply, initialState, eventLog)` must produce byte-identical `TournamentState`, on any machine, at any time.

Concretely, every rule that could vary must be **pinned as configuration, not code**:

- **Seed ordering**: seeds are authoritative input (assigned once at registration close via `ParticipantRegistered`), never recomputed.
- **Swiss pairing**: pinned algorithm (e.g. Dutch/Buchholz pairing), with a fully specified, total tie-break order (e.g. `[matchPoints, buchholz, buchholzCut1, headToHead, seed]`) — the *last* tiebreak in the chain must be something total and immutable (seed, or participant id) so pairing never has a coin-flip case.
- **Bye assignment**: deterministic rule (e.g. lowest-ranked participant who has not yet had a bye this tournament; ties broken by seed).
- **Bracket seeding**: standard deterministic seed-slotting table for the bracket size (power-of-two padding with byes placed at canonical positions).
- **Grand Final / reset**: modeled as data (§6.4), not branching code.
- Any place the *current* implementation uses a random number (e.g., breaking a residual tie, shuffling initial pods) must either be eliminated by extending the tiebreak chain, or the random draw itself must be captured as an authoritative event (`RandomSeedCommitted(seed)`) so replay reuses the same draw rather than a new one.

**Test for determinism**: `fold(apply, initial, eventLog) == fold(apply, initial, eventLog)` run twice, independently, must be an equality check that always passes. This is a required property test (§18), not a nice-to-have.

---

## 5. Swiss Engine Behavior

### 5.1 Repair boundary = Round

Rounds are naturally sequential and each round's pairing input is "standings after the previous round." That makes **Round** the correct repair granularity: nothing about round *N*'s pairing depends on anything inside round *N* itself, only on everything before it.

```
SwissEngine.locateBoundary(state, target: RoundRef) -> RepairBoundary:
    return { kind: "ROUND", roundNumber: target.number }

SwissEngine.restorePoint(state, boundary) -> EventSeq:
    // last event belonging to (roundNumber - 1) or earlier
    return lastEventSeqBefore(state.eventLog, roundStart(boundary.roundNumber))

SwissEngine.affectedScope(state, boundary) -> Set<NodeId>:
    // every round >= boundary.roundNumber that currently exists
    return { r.id for r in state.rounds if r.number >= boundary.roundNumber }
```

### 5.2 Repairing round *N* (§ prompt 5)

1. Lock the tournament (§12).
2. `boundary = locateBoundary(state, RoundRef(N))`.
3. `affected = affectedScope(state, boundary)` → rounds `N..last`.
4. `restore = restorePoint(state, boundary)` — the event-log position at the end of round `N-1`. **This, not the current (possibly corrupted) standings, is the input to recomputation** — the spec's core requirement in §5 of the prompt.
5. Append `ResultCorrected` event(s) describing the fix, positioned logically at round `N`.
6. `newState = fold(apply, snapshotAt(restore), eventsAfter(restore))` — replays round `N` (now corrected) and, per policy below, rounds `N+1..last`.
7. `validate(newState)` (§13).
8. Commit as a new `BracketRevision` (§10) atomically (§14).

### 5.3 Downstream rounds — explicit policy

Per prompt §6, silently rewriting completed competitive history is disallowed. Policy, in order of precedence:

- **Rounds that were PENDING or ONGOING** (not yet completed) at repair time: automatically invalidated and regenerated from the corrected state. No confirmation needed — nothing competitive was finalized.
- **Rounds already COMPLETED**: the engine *computes* what they would look like under the corrected history (this is cheap — it's the same fold) and diffs it against what actually happened. If the diff is empty (the correction didn't actually change any pairing/result downstream — e.g., it only fixed a score, not a match outcome), the repair auto-commits through those rounds with no behavior change to report. If the diff is non-empty, the repair **requires explicit administrator confirmation** (`previewRepair` in §14 surfaces exactly what would change) before those completed rounds are overwritten. This is a policy flag on the tournament config (`allowRetroactiveRoundRewrite: CONFIRM | FORBID`), not hardcoded — `FORBID` makes any repair whose diff reaches a completed round fail outright with a "repair exceeds boundary" error, forcing a narrower repair or an administrative decision to void results manually.
- Full historical replay (rebuilding the entire tournament from event 0) is always available as `rebuildTournament` (§20.1) and is what §8's rollback ultimately relies on — it is not a separate code path from repair, just repair with `restore = genesis`.

---

## 6. Double Elimination Engine Behavior

### 6.1 The bracket is a graph, not a round list

```
BracketGraph
    nodes: Match[]
    // edges are embedded in each node as winnerDestination / loserDestination
```

Generation is a pure function of participant count and configuration:

```
DoubleEliminationEngine.generateGraph(participantCount, config) -> BracketGraph:
    size = nextPowerOfTwo(participantCount)
    byes = size - participantCount
    winnersR1 = seedSseededSlots(size, byes)              // canonical seeding table
    wNodes = buildWinnersBracket(winnersR1)                 // standard single-elim shape
    lNodes = buildLosersBracket(wNodes, config.losersBracketShape)
                                                              // standard DE "drop" pattern:
                                                              // each winners-round's losers feed
                                                              // a deterministic losers-round slot
    gf1  = Match(id: "GF1",
                 slotA: Pending(wNodes.final, WINNER),
                 slotB: Pending(lNodes.final, WINNER),
                 activationPredicate: bothSlotsFilled)
    gf2  = Match(id: "GF2",
                 slotA: Pending("GF1", WINNER),             // whoever wins GF1 keeps position
                 slotB: Pending("GF1", LOSER),
                 activationPredicate: loserOfGF1IsLosersChampion)  // see §6.4
    wire winnerDestination / loserDestination pointers for every node
    return BracketGraph(nodes: wNodes + lNodes + [gf1, gf2])
```

No node's construction branches on "is this round 3" or "is this the losers final" — every node is built from the same `{sourceA, sourceB, winnerDestination, loserDestination, activationPredicate}` shape. Grand Final and reset are ordinary nodes with a conditional `activationPredicate`, not special-cased control flow.

### 6.2 Advancement

```
DoubleEliminationEngine.apply(state, MatchResultRecorded(matchId, winnerSlot, ...)):
    match = state.nodes[matchId]
    match.result = {winnerSlot, ...}
    match.state = COMPLETED
    winner = resolveSlot(match, winnerSlot)
    loser  = resolveSlot(match, otherSlot(winnerSlot))
    propagate(state, match.winnerDestination, winner)
    propagate(state, match.loserDestination, loser)         // ELIMINATED sink if loserDestination is terminal
    for node in state.nodes:
        if node.state == PENDING and node.activationPredicate(state):
            node.state = READY
    return state

propagate(state, destination, participant):
    if destination == CHAMPION: state.champion = participant; return
    if destination == ELIMINATED: markEliminated(state, participant); return
    node = state.nodes[destination.matchId]
    node.slots[destination.slot] = participant
```

### 6.3 Player state is derived (§10 of prompt)

```
derivePlayerState(state, participantId) -> PlayerState:
    results = allCompletedMatchesInvolving(state, participantId)
    losses  = count(results, r -> r.loserId == participantId)
    if participantId == state.champion:            status = CHAMPION
    elif losses >= 2 and not stillInGF2Path(state, participantId): status = ELIMINATED
    else:                                           status = ACTIVE
    bracket = LOSERS if losses == 1 and status == ACTIVE else WINNERS if losses == 0 else N/A
    return { losses, status, bracket, currentMatch: findOpenMatch(state, participantId) }
```

`losses`, `bracket`, and `status` are **never stored**; they're computed on read from the match/result graph. This directly satisfies §3 and §10 of the prompt: there is no `player.losses` field to fall out of sync with `match.result`.

### 6.4 Grand Final and Reset — explicit transition table

| Scenario | GF1 result | GF2 (`activationPredicate`) | Outcome |
|---|---|---|---|
| Winners Champion wins GF1 | WC beats LC | predicate false (LC did not win) → GF2 stays `VOID`, never activates | Champion = WC. Tournament complete after GF1. |
| Losers Champion wins GF1 (reset) | LC beats WC | predicate true → GF2 activates with `{slotA: WC (now 1 loss), slotB: LC}` | GF2 is played. |
| — WC wins GF2 | | | Champion = WC (WC's only loss is the GF1 loss; LC has 2 losses total). |
| — LC wins GF2 | | | Champion = LC (2-0 across the reset). |

`activationPredicate(loserOfGF1IsLosersChampion)` = `GF1.state == COMPLETED and GF1.result.loserSlot == slotB`. This is the entire "reset" rule — a boolean over one completed match's recorded result, evaluated the same way every other node's activation is evaluated. There is no `if triggeredReset` anywhere else in the system.

---

## 7. Dependency Graph Model (repair-facing view)

Every DE match already carries `winnerDestination` / `loserDestination` as forward edges. Repair only needs one graph query:

```
downstreamClosure(graph, matchId) -> Set<NodeId>:
    visited = {}
    queue = [matchId]
    while queue not empty:
        m = queue.pop()
        if m in visited: continue
        visited.add(m)
        node = graph.nodes[m]
        if node.winnerDestination is MatchRef: queue.push(node.winnerDestination.matchId)
        if node.loserDestination  is MatchRef: queue.push(node.loserDestination.matchId)
    return visited
```

This is a plain reachability traversal over a DAG (the bracket graph is acyclic by construction — winners/losers destinations always point to a later stage, never backward; §13 validates this remains true after every repair). Branches that don't transitively depend on the repaired match are untouched by construction — there's no "invalidate the whole round" step to accidentally include them.

```
DoubleEliminationEngine.locateBoundary(state, target: MatchRef) -> RepairBoundary:
    return { kind: "MATCH", matchId: target.id }

DoubleEliminationEngine.affectedScope(state, boundary) -> Set<NodeId>:
    return downstreamClosure(state.graph, boundary.matchId)   // includes the match itself

DoubleEliminationEngine.restorePoint(state, boundary) -> EventSeq:
    // last event not touching any node in affectedScope
    return lastEventSeqNotIn(state.eventLog, affectedScope(state, boundary))
```

---

## 8. Repair Algorithm (format-independent coordinator)

```
function repairMatch(tournamentId, targetMatchId, correction, reason, actor, confirm=false, correctionId):
    acquireLock(tournamentId)                                        // §12
    try:
        state  = loadCurrentState(tournamentId)
        engine = engineFor(state.format)                             // Swiss | DoubleElimination

        if isDuplicate(state, correctionId):                          // §16 idempotency
            return AlreadyApplied(state.currentRevision)

        boundary = engine.locateBoundary(state, targetMatchId)
        affected = engine.affectedScope(state, boundary)
        impact   = buildImpactReport(state, affected, correction)     // §14/§13-of-prompt

        if impact.touchesCompletedOrOngoing and not confirm:
            return RequiresConfirmation(impact)

        restoreSeq = engine.restorePoint(state, boundary)
        candidateLog = appendCorrection(state.eventLog, targetMatchId, correction, reason, actor, correctionId)

        newState = rebuildFrom(engine, snapshotAt(restoreSeq), candidateLog.eventsAfter(restoreSeq))

        violations = engine.validate(newState)
        if violations.nonEmpty:
            return Failure(violations)                                 // nothing committed — see §9

        revision = commitRevision(tournamentId, newState, candidateLog, impact, actor, reason, correctionId)
        return Success(revision)
    finally:
        releaseLock(tournamentId)
```

Note what's absent: no per-format branch, no manual "update these 6 downstream records" list. `affectedScope` and `restorePoint` already encode the format's rules; the coordinator just drives restore → correct → rebuild → validate → commit.

`repairRound(tournamentId, roundNumber, ...)` is a thin wrapper that resolves `roundNumber` to the relevant `targetMatchId`(s) and calls the same coordinator — Swiss repair is not a structurally different operation, just a different boundary shape.

---

## 9. Rollback / Reconstruction Strategy

Because `rebuildFrom` runs against a **staged, uncommitted** copy of state (never mutating the persisted current revision in place), rollback on failure is trivial: **discard the staged copy**. The previously committed revision was never touched, so "rollback" is the absence of a commit, not a compensating action.

```
before repair:  currentRevision = R   (valid, visible to all consumers)
during repair:  work happens on an in-memory/staging fold of events — R is still what's visible
if success:     currentRevision = R+1 (atomic swap, §12)
if failure:      currentRevision = R   (unchanged; staged state is simply dropped)
```

This gives the exact guarantee demanded by prompt §14: intermediate state is never exposed, and failure leaves the tournament in its previous valid state — for free, as a consequence of event sourcing plus staged rebuild, not as separately-implemented rollback logic.

**Full rebuild** (prompt §20) is the same function with the widest possible boundary:

```
rebuildTournament(tournamentId) -> TournamentState:
    log = readFullEventLog(tournamentId)
    engine = engineFor(tournamentConfig(tournamentId).format)
    return fold(engine.apply, engine.initialState(config, participants), log)
```

If this ever produces a different result than the currently-persisted projection, the projection was corrupted (not the log) — the log is always authoritative, and `rebuildTournament` is the disaster-recovery / integrity-check operation.

---

## 10. State Persistence Strategy

Persistence-agnostic contract — implementable on a relational table, an append-only log store, a document store, or flat files:

```
EventStore:
    appendEvents(tournamentId, expectedTailSeq, events[]) -> ok | ConflictError   // CAS on the tail
    readEvents(tournamentId, fromSeq, toSeq?) -> Event[]

SnapshotStore:
    writeSnapshot(tournamentId, revisionId, eventSeq, state)
    readSnapshot(tournamentId, revisionId) -> (eventSeq, state)
    latestSnapshotBefore(tournamentId, eventSeq) -> (eventSeq, state)

RevisionPointer:
    casCurrentRevision(tournamentId, expectedRevisionId, newRevisionId) -> ok | ConflictError
```

Snapshots are a **performance cache only** — `latestSnapshotBefore` + replay of the remaining tail must always equal a full replay from genesis. A snapshot is taken opportunistically (e.g., every completed round, every completed bracket stage, or every N events) purely to bound replay cost; none is ever required for correctness.

---

## 11. Bracket Versioning

```
BracketRevision
    id                    // monotonically increasing per tournament
    tournamentId
    eventSeq              // log position this revision reflects
    causedBy              // { type: NORMAL_PROGRESSION } | { type: REPAIR, repairId }
    createdAt
    snapshotRef?           // optional cached projection
```

Every commit — whether ordinary match-result recording or a repair — produces a new revision. Repairs are distinguishable from ordinary progression purely via `causedBy`, which is what §15's audit trail hangs off of.

---

## 12. Audit Model

```
Repair
    id
    tournamentId
    tournamentFormat
    target                  // { matchId } | { roundNumber }
    previousState            // { result, affectedSnapshot summary }
    correctedState
    affectedEntities         // { matches: [...], players: [...], roundsOrBracketBranches: [...] }
    reason
    initiatedBy
    createdAt
    resultingRevision         -> BracketRevision.id
    correctionId              // idempotency key, unique
```

`Repair` records are written once, at commit time, alongside the `BracketRevision` they produced, in the same atomic operation (§14). They are never edited. A tournament's full audit trail is `allRepairs(tournamentId)` ordered by `createdAt` — this is domain data, not an application log line, precisely because "why does the bracket look like this" must survive log rotation and be queryable by tournament ID.

---

## 13. Concurrency Strategy

Two mechanisms, layered:

1. **Pessimistic tournament lock** for the duration of a single repair (or normal-progression write) transaction. Since `apply`/`fold` is pure CPU work with no external calls, this critical section is short. Lock acquisition itself can be implemented as a row lock, a distributed lease, or an in-memory mutex — the contract is just `acquireLock(tournamentId) -> release()` with a timeout that fails fast rather than blocking indefinitely.
2. **Optimistic CAS on the event-log tail and on the revision pointer** (`appendEvents(expectedTailSeq, ...)`, `casCurrentRevision(expected, new)`). This catches the case where, despite the lock, some other process advanced the tournament between `loadCurrentState` and `commitRevision` (e.g., the lock implementation is best-effort, or a legitimately concurrent read-modify-write slipped through). On CAS failure, the repair coordinator retries: reload state, recompute `affectedScope` (it may have changed — new matches may now exist downstream), and reattempt once, up to a small retry bound, before failing with `ConcurrentModification`.

```
Before repair:  valid state, revision R
During repair:  no reader ever observes R+1 until casCurrentRevision succeeds
After repair:   valid state, revision R+1  (or unchanged, on failure)
```

Duplicate/simultaneous repair requests for the same `correctionId` are resolved by §16 idempotency, not by locking alone.

---

## 14. Validation / Invariants

`engine.validate(state) -> Violation[]` runs unconditionally after every rebuild, before commit. It is also exposed standalone as a health check (`validateTournament(tournamentId)`).

**Common (all formats):**
- no match pairs a participant against themselves
- every completed match has two valid, distinct participant references (or one + BYE)
- round/stage numbering is contiguous and consistent with the graph/sequence
- no participant has a result recorded against a match they are not slotted into

**Swiss-specific:**
- no duplicate pairing (same two participants paired twice, unless config explicitly allows rematches)
- bye rule satisfied (a participant receives at most one bye; bye-eligibility rule was honored)
- standings are exactly `fold` of recorded results (recomputed and diffed, not trusted)

**Double-Elimination-specific:**
- every active participant occupies exactly one open bracket slot
- no participant appears in two simultaneously-open matches
- no participant with ≥1 recorded loss occupies a Winners-bracket slot
- no participant with 2 losses (outside the GF2 exception, §6.4) occupies any open match
- eliminated participants receive no new match assignments
- every node's `winnerDestination`/`loserDestination` resolves to an existing node or a valid terminal (`CHAMPION`/`ELIMINATED`)
- the graph is acyclic (§7's traversal terminates and never revisits under construction, but this is re-checked structurally after repair as a hard invariant, not just assumed)
- Grand Final participants are exactly `{WinnersFinal winner, LosersFinal winner}`
- GF2 exists as `READY`/`COMPLETED` **iff** `activationPredicate` holds — never created or removed by any path other than that predicate
- exactly one `CHAMPION` once `isComplete(state)` is true
- for a localized repair: every node **outside** `affectedScope` is byte-identical to its pre-repair value (this is the automated check that unrelated branches truly remained untouched)

If `validate` returns any violation, the repair is rejected outright — nothing partial is ever committed (§9).

---

## 15. Repair Preview

```
function previewRepair(tournamentId, targetMatchId, correction) -> ImpactReport:
    state  = loadCurrentState(tournamentId)          // read-only, no lock required
    engine = engineFor(state.format)
    boundary = engine.locateBoundary(state, targetMatchId)
    affected = engine.affectedScope(state, boundary)
    restoreSeq = engine.restorePoint(state, boundary)
    staged = rebuildFrom(engine, snapshotAt(restoreSeq),
                          appendCorrection(state.eventLog, targetMatchId, correction, ...).eventsAfter(restoreSeq))
    return diffImpact(state, staged, affected)        // never persisted, never committed
```

`ImpactReport` shape (matches prompt §18):

```
ImpactReport
    target
    previousResult / correctedResult
    affectedMatches[]
    affectedPlayers[]
    completedMatchesAffected[]     // subset requiring confirmation, per §5.3 policy
    ongoingMatchesAffected[]
    bracketRevision: { from, to }
```

`previewRepair` and `repairMatch` share the *same* `locateBoundary` → `affectedScope` → `restorePoint` → rebuild pipeline; preview simply stops before `commitRevision`. This guarantees preview accuracy can never drift from what an actual repair would do — they are not two implementations of "figure out what's affected."

---

## 16. Idempotency Strategy

Every repair request carries a client-supplied `correctionId`. Before doing any work:

```
isDuplicate(state, correctionId):
    return exists(e in state.eventLog where e.type == ResultCorrected and e.correctionId == correctionId)
```

If found, the coordinator returns the revision that request already produced, without appending anything or re-running validation. This covers both "the same admin re-submits the same fix" and "a retried network request after a timed-out-but-actually-succeeded call." Separately, if a correction is submitted whose *effect* is already the current state (e.g., correcting M42 to winner=B when M42's last correction already set winner=B, just under a different `correctionId`), `appendCorrection` is a no-op that returns the current revision unchanged rather than appending a redundant event — this satisfies "repair to an already-true state produces no additional mutation" even without a matching `correctionId`.

---

## 17. Error Handling

| Failure point | Behavior |
|---|---|
| Lock not acquired (timeout) | Fail fast with `LockTimeout`; caller may retry. No partial state touched. |
| Unknown target match/round | `NotFound`, no lock taken. |
| Structurally invalid correction (e.g., winner not a slot participant) | `InvalidCorrection`, rejected before touching the log. |
| Impact includes completed/ongoing matches, `confirm` not set | `RequiresConfirmation(impact)` — caller re-invokes with `confirm=true` after reviewing the preview. |
| CAS conflict on append/commit | Bounded retry (recompute boundary/scope against new state); exhausted → `ConcurrentModification`. |
| Post-rebuild `validate` fails | `Failure(violations)`; nothing committed (§9). This is the primary safety valve — it converts "the repair logic had a bug" into a rejected operation instead of a corrupted tournament. |
| Rebuild itself throws (unexpected exception in `apply`) | Treated as `EngineFault`, distinct from a validation failure — indicates a bug in the engine or a genuinely corrupt event log (not something a repair author caused), surfaced for manual/engineering investigation rather than silently retried. |
| Failure at any point after lock acquisition | Lock is released in a `finally`; no commit has occurred; current revision remains valid (§9). |

---

## 18. Testing Strategy

Behavioral, not implementation-based:

- **Determinism**: `fold(apply, initial, log)` run twice yields identical state (property test, random event-log generation within format-valid constraints).
- **Replay equivalence**: incrementally-built state after each event == `rebuildTournament` from genesis at that same point, for every prefix of the log.
- **Swiss — current-round repair**: generate tournament → play rounds → corrupt/repair the ongoing round → verify pairing reconstruction matches what fresh generation from the restore point would produce.
- **Swiss — historical repair**: play several rounds → repair an earlier round → verify every downstream round is either auto-rebuilt (if not yet completed) or flagged for confirmation (if completed), per §5.3.
- **DE — direct descendants**: generate bracket → play one match → repair it → verify exactly its `downstreamClosure` changed and validate() passes.
- **DE — branch isolation**: play several matches across two independent branches → repair a historical Winners match on branch A → assert branch B's matches are byte-identical before/after (the §14 "unrelated branches unchanged" invariant, asserted directly, not just implied).
- **Grand Final / Reset**: drive to a reset scenario → repair the pre-reset match → verify GF2's `activationPredicate` re-evaluates correctly and the champion recomputes.
- **Idempotency**: apply the same `correctionId` twice → second call produces no new event, same revision returned.
- **Concurrency**: two repairs targeting overlapping scope submitted concurrently → exactly one commits, the other retries-then-succeeds-against-new-scope or cleanly fails with `ConcurrentModification` — never a torn commit.
- **Edge cases** (§19): each item gets a minimal reproducing test — 1 participant, 2 participants, odd counts with byes, disqualification mid-tournament, no-show, score-only correction (same winner) vs. winner-changing correction, repair after downstream completion, repair while a downstream match is ongoing, repair of the very first match, repair of Grand Final and of the Reset itself, repair of an already-completed tournament (allowed to run, but champion may change — validate() must still hold), consecutive repairs (repair-of-a-repair), and a repair that fails validation partway (asserting nothing committed).

---

## 19. Example Flows

**Swiss, 8 players, repair round 2 after round 3 has started:**
Round 1 (complete) → Round 2 (complete) → Round 3 (ongoing). Admin reports Round 2, Table 3 had the wrong winner recorded. `repairMatch(target=R2T3, correction=winner:B)`: boundary = Round 2; `affectedScope` = {Round 2, Round 3} (Round 3 pairings depended on Round 2 standings); `restorePoint` = end of Round 1. Round 3 is `ONGOING`, not completed, so no confirmation is required — it's auto-invalidated and its (still in-progress) results are discarded, since they were paired against corrupted input. Rebuild replays: apply Round 1 events (unchanged) → apply corrected Round 2 result → regenerate Round 3 pairings from the now-correct Round 2 standings → Round 3 re-enters `PENDING`/regenerated `ONGOING` with fresh pairings. Revision R → R+1.

**Double Elimination, 8 players, repair a Winners Round 1 match after its Losers-side consequences have played out:**
M1 (WR1) recorded A beats B; B dropped to Losers, played and lost M6 (LR1), was eliminated. Later, M1 is found incorrect: actually B beat A. `repairMatch(target=M1, correction=winner:B)`: `downstreamClosure(M1)` = {M1, M5 (WR2, received A), M6 (LR1, received B), and everything downstream of M5/M6}. A parallel branch M2→M5 contributes the *other* slot of M5, so M2 itself is untouched, but M5 is in scope because one of its two inputs changed. `restorePoint` = last event before M1. Rebuild: replay up to M1 → apply corrected result (B wins) → B now propagates to M5's winner-slot instead of A, and A propagates to M6 (Losers) instead of B. M6 already had a recorded result (B beat someone) — that match is in `affectedScope` and is `COMPLETED`, so this repair **requires confirmation** (§5.3-equivalent policy for DE: any completed match inside `affectedScope` triggers the same confirm gate). On confirmation, M6 is rebuilt with A now occupying B's old slot, and its downstream is recomputed. Everything not reachable from M1 (e.g., the entire M3→M4 sub-bracket) is byte-identical before and after — asserted directly by validation (§14's last bullet).

---

## 20. Core Algorithm Reference

Consolidating the primary generic routines referenced above, for implementers who want them in one place:

### 20.1 Rebuild (the basis for repair, rollback, and full reconstruction)

```
function rebuildFrom(engine, snapshot: (eventSeq, state), events: Event[]) -> TournamentState:
    state = snapshot.state
    for event in events:
        state = engine.apply(state, event)
    return state

function rebuildTournament(tournamentId) -> TournamentState:
    engine = engineFor(tournamentConfig(tournamentId).format)
    return rebuildFrom(engine, (0, engine.initialState(config, participants)), readEvents(tournamentId, 0))
```

### 20.2 Transitive affected-scope (both engines conform to the same signature; §5.1 / §7 show the two implementations)

```
engine.affectedScope(state, boundary) -> Set<NodeId>
```

### 20.3 Repair coordinator

See §8 in full — restated here as the five-step shape referenced throughout:

```
locate boundary → compute affected scope + impact → (confirm if needed)
→ restore to last-unaffected point → replay corrected events → validate → commit-or-reject
```

### 20.4 Validation entry point

```
function validateTournament(tournamentId) -> ValidationResult:
    state = loadCurrentState(tournamentId)
    engine = engineFor(state.format)
    return engine.validate(state)
```

---

## Summary of the architectural constraint this satisfies

Nowhere above does the repair coordinator branch on tournament format, on which round is being repaired, or on whether a match "was already completed." Those distinctions are pushed down into:

- `RepairBoundary` (what "the unit of repair" means, per format),
- `affectedScope` (what a graph/round-sequence traversal returns, per format),
- `activationPredicate` (what makes a node such as Grand Final Reset exist at all), and
- a single confirmation policy keyed off "does the affected scope include completed/ongoing work" — evaluated the same way regardless of format.

Repair is therefore not a second rulebook bolted onto the tournament engine — it is the same `apply`/`fold` machinery used for ordinary progression, invoked with an amended log and a strategically-chosen starting point.
