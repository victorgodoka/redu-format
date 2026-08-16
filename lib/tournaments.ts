export {
  addParticipant,
  cancelTournament,
  createTournament,
  deleteTournament,
  getTournament,
  listParticipants,
  listTournaments,
  removeParticipant,
  setParticipantDeck,
  setParticipantPayment,
  slugify,
  updateTournament,
} from "./backend/services/tournament.service.ts";

export type {
  Participant,
  PaymentStatus,
  Structure,
  TournamentDraft,
  TournamentEvent,
  TournamentStatus,
} from "./backend/services/tournament.service.ts";
