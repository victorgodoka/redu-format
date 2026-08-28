export const SuccessMessages = {
  drop: (playerName: string) => `${playerName} was successfully dropped from this event.`,
  dqed: (playerName: string) => `${playerName} was successfully disqualified from this event.`,
  tournament: {
    created: "Tournament created successfully!",
    updated: "Tournament updated successfully!",
    cancelled: "Tournament cancelled.",
    deleted: "Tournament deleted.",
  },
  prizing: {
    added: "Prize codes saved.",
    removed: "Prize code removed.",
    sent: "Prizes sent!",
  },
  participant: {
    added: "Participant added successfully!",
    linked: "Participant linked successfully.",
    deckUpdated: "Participant deck updated.",
    paymentConfirmed: "Payment confirmed.",
    paymentContested: "Payment contested.",
    reinstated: "Participant reinstated.",
  },
  bracket: {
    started: "Bracket started successfully!",
    resultEntered: "Result saved!",
    noShowDismissed: "No-show report dismissed.",
    roundAdvanced: "Advanced to the next round.",
    roundExtended: "Round deadline extended.",
    roundRepaired: "Round repaired successfully.",
    playersSwapped: "Players swapped successfully.",
    completed: "Bracket completed and standings are final.",
  },
  nexus: {
    linked: "Dueling Nexus account linked successfully.",
    unlinked: "Dueling Nexus account unlinked.",
  },
  message: {
    sent: (reach: string) => `Sent to ${reach}.`
  }
};
