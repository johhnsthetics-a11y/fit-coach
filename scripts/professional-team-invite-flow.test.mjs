import test from 'node:test'
import assert from 'node:assert/strict'
import { filterProfessionalTeamInvites } from '../src/professionalTeamInvites.js'

const invites = [
  { id: 'mine', inviteeEmail: 'trainer@example.com', expectedRole: 'trainer', status: 'pending' },
  { id: 'other-email', inviteeEmail: 'other@example.com', expectedRole: 'trainer', status: 'pending' },
  { id: 'other-role', inviteeEmail: 'trainer@example.com', expectedRole: 'nutritionist', status: 'pending' },
  { id: 'accepted', inviteeEmail: 'trainer@example.com', expectedRole: 'trainer', status: 'accepted' },
]

test('only the pending invite for the exact signed-in email and professional role is shown', () => {
  assert.deepEqual(filterProfessionalTeamInvites(invites, ' Trainer@Example.com ', 'trainer').map((invite) => invite.id), ['mine'])
  assert.deepEqual(filterProfessionalTeamInvites(invites, 'other@example.com', 'trainer').map((invite) => invite.id), ['other-email'])
  assert.deepEqual(filterProfessionalTeamInvites(invites, 'trainer@example.com', 'nutritionist').map((invite) => invite.id), ['other-role'])
  assert.deepEqual(filterProfessionalTeamInvites(invites, '', 'trainer'), [])
})

