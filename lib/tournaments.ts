export {
  addParticipant,
  createTournament,
  deleteTournament,
  getTournament,
  listParticipants,
  listTournaments,
  removeParticipant,
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
} from "./backend/services/tournament.service.ts";
