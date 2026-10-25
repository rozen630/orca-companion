import { Button } from '@/components/ui/button'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
export function CompanionExecutionLink({
  workspaceId,
  sessionId,
  label,
  onOpen
}: {
  workspaceId: string
  sessionId: string
  label: string
  onOpen?: () => void
}): React.JSX.Element {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        void activateAiVaultStructuredSession(
          { structuredSession: { workspaceId, sessionId } },
          undefined,
          { kind: 'local' }
        ).then(() => onOpen?.())
      }}
    >
      {label}
    </Button>
  )
}
