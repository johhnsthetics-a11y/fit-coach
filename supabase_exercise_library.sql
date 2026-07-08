-- Biblioteca central de exercicios do Coach Fit Pro.
-- Use esta tabela para vincular um video padrao a cada exercicio.
-- Depois de subir um video no bucket exercise-library-videos, cole a URL publica em video_url.

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null default '',
  equipment text default '',
  instructions text default '',
  video_url text default '',
  thumbnail_url text default '',
  muscle_map text default '',
  aliases text[] default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.exercise_library enable row level security;

create index if not exists exercise_library_active_idx
on public.exercise_library (active, muscle_group, name);

drop policy if exists "exercise library public read" on public.exercise_library;
drop policy if exists "exercise library admin manage" on public.exercise_library;

create policy "exercise library public read"
on public.exercise_library for select
to anon, authenticated
using (active = true);

create policy "exercise library admin manage"
on public.exercise_library for all
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-library-videos',
  'exercise-library-videos',
  true,
  125829120,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 125829120,
  allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];

drop policy if exists "exercise library videos read" on storage.objects;
drop policy if exists "exercise library videos insert" on storage.objects;
drop policy if exists "exercise library videos update" on storage.objects;
drop policy if exists "exercise library videos delete" on storage.objects;

create policy "exercise library videos read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'exercise-library-videos');

create policy "exercise library videos insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'exercise-library-videos'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
);

create policy "exercise library videos update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'exercise-library-videos'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
)
with check (
  bucket_id = 'exercise-library-videos'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
);

create policy "exercise library videos delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'exercise-library-videos'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
);

insert into public.exercise_library
  (name, muscle_group, equipment, instructions, aliases, active)
values
  ('Supino reto com barra', 'Peitoral', 'Barra e banco', 'Pes firmes, escapulas apoiadas e barra descendo com controle ate a linha media do peito.', array['supino reto', 'bench press'], true),
  ('Supino inclinado com halteres', 'Peitoral', 'Halteres e banco', 'Mantenha o peito aberto, antebracos alinhados e evite perder a posicao dos ombros.', array['supino inclinado'], true),
  ('Crucifixo com halteres', 'Peitoral', 'Halteres e banco', 'Cotovelos levemente flexionados e amplitude controlada sem forcar a articulacao do ombro.', array['crucifixo'], true),
  ('Flexao de bracos', 'Peitoral', 'Peso corporal', 'Corpo alinhado, abdomen ativo e cotovelos acompanhando a linha natural dos ombros.', array['flexao', 'flexao de braco'], true),
  ('Puxada frontal', 'Costas', 'Polia alta', 'Inicie deprimindo as escapulas e puxe a barra em direcao a parte superior do peito.', array['puxada alta', 'pulley frente'], true),
  ('Remada baixa', 'Costas', 'Polia baixa', 'Tronco estavel, peito aberto e cotovelos conduzindo o movimento para tras.', array['remada sentada'], true),
  ('Remada curvada com barra', 'Costas', 'Barra', 'Quadril para tras, coluna neutra e barra aproximando-se do abdomen sem balanco.', array['remada curvada'], true),
  ('Barra fixa', 'Costas', 'Barra fixa', 'Evite impulso, mantenha o tronco firme e conduza o peito em direcao a barra.', array['pull up', 'barra'], true),
  ('Desenvolvimento com halteres', 'Ombros', 'Halteres', 'Abdomen ativo, punhos alinhados e subida sem compensar com a lombar.', array['desenvolvimento', 'shoulder press'], true),
  ('Elevacao lateral', 'Ombros', 'Halteres', 'Eleve pelos cotovelos ate a linha dos ombros, sem embalo e com carga controlada.', array['elevacao lateral'], true),
  ('Rosca direta', 'Biceps', 'Barra', 'Cotovelos proximos ao tronco e movimento sem inclinar o corpo para gerar impulso.', array['rosca barra'], true),
  ('Rosca alternada', 'Biceps', 'Halteres', 'Mantenha o braco estavel e controle completamente a fase de descida.', array['rosca com halteres'], true),
  ('Triceps na polia', 'Triceps', 'Polia', 'Cotovelos fixos, ombros baixos e extensao completa sem movimentar o tronco.', array['triceps pulley'], true),
  ('Triceps frances', 'Triceps', 'Halter', 'Mantenha os cotovelos apontados a frente e evite compensacao lombar.', array['triceps frances'], true),
  ('Agachamento livre', 'Quadriceps e gluteos', 'Barra', 'Pes firmes, joelhos acompanhando a direcao dos pes e coluna neutra durante toda a amplitude.', array['agachamento', 'back squat'], true),
  ('Leg press 45', 'Quadriceps e gluteos', 'Leg press', 'Lombar apoiada, joelhos alinhados e descida apenas ate manter a pelve estavel.', array['leg press', 'leg press 45'], true),
  ('Cadeira extensora', 'Quadriceps', 'Maquina', 'Ajuste o eixo ao joelho, estabilize o quadril e controle a descida.', array['extensora'], true),
  ('Mesa flexora', 'Posteriores de coxa', 'Maquina', 'Quadril apoiado, abdomen ativo e flexao sem tirar o tronco do banco.', array['flexora deitada'], true),
  ('Stiff com barra', 'Posteriores e gluteos', 'Barra', 'Empurre o quadril para tras, mantenha a barra proxima as pernas e preserve a coluna neutra.', array['stiff', 'romeno'], true),
  ('Levantamento terra', 'Posteriores e costas', 'Barra', 'Barra proxima ao corpo, tronco firme e forca aplicada pelo chao sem arredondar a coluna.', array['terra', 'deadlift'], true),
  ('Afundo com halteres', 'Quadriceps e gluteos', 'Halteres', 'Passo estavel, tronco organizado e joelho dianteiro acompanhando a ponta do pe.', array['afundo', 'passada'], true),
  ('Elevacao pelvica', 'Gluteos', 'Banco e barra', 'Queixo levemente recolhido, costelas baixas e extensao do quadril sem hiperestender a lombar.', array['hip thrust'], true),
  ('Panturrilha em pe', 'Panturrilhas', 'Maquina ou peso corporal', 'Use amplitude completa, pause no topo e controle a descida sem quicar.', array['panturrilha'], true),
  ('Prancha abdominal', 'Core', 'Peso corporal', 'Contraia gluteos e abdomen, mantendo cabeca, tronco e quadril alinhados.', array['prancha'], true),
  ('Abdominal crunch', 'Core', 'Peso corporal', 'Aproxime costelas e pelve sem puxar a cabeca e retorne de forma controlada.', array['abdominal'], true)
on conflict (name) do update
set
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  instructions = excluded.instructions,
  aliases = excluded.aliases,
  active = true,
  updated_at = now();

-- Exemplo para vincular video depois de subir no Storage:
-- update public.exercise_library
-- set video_url = 'https://SEU-PROJETO.supabase.co/storage/v1/object/public/exercise-library-videos/supino-reto.mp4'
-- where name = 'Supino reto com barra';

