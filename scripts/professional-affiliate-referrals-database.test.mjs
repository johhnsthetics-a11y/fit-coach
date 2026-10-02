const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const affiliateA = '11111111-1111-4111-8111-111111111111'
const affiliateB = '22222222-2222-4222-8222-222222222222'
const inactiveAffiliate = '33333333-3333-4333-8333-333333333333'
const referredTrainer = '44444444-4444-4444-8444-444444444444'
const referredNutritionist = '55555555-5555-4555-8555-555555555555'
const wrongUser = '66666666-6666-4666-8666-666666666666'
const alreadyPaid = '77777777-7777-4777-8777-777777777777'
const master = '88888888-8888-4888-8888-888888888888'
const studentA = '99999999-9999-4999-8999-999999999999'
const wrongProfessionalType = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

async function setAuth(db, id, email) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${id}', false);
    select set_config('request.jwt.claims', '{"email":"${email}"}', false);
    set role authenticated;
  `)
}

test('indicacao profissional aplica ownership, atribuicao unica e relatorios separados', async () => {
  const db = new PGlite()

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema extensions;

    create function extensions.gen_random_bytes(size integer) returns bytea language sql volatile as $$
      select decode(substr(
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        1,
        size * 2
      ), 'hex')
    $$;
    create function extensions.digest(value bytea, algorithm text) returns bytea language sql immutable as $$
      select decode(md5(encode(value, 'hex')) || md5('coachfit-' || encode(value, 'hex')), 'hex')
    $$;

    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;

    create table public.users(
      id uuid primary key references auth.users(id),
      name text,
      email text,
      role text
    );
    create table public.students(
      id uuid primary key,
      coach_id uuid references public.users(id),
      name text,
      email text,
      app_payment_status text,
      created_at timestamptz default now()
    );
    create table public.coach_subscriptions(
      coach_id uuid primary key references public.users(id),
      status text,
      current_period_ends_at timestamptz
    );
    create table public.affiliate_professionals(
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.affiliate_student_payments(
      id uuid primary key default gen_random_uuid(),
      webhook_event_id text not null unique,
      coach_id uuid references public.users(id),
      student_id uuid references public.students(id),
      affiliate_email text not null,
      status text not null,
      paid_at timestamptz not null,
      payment_month date not null,
      revenue_cents integer not null,
      provider_amount_cents integer,
      commission_rate numeric(5,4) not null,
      commission_cents integer not null,
      provider text,
      provider_order_id text,
      provider_subscription_id text,
      reversal_event_id text,
      reversed_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    insert into auth.users(id) values
      ('${affiliateA}'), ('${affiliateB}'), ('${inactiveAffiliate}'),
      ('${referredTrainer}'), ('${referredNutritionist}'), ('${wrongUser}'),
      ('${alreadyPaid}'), ('${master}'), ('${wrongProfessionalType}');
    insert into public.users(id, name, email, role) values
      ('${affiliateA}', 'Afiliado A', 'affiliate-a@example.test', 'Treinador'),
      ('${affiliateB}', 'Afiliado B', 'affiliate-b@example.test', 'Nutricionista'),
      ('${inactiveAffiliate}', 'Afiliado Inativo', 'inactive@example.test', 'Treinador'),
      ('${referredTrainer}', 'Treinador Indicado', 'trainer@example.test', 'Treinador'),
      ('${referredNutritionist}', 'Nutricionista Indicada', 'nutritionist@example.test', 'Nutricionista'),
      ('${wrongUser}', 'Conta Errada', 'wrong@example.test', 'Treinador'),
      ('${alreadyPaid}', 'Profissional Pago', 'paid@example.test', 'Treinador'),
      ('${master}', 'Admin Master', 'sac@coachfitpro.com.br', 'Admin'),
      ('${wrongProfessionalType}', 'Tipo Divergente', 'type-mismatch@example.test', 'Treinador');
    insert into public.affiliate_professionals(email, active) values
      ('affiliate-a@example.test', true),
      ('affiliate-b@example.test', true),
      ('inactive@example.test', false);
    insert into public.coach_subscriptions(coach_id, status, current_period_ends_at)
      values ('${alreadyPaid}', 'active', now() + interval '1 month');
    insert into public.students(id, coach_id, name, email, app_payment_status)
      values ('${studentA}', '${affiliateA}', 'Aluno A', 'student@example.test', 'active');
    insert into public.affiliate_student_payments(
      webhook_event_id, coach_id, student_id, affiliate_email, status, paid_at,
      payment_month, revenue_cents, provider_amount_cents, commission_rate,
      commission_cents, provider, provider_order_id
    ) values (
      'student-event-a', '${affiliateA}', '${studentA}', 'affiliate-a@example.test',
      'paid', now(), date_trunc('month', now())::date, 2500, 2500, 0.2500,
      625, 'cartpanda', 'student-order-a'
    );
  `)

  const migration = (await readFile(
    new URL('../supabase/migrations/20261002_professional_affiliate_referrals.sql', import.meta.url),
    'utf8',
  )).replace('create extension if not exists pgcrypto with schema extensions;', '')
  await db.exec(migration)

  await setAuth(db, inactiveAffiliate, 'inactive@example.test')
  await assert.rejects(
    db.query("select public.create_affiliate_professional_referral('new@example.test', 'trainer')"),
    /afiliado ativo|permission|permiss/i,
  )

  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  const invalidType = (await db.query(
    "select public.create_affiliate_professional_referral('new@example.test', 'student') as value",
  )).rows[0].value
  assert.equal(invalidType.ok, false)
  assert.equal(invalidType.errorCode, 'invalid_professional_type')

  const selfReferral = (await db.query(
    "select public.create_affiliate_professional_referral('AFFILIATE-A@example.test', 'trainer') as value",
  )).rows[0].value
  assert.equal(selfReferral.errorCode, 'self_referral')

  const paidReferral = (await db.query(
    "select public.create_affiliate_professional_referral('paid@example.test', 'trainer') as value",
  )).rows[0].value
  assert.equal(paidReferral.errorCode, 'already_subscribed')

  const createdTrainer = (await db.query(
    "select public.create_affiliate_professional_referral(' TRAINER@example.test ', 'trainer') as value",
  )).rows[0].value
  assert.equal(createdTrainer.ok, true)
  assert.match(createdTrainer.token, /^[a-f0-9]{64}$/)
  assert.equal(createdTrainer.referral.referredEmail, 'trainer@example.test')

  await db.exec('reset role')
  const storedToken = (await db.query(
    "select invite_token_hash, referred_email from public.affiliate_professional_referrals where referred_email = 'trainer@example.test'",
  )).rows[0]
  assert.equal(storedToken.referred_email, 'trainer@example.test')
  assert.notEqual(String(storedToken.invite_token_hash), createdTrainer.token)

  await setAuth(db, affiliateB, 'affiliate-b@example.test')
  const conflicting = (await db.query(
    "select public.create_affiliate_professional_referral('trainer@example.test', 'trainer') as value",
  )).rows[0].value
  assert.equal(conflicting.ok, false)
  assert.equal(conflicting.errorCode, 'referral_conflict')
  assert.equal(JSON.stringify(conflicting).includes('affiliate-a@example.test'), false)

  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  const mismatchInvite = (await db.query(
    "select public.create_affiliate_professional_referral('nutritionist@example.test', 'nutritionist') as value",
  )).rows[0].value
  assert.equal(mismatchInvite.ok, true)

  await setAuth(db, wrongUser, 'wrong@example.test')
  const wrongClaim = (await db.query(
    'select public.claim_affiliate_professional_referral($1) as value',
    [mismatchInvite.token],
  )).rows[0].value
  assert.equal(wrongClaim.errorCode, 'email_mismatch')
  await db.exec('reset role')
  assert.equal((await db.query(
    "select status from public.affiliate_professional_referrals where referred_email = 'nutritionist@example.test'",
  )).rows[0].status, 'pending')

  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  const typeMismatchInvite = (await db.query(
    "select public.create_affiliate_professional_referral('type-mismatch@example.test', 'nutritionist') as value",
  )).rows[0].value
  await setAuth(db, wrongProfessionalType, 'type-mismatch@example.test')
  const wrongTypeClaim = (await db.query(
    'select public.claim_affiliate_professional_referral($1) as value',
    [typeMismatchInvite.token],
  )).rows[0].value
  assert.equal(wrongTypeClaim.errorCode, 'professional_type_mismatch')

  await setAuth(db, referredTrainer, 'trainer@example.test')
  const claimed = (await db.query(
    'select public.claim_affiliate_professional_referral($1) as value',
    [createdTrainer.token],
  )).rows[0].value
  assert.equal(claimed.ok, true)
  assert.equal(claimed.referral.status, 'claimed')

  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  const cancelInvite = (await db.query(
    "select public.create_affiliate_professional_referral('cancel@example.test', 'trainer') as value",
  )).rows[0].value
  await setAuth(db, affiliateB, 'affiliate-b@example.test')
  const foreignCancel = (await db.query(
    'select public.cancel_affiliate_professional_referral($1) as value',
    [cancelInvite.referral.id],
  )).rows[0].value
  assert.equal(foreignCancel.errorCode, 'referral_not_found')
  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  assert.equal((await db.query(
    'select public.cancel_affiliate_professional_referral($1) as value',
    [cancelInvite.referral.id],
  )).rows[0].value.ok, true)

  await db.exec('reset role')
  const referralId = (await db.query(
    "select id from public.affiliate_professional_referrals where referred_email = 'trainer@example.test'",
  )).rows[0].id
  await db.exec(`
    insert into public.affiliate_professional_payments(
      referral_id, affiliate_id, affiliate_email, referred_user_id,
      webhook_event_id, provider_order_id, provider_subscription_id,
      plan_cycle, gross_amount_cents, commission_rate, commission_cents,
      status, paid_at
    )
    select
      '${referralId}', affiliates.id, affiliates.email, '${referredTrainer}',
      'professional-event-a', 'professional-order-a', 'professional-sub-a',
      'monthly', 4990, 0.5000, 2495, 'paid', now()
    from public.affiliate_professionals as affiliates
    where affiliates.email = 'affiliate-a@example.test';
  `)
  await assert.rejects(
    db.exec(`
      insert into public.affiliate_professional_payments(
        referral_id, affiliate_id, affiliate_email, referred_user_id,
        webhook_event_id, provider_order_id, gross_amount_cents,
        commission_rate, commission_cents, status, paid_at
      )
      select
        '${referralId}', affiliates.id, affiliates.email, '${referredTrainer}',
        'professional-event-b', 'professional-order-a', 4990, 0.5000, 2495,
        'paid', now()
      from public.affiliate_professionals as affiliates
      where affiliates.email = 'affiliate-a@example.test';
    `),
    /unique|duplicate/i,
  )

  await setAuth(db, affiliateA, 'affiliate-a@example.test')
  const ownReport = (await db.query(
    'select public.get_my_commission_report(current_date - 1, current_date + 1) as value',
  )).rows[0].value
  assert.equal(ownReport.totals.commissionCents, 625)
  assert.equal(ownReport.professionalCommissions.totals.commissionCents, 2495)
  assert.equal(ownReport.consolidatedTotals.commissionCents, 3120)
  assert.equal(ownReport.professionalCommissions.payments.length, 1)

  await assert.rejects(
    db.query('select * from public.affiliate_professional_payments'),
    /permission denied/i,
  )

  await setAuth(db, affiliateB, 'affiliate-b@example.test')
  const isolatedReport = (await db.query(
    'select public.get_my_commission_report(current_date - 1, current_date + 1) as value',
  )).rows[0].value
  assert.equal(isolatedReport.professionalCommissions.payments.length, 0)

  await setAuth(db, master, 'sac@coachfitpro.com.br')
  const adminReport = (await db.query(
    'select public.get_affiliate_finance_report(current_date - 1, current_date + 1) as value',
  )).rows[0].value
  assert.equal(adminReport.professionalTotals.commissionCents, 2495)
  assert.equal(adminReport.consolidatedTotals.commissionCents, 3120)
  assert.equal(adminReport.affiliates.find(row => row.email === 'affiliate-a@example.test').professionalPayments.length, 1)

  await db.close()
})
