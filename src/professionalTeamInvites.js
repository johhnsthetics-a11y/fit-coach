function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US')
}

export function filterProfessionalTeamInvites(invites, email, professionalRole) {
  const targetEmail = normalize(email)
  const targetRole = normalize(professionalRole)
  if (!targetEmail || !targetRole || !Array.isArray(invites)) return []
  return invites.filter((invite) => (
    normalize(invite?.inviteeEmail ?? invite?.invitee_email ?? invite?.recipientEmail ?? invite?.recipient_email) === targetEmail
    && normalize(invite?.expectedRole ?? invite?.expected_role ?? invite?.professionalRole ?? invite?.professional_role) === targetRole
    && normalize(invite?.status) === 'pending'
  ))
}
