export function canOpenProfessionalCollaborationView({
  view,
  subscriptionActive = false,
  professionalRole = 'trainer',
  pendingInvite = false,
  activeTeamMember = false,
  delegatedEntries = [],
}) {
  if (subscriptionActive) return true
  if (view === 'equipe') return pendingInvite || activeTeamMember
  if (view === 'treinos') return professionalRole === 'trainer' && delegatedEntries.length > 0
  if (view === 'nutricao') return professionalRole === 'nutritionist' && delegatedEntries.length > 0
  return false
}
