import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql', import.meta.url), 'utf8')
const studentConsent = await readFile(new URL('../src/StudentProfessionalCollaborationRequests.jsx', import.meta.url), 'utf8')
const avatarFunction = await readFile(new URL('../supabase/functions/student-avatar/index.ts', import.meta.url), 'utf8')
const delegatedWorkoutView = await readFile(new URL('../src/ProfessionalDelegatedWorkoutReadOnly.jsx', import.meta.url), 'utf8')
const iosStoreKit = await readFile(new URL('../src/iosStoreKit.js', import.meta.url), 'utf8')
const appleSubscriptionFunction = await readFile(new URL('../supabase/functions/apple-subscription-sync/index.ts', import.meta.url), 'utf8')
const supabaseConfig = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8')

test('Equipe real conecta criação, convites, concessões, saída e remoção por vínculo independente', () => {
  assert.match(app, /activeView === 'equipe' && \(/)
  assert.match(app, /<ProfessionalTeamWorkspace/)
  for (const handler of ['onCreateTeam', 'onInviteMember', 'onAcceptInvite', 'onDeclineInvite', 'onCancelInvite', 'onRemoveMember', 'onLeaveTeam', 'onSetDelegations', 'onRevokeDelegation']) {
    assert.match(app, new RegExp(`${handler}:`))
  }
  assert.match(migration, /primary key \(team_id, member_professional_id\)/i)
  assert.match(migration, /update public\.professional_team_members[\s\S]*?set status = 'left'/i)
  assert.match(migration, /where team_id = selected_team_id and member_professional_id = actor_id and status = 'active'/i)
})

test('Treinos só libera nutricionista responsável quando a área workout tem colaboração aceita', () => {
  assert.match(app, /nutritionistOwnsAcceptedWorkoutDelegation = nutritionistUser && professionalCollaboration\.ownerWorkoutWorkspace\.length > 0/)
  assert.match(app, /activeView === 'treinos' && nutritionistUser/)
  assert.match(app, /<ProfessionalDelegatedWorkoutReadOnly/)
  assert.match(delegatedWorkoutView, /Somente leitura/)
  assert.doesNotMatch(delegatedWorkoutView, /onSaveWorkout|onArchiveWorkout|saveRemote/)
})

test('membro treinador salva apenas workout delegado e não ganha permissões de nutrição/cadastro', () => {
  assert.match(app, /activeView === 'treinos' && !nutritionistUser/)
  assert.match(app, /saveRemoteCollaborativeWorkout\(workout\)/)
  assert.match(app, /A delegação desta equipe libera somente Treinos/)
  assert.match(app, /Os dados cadastrais do paciente não são compartilhados nesta área/)
  assert.match(migration, /private\.coachfit_professional_role\(actor_id\) <> 'trainer'/)
  assert.match(migration, /collaboration_delegation_id = delegation_value/)
})

test('colaboração nutricional permite dieta e oculta Questionário para pacientes delegados', () => {
  assert.match(app, /collaborationMode=\{delegatedNutritionStudentIds\.has\(String\(selectedProfessionalNutritionStudent\?\.id/)
  assert.match(app, /professionalQuestionnaireStudents = professionalNutritionStudents\.filter\(/)
  assert.match(app, /students=\{safeQuestionnaireStudents\}/)
  assert.match(app, /!collaborationMode \|\| id !== 'questionario'/)
  assert.match(app, /saveRemoteCollaborativeNutritionPlan\(plan\)/)
  assert.match(migration, /private\.coachfit_professional_role\(actor_id\) <> 'nutritionist'/)
  assert.match(migration, /from public\.professional_patient_delegations d[\s\S]*?d\.area = 'nutrition'[\s\S]*?d\.consent_status = 'accepted'/i)
})

test('responsável acompanha dieta delegada aceita em modo somente leitura', () => {
  assert.match(app, /filter\(\(plan\) => plan\.id && plan\.collaborationDelegationId\)/)
  assert.match(app, /readOnlyCollaborativeNutritionPlanIds/)
  assert.match(app, /editingPlanIsReadOnly \? \(/)
  assert.match(app, /readOnlyPlanIds=\{readOnlyNutritionPlanIds\}/)
  assert.match(app, /planIsReadOnly \? ' · somente leitura para o responsável' : ''/)
  assert.match(app, /A dieta do profissional colaborador permanece somente para leitura durante esta concessão ativa/)
})

test('consentimento exige conta autenticada no portal, aceita/revoga no servidor e permanece visível após aceite', () => {
  assert.match(app, /if \(activeTab === 'equipe' && accountEmail\)/)
  assert.match(app, /id !== 'equipe' \|\| Boolean\(accountEmail\)/)
  assert.match(app, /if \(!accountEmail \|\| !inviteCode \|\| !supabaseEnabled\) return false/)
  assert.match(studentConsent, /respond\('accept'\)/)
  assert.match(studentConsent, /respond\('decline'\)/)
  assert.match(studentConsent, /target\.delegationId, 'revoke'/)
  assert.match(migration, /d\.consent_status in \('pending', 'accepted'\)/i)
  assert.match(migration, /normalized_decision not in \('accept', 'decline', 'revoke'\)/i)
})

test('autoria e foto do colaborador são vinculadas à delegação consentida', () => {
  assert.equal((api.match(/createdBy: row\.created_by \?\? row\.coach_id/g) || []).length, 2)
  assert.equal((api.match(/collaborationDelegationId: row\.collaboration_delegation_id \?\? ''/g) || []).length, 2)
  assert.match(app, /Elaborada por \{plan\.createdByName/)
  assert.match(delegatedWorkoutView, /Elaborado por \{text\(workout\?\.createdByName/)
  assert.match(avatarFunction, /authenticatedStudent = Boolean\(requester\?\.id && access\.student\.auth_user_id === requester\.id\)/)
  assert.match(avatarFunction, /member\?\.status !== 'active' \|\| member\?\.professional_role !== expectedRole/)
  assert.match(migration, /d\.status = 'active' and d\.consent_status = 'accepted'/i)
})

test('tabelas colaborativas não têm acesso direto por anon/authenticated e gates de assinatura permanecem presentes', () => {
  for (const table of ['professional_teams', 'professional_team_members', 'professional_team_invites', 'professional_patient_delegations', 'professional_collaboration_audit']) {
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'))
  }
  assert.match(app, /shouldLockCoachTools/)
  assert.match(app, /professionalAccessActive/)
  assert.match(app, /getIosEntitlements/)
})

test('RPCs BUILD41 exigem entitlement servidor web/afiliado/Apple e StoreKit sincroniza prova Apple assinada', () => {
  assert.match(migration, /private\.coachfit_professional_access_active\(target_professional_id uuid\)/)
  assert.match(migration, /from public\.coach_subscriptions as subscription/i)
  assert.match(migration, /from public\.affiliate_professionals as affiliate/i)
  assert.match(migration, /from public\.professional_apple_subscription_entitlements as apple/i)
  assert.match(migration, /apple\.last_verified_at > now\(\) - interval '1 minute'/i)
  assert.equal((migration.match(/perform private\.coachfit_require_professional_access\(\);/g) || []).length, 9)
  assert.match(migration, /revoke all on public\.professional_apple_subscription_entitlements from public, anon, authenticated/i)
  assert.match(migration, /prevent_apple_entitlement_owner_reassignment/)
  assert.match(appleSubscriptionFunction, /getAllSubscriptionStatuses\(originalId\)/)
  assert.match(appleSubscriptionFunction, /SignedDataVerifier/)
  assert.match(appleSubscriptionFunction, /transaction\.appAccountToken[\s\S]*userId/i)
  assert.match(appleSubscriptionFunction, /transaction\.bundleId !== bundleId/)
  assert.match(supabaseConfig, /\[functions\.apple-subscription-sync\]\s+verify_jwt = true/)
  assert.match(iosStoreKit, /syncRemoteAppleSubscriptionEntitlement\(originalTransactionId\)/)
  assert.match(app, /await syncAppleServerEntitlement\(\)/)
  assert.match(app, /purchaseIosPlan\(selectedCheckoutPlanId, accountId, nativeProductsByPlan\[selectedCheckoutPlanId\]\)/)
  assert.match(app, /restoreIosPurchases\(accountId\)/)

  for (const functionName of ['revoke_professional_patient_delegation', 'leave_professional_team', 'remove_professional_team_member']) {
    const start = migration.indexOf(`function public.${functionName}`)
    assert.notEqual(start, -1)
    const nextFunction = migration.indexOf('create or replace function public.', start + 1)
    const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction)
    assert.doesNotMatch(body, /coachfit_require_professional_access/)
  }
})
