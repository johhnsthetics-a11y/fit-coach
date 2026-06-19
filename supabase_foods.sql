create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  sodium numeric default 0,
  base_portion_grams numeric default 100,
  created_at timestamptz default now()
);

create unique index if not exists foods_name_category_unique
on foods (lower(name), lower(category));

alter table foods enable row level security;

drop policy if exists "authenticated can read foods" on foods;

create policy "authenticated can read foods"
on foods for select
to anon, authenticated
using (true);

insert into foods
(name, category, calories, protein, carbs, fat, fiber, sodium)
values
('Ovo Inteiro','Ovos',155,13,1.1,11,0,124),
('Clara de Ovo','Ovos',52,11,0.7,0.2,0,166),
('Gema de Ovo','Ovos',322,16,3.6,27,0,48),
('Leite Integral','Laticínios',61,3.2,4.8,3.3,0,43),
('Leite Desnatado','Laticínios',34,3.4,5,0.1,0,44),
('Iogurte Natural','Laticínios',59,3.5,4.7,3.3,0,36),
('Queijo Cottage','Laticínios',98,11.1,3.4,4.3,0,364),
('Queijo Mussarela','Laticínios',280,28,3,17,0,627),
('Peito de Frango','Carnes',165,31,0,3.6,0,74),
('Peito de Peru','Carnes',135,29,0,1,0,55),
('Filé Mignon','Carnes',220,26,0,12,0,62),
('Coxão Mole','Carnes',219,29,0,8,0,58),
('Atum','Peixes',132,28,0,1,0,37),
('Sardinha','Peixes',208,25,0,11,0,307),
('Camarão','Frutos do Mar',99,24,0.2,0.3,0,111),
('Arroz Branco','Carboidratos',130,2.7,28,0.3,0.4,1),
('Batata Doce','Carboidratos',86,1.6,20,0.1,3,55),
('Macarrão Cozido','Carboidratos',158,5.8,31,0.9,1.8,1),
('Pão Francês','Carboidratos',300,8,58,3,2,648),
('Tapioca','Carboidratos',358,0.2,88,0,0.9,1),
('Cuscuz','Carboidratos',112,3.8,23,0.2,1.7,2),
('Feijão Preto','Leguminosas',132,8.9,24,0.5,8.7,1),
('Feijão Carioca','Leguminosas',127,8.7,22.8,0.5,8.5,2),
('Lentilha','Leguminosas',116,9,20,0.4,8,2),
('Grão de Bico','Leguminosas',164,8.9,27.4,2.6,7.6,7),
('Banana','Frutas',89,1.1,23,0.3,2.6,1),
('Maçã','Frutas',52,0.3,14,0.2,2.4,1),
('Morango','Frutas',32,0.7,7.7,0.3,2,1),
('Mamão','Frutas',43,0.5,11,0.3,1.7,8),
('Abacate','Frutas',160,2,9,15,7,7),
('Cenoura','Vegetais',41,0.9,10,0.2,2.8,69),
('Beterraba','Vegetais',43,1.6,10,0.2,2.8,78),
('Pepino','Vegetais',15,0.7,3.6,0.1,0.5,2),
('Abobrinha','Vegetais',17,1.2,3.1,0.3,1,8),
('Azeite de Oliva','Gorduras',884,0,0,100,0,2),
('Manteiga','Gorduras',717,0.8,0.1,81,0,11),
('Castanha de Caju','Oleaginosas',553,18,30,44,3.3,12),
('Nozes','Oleaginosas',654,15,14,65,6.7,2),
('Creatina','Suplementos',0,0,0,0,0,0),
('Maltodextrina','Suplementos',380,0,95,0,0,10),
('Dextrose','Suplementos',400,0,100,0,0,0),
('Hipercalórico','Suplementos',390,25,60,5,2,120)
on conflict do nothing;
