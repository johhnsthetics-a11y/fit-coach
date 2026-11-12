import test from 'node:test'
import assert from 'node:assert/strict'
import { canOpenProfessionalCollaborationView } from '../src/professionalTeamAccess.js'

test('professional without subscription can see and accept a received team invite', () => {
  assert.equal(canOpenProfessionalCollaborationView({ view: 'equipe', pendingInvite: true }), true)
})

test('active team member without subscription can access team management view', () => {
  assert.equal(canOpenProfessionalCollaborationView({ view: 'equipe', activeTeamMember: true }), true)
})

test('trainer without subscription can open workouts only with delegated entries', () => {
  const base = { professionalRole: 'trainer', delegatedEntries: [{ student: { id: 'student-1' } }] }
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'treinos' }), true)
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'nutricao' }), false)
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'alunos' }), false)
})

test('nutritionist without subscription can open nutrition only with delegated entries', () => {
  const base = { professionalRole: 'nutritionist', delegatedEntries: [{ student: { id: 'patient-1' } }] }
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'nutricao' }), true)
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'treinos' }), false)
  assert.equal(canOpenProfessionalCollaborationView({ ...base, view: 'alunos' }), false)
})

test('a subscriptionless account without invite or delegation stays on the paywall', () => {
  assert.equal(canOpenProfessionalCollaborationView({ view: 'equipe' }), false)
  assert.equal(canOpenProfessionalCollaborationView({ view: 'treinos', professionalRole: 'trainer' }), false)
})

test('active subscription preserves normal access to professional views', () => {
  assert.equal(canOpenProfessionalCollaborationView({ view: 'alunos', subscriptionActive: true }), true)
})
