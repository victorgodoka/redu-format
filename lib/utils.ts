import { CARD_LIB } from "./cardLib"

export const normalizeID = (id: number, original?: boolean) => {
  const cardNoRarity = id % 100000000000
  const card = CARD_LIB.find(c => [c.id, c.errataId].includes(cardNoRarity))
  return (original && card) ? card.id : cardNoRarity
}
