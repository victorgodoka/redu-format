/**
 * Centralized error messages for tournament participant actions.
 *
 * Keep user-facing messages here so Server Actions remain focused
 * on validation and business logic.
 */
export const tournamentErrors = {
  common: {
    missingSlug: "Unable to identify the tournament.",
    unexpected:
      "Something went wrong while processing this request. Please try again.",
  },
  session: {
    failed: "Failed to get Admin Session. Now logging out.",
    notFound: "No Admin Session was found.",
    invalid: {
      token: "No valid token was found under this session."
    }
  },
  participant: {
    add: {
      missingRequiredFields:
        "Participant name and deck information are required.",

      playerNotFound: (name: string) =>
        `No registered duelist named "${name}" was found.`,

      alreadyRegistered: (name: string) =>
        `"${name}" is already registered for this tournament.`,

      addFailed:
        "Could not add this participant to the tournament.",
    },

    link: {
      missingRequiredFields:
        "Participant information and duelist name are required.",

      participantNotFound:
        "This participant could not be found.",

      alreadyLinked: (name: string, id: string) =>
        `${name} (${id}) is already linked to an account.`,

      playerNotFound: (name: string) =>
        `No registered duelist named "${name}" was found.`,

      linkFailed:
        "Could not link this participant to the selected account.",
    },

    deck: {
      missingRequiredFields:
        "Participant and deck information are required.",

      tournamentStarted:
        "This tournament has already started, so the deck can no longer be changed.",

      participantNotFound:
        "This participant could not be found or no longer exists.",

      updateFailed:
        "Could not update this participant's deck.",
    },

    payment: {
      missingParticipant:
        "Unable to identify the participant.",

      invalidProofUrl:
        "The payment proof URL is invalid.",

      participantNotFound:
        "This participant could not be found.",

      missingProof:
        "A payment proof is required before confirming this payment.",

      confirmFailed:
        "Could not confirm this participant's payment.",

      invalidPaymentState:
        "This payment cannot be contested because it is not currently confirmed.",

      contestFailed:
        "Could not contest this participant's payment.",
    },

    remove: {
      missingParticipant:
        "Unable to identify the participant.",

      participantNotFound:
        "This participant could not be found.",

      removeFailed:
        "Could not remove this participant from the tournament.",

      dropFailed:
        "Could not drop this participant from the tournament.",
    },

    disqualify: {
      missingParticipant:
        "Unable to identify the participant.",

      missingReason:
        "A reason is required to disqualify a participant.",

      participantNotFound:
        "This participant could not be found.",

      failed:
        "Could not disqualify this participant.",
    },

    reinstate: {
      missingParticipant:
        "Unable to identify the participant.",

      participantNotFound:
        "This participant could not be found.",

      failed:
        "Could not reinstate this participant.",
    },
  },

  deck: {
    missingUuid:
      "Enter a Dueling Nexus deck UUID.",

    connectionFailed:
      "Couldn't reach Dueling Nexus to validate this deck. Please try again.",

    invalidOrPrivate:
      "This deck doesn't exist or is not public on Dueling Nexus.",
  },
  tournament: {
    generic: "An unexpected error occurred. Please try again.",
    notFound: "That tournament no longer exists.",
    failedTo: {
      cancel: "This tournament cannot be cancelled in its current state.",
      delete: "Could not delete this tournament.",
      update: "Could not update this tournament.",
    },
    invalid: {
      startDate: "Pick a valid start date, time, and timezone.",
      bannerType: "Banner must be an image file.",
      bannerSize: "Banner image must be under 2MB.",
      durationMode: "Pick a tournament duration mode.",
      rounds: "Rounds must be a positive whole number.",
      roundLength: "Round length must be a positive whole number of minutes.",
      cleanup: "Cleanup period must be a whole number of minutes.",
      roundDeadline: "Round deadline must be a positive whole number of days.",
      seatCount: "Pick a seat count.",
      entry: "Entry amount must be greater than zero.",      
    },
    missing: {
      name: "Name is required.",
      structure: "Pick a structure.",
      format: "Pick a match format.",
      engine: "Pick an engine.",
      banlist: "Pick a banlist.",
      code: "Enter at least one code.",
      prizeType: "Pick a prize type for every code.",
    },
    prizing: {
      failedTo: {
        add: "Could not add the prize codes.",
        remove: "Could not remove this prize code.",
        send: "Could not send the prize codes.",
      }
    }
  }
} as const

