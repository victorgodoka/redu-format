import Button from "@/components/ui/Button"
import { Variant } from "@/components/ui/Button/Button"
import { Participant } from "@/lib/tournaments"

interface ParticipantFormProps {
  slug: string
  p: Participant
  buttonText: string
  variant: Variant
  action: (formData: FormData) => void
}

export const ParticipantForm = ({ slug, p, buttonText, action, variant }: ParticipantFormProps) => {
  return <form action={action}>
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="participantId" value={p.id} />
    <Button variant={variant} type="submit">
      {buttonText}
    </Button>
  </form>
}
