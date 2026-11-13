import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql', import.meta.url), 'utf8')
const guestAccessMigration = await readFile(new URL('../supabase/migrations/20261112163114_allow_unsubscribed_team_invitees.sql', import.meta.url), 'utf8')
const scopedInvitesMigration = await readFile(new URL('../supabase/migrations/20261112173136_scoped_professional_team_invites_build42.sql', import.meta.url), 'utf8')
const inviteDiscoveryMigration = await readFile(new URL('../supabase/migrations/20261112185705_team_invite_discovery_candidate_search.sql', import.meta.url), 'utf8')
const inviteSignupContextMigration = await readFile(new URL('../supabase/migrations/20261112213600_team_invite_signup_context_build44.sql', import.meta.url), 'utf8')
const studentConsent = await readFile(new URL('../src/StudentProfessionalCollaborationRequests.jsx', import.meta.url), 'utf8')
const teamWorkspace = await readFile(new URL('../src/ProfessionalTeamWorkspace.jsx', import.meta.url), 'utf8')
const inviteEmailFunction = await readFile(new URL('../supabase/functions/professional-team-invitation/index.ts', import.meta.url), 'utf8')
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

test('escopo escolhido pelo responsável fica ativo ao aceitar convite; aluno pode consultar e revogar acesso', () => {
  assert.match(app, /if \(activeTab === 'equipe' && accountEmail\)/)
  assert.match(app, /id !== 'equipe' \|\| Boolean\(accountEmail\)/)
  assert.match(app, /if \(!accountEmail \|\| !inviteCode \|\| !supabaseEnabled\) return false/)
  assert.match(studentConsent, /target\.delegationId, 'revoke'/)
  assert.match(scopedInvitesMigration, /selected_student_ids uuid\[\]/i)
  assert.match(scopedInvitesMigration, /authorization_source = 'team_owner'/i)
  assert.match(scopedInvitesMigration, /lower\(i\.invitee_email\) = actor_email/i)
  assert.match(scopedInvitesMigration, /i\.expected_role = private\.coachfit_professional_role\(actor_id\)/i)
  assert.match(teamWorkspace, /Acesso a Treinos|Acesso a Nutrição/)
  assert.match(teamWorkspace, /Pacientes: \{patientNames\.join/)
  assert.match(studentConsent, /Revogar acesso/)
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

test('convidado sem assinatura recebe apenas a colaboração e não os dados próprios pagos', () => {
  assert.match(app, /canManageTeam=\{professionalAccessActive\}/)
  assert.match(app, /collaborationOnlyMode \? \[\] : data\.students/)
  assert.match(app, /collaborationOnlyMode \? \[\] : data\.nutritionQuestionnaires/)
  assert.match(app, /collaborationOnlyMode \? \[\] : \(data\.anamneses/)
  assert.match(app, /isProfessionalViewLocked\(item\.id\)/)
  assert.match(app, /if \(hasProfessionalAccess\) await syncAppleServerEntitlement\(\)/)
  assert.match(guestAccessMigration, /accept_professional_team_invite/)
  assert.doesNotMatch(guestAccessMigration, /coachfit_require_professional_access/)
  assert.match(app.slice(app.indexOf('<ProfessionalTeamWorkspace'), app.indexOf('/>', app.indexOf('<ProfessionalTeamWorkspace'))), /canManageTeam/)
})

test('convite por e-mail direciona ao login existente ou cadastro com perfil e validação de escopo', () => {
  assert.match(scopedInvitesMigration, /create_professional_team_invite_scoped\([\s\S]*?selected_student_ids uuid\[\]/i)
  assert.match(scopedInvitesMigration, /validate_professional_team_invite_signup/)
  assert.match(scopedInvitesMigration, /get_professional_team_invite_email_payload/)
  assert.match(inviteEmailFunction, /RESEND_API_KEY/)
  assert.match(inviteEmailFunction, /COACHFIT_TEAM_INVITE_FROM/)
  assert.match(inviteEmailFunction, /mode: existingAccount \? "signin" : "signup"/)
  assert.match(inviteEmailFunction, /Não é necessário contratar uma assinatura/)
  assert.doesNotMatch(inviteEmailFunction, /password/i)
  assert.match(supabaseConfig, /\[functions\.professional-team-invitation\]\s+verify_jwt = true/)
})

test('caixa de entrada exibe somente convites endereçados ao e-mail autenticado', () => {
  assert.match(inviteDiscoveryMigration, /get_professional_team_invite_inbox/)
  assert.match(inviteDiscoveryMigration, /lower\(btrim\(i\.invitee_email\)\) = actor_email/)
  assert.match(inviteDiscoveryMigration, /i\.status = 'pending'/)
  assert.doesNotMatch(inviteDiscoveryMigration, /professional_team_invites i[\s\S]*?expected_role = private\.coachfit_professional_role/)
  assert.match(app, /inviteAutoOpenUserRef/)
  assert.match(api, /get_professional_team_invite_inbox/)
})

test('cadastro por convite confirma e-mail e especialidade e preserva o retorno da confirmação', () => {
  assert.match(api, /loadRemoteProfessionalTeamInviteSignupContext/)
  assert.match(api, /get_professional_team_invite_signup_context/)
  assert.match(app, /loadRemoteProfessionalTeamInviteSignupContext\(inviteSignupId\)/)
  assert.match(app, /readOnly=\{Boolean\(inviteSignupContext\)\}/)
  assert.match(app, /Perfil profissional definido pelo convite/)
  assert.match(app, /searchParams\.set\('role', invitedProfessionalRole\)/)
  assert.match(app, /email_confirmation_required/)
  assert.match(app, /Já confirmei meu e-mail — entrar e continuar o convite/)
  assert.match(inviteSignupContextMigration, /i\.status = 'pending'/)
  assert.match(inviteSignupContextMigration, /i\.expires_at > now\(\)/)
  assert.match(inviteSignupContextMigration, /grant execute on function public\.get_professional_team_invite_signup_context\(uuid\) to anon, authenticated/i)
  assert.doesNotMatch(inviteSignupContextMigration, /nutritionPlans|workoutLogs|bodyFat|calories/i)
})

test('assinatura desbloqueia ferramentas sem apagar equipe e exibe a etapa de ativação', async () => {
  assert.match(app, /activeTeamMember && shouldLockCoachTools/)
  assert.match(app, /Ver planos profissionais/)
  assert.match(app, /title=\"Ativando seu espaço profissional\.\.\.\"/)
  assert.match(app, /refreshProfessionalCollaboration\(\{ silent: true, forceProfessionalAccess: true \}\)/)
  const start = app.indexOf('const runProfessionalActivation =')
  const end = app.indexOf('const syncCoachWorkspace =', start)
  assert.notEqual(start, -1)
  assert.ok(end > start)
  const activation = app.slice(start, end)
  assert.doesNotMatch(activation, /removeRemoteProfessionalTeamMember|leaveRemoteProfessionalTeam/)
  const databaseTest = await readFile(new URL('./product-database.test.mjs', import.meta.url), 'utf8')
  assert.match(databaseTest, /memberWorkspaceAfterSubscription/)
  assert.match(databaseTest, /multiTeamAfterSubscription/)
})

test('seleção de pacientes permite pesquisa por nome, CPF e e-mail e seleção dos resultados', () => {
  assert.match(inviteDiscoveryMigration, /'email', coalesce\(s\.email/)
  assert.match(inviteDiscoveryMigration, /'cpf', coalesce\(s\.cpf/)
  assert.match(teamWorkspace, /Nome, CPF ou e-mail/)
  assert.match(teamWorkspace, /Selecionar todos os resultados/)
  assert.match(teamWorkspace, /filterProfessionalTeamCandidates/)
})

test('tabelas colaborativas não têm acesso direto por anon/authenticated e gates de assinatura permanecem presentes', () => {
  for (const table of ['professional_teams', 'professional_team_members', 'professional_team_invites', 'professional_patient_delegations', 'professional_collaboration_audit']) {
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'))
  }
  assert.match(app, /shouldLockCoachTools/)
  assert.match(app, /professionalAccessActive/)
  assert.match(app, /getIosEntitlements/)
})

test('BUILD41 exige entitlement do responsável, mas libera colaboração aceita ao membro sem assinatura própria', () => {
  assert.match(migration, /private\.coachfit_professional_access_active\(target_professional_id uuid\)/)
  assert.match(migration, /from public\.coach_subscriptions as subscription/i)
  assert.match(migration, /from public\.affiliate_professionals as affiliate/i)
  assert.match(migration, /from public\.professional_apple_subscription_entitlements as apple/i)
  assert.match(migration, /apple\.last_verified_at > now\(\) - interval '1 minute'/i)
  for (const functionName of ['create_professional_team', 'create_professional_team_invite', 'list_professional_team_candidates', 'replace_professional_patient_delegations']) {
    const start = migration.indexOf(`function public.${functionName}`)
    assert.notEqual(start, -1)
    const nextFunction = migration.indexOf('create or replace function public.', start + 1)
    const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction)
    assert.match(body, /coachfit_require_professional_access/)
  }
  for (const functionName of ['get_professional_team_workspace', 'accept_professional_team_invite', 'get_professional_delegated_workspace', 'save_collaborative_nutrition_plan', 'save_collaborative_workout']) {
    const start = guestAccessMigration.indexOf(`function public.${functionName}`)
    assert.notEqual(start, -1)
    const nextFunction = guestAccessMigration.indexOf('create or replace function public.', start + 1)
    const body = guestAccessMigration.slice(start, nextFunction === -1 ? undefined : nextFunction)
    assert.doesNotMatch(body, /coachfit_require_professional_access/)
  }
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
