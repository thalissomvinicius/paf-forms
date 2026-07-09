# PAF Agricultura Familiar

MVP local para validar o fluxo de coleta em campo e o dashboard administrativo.

## Rodar localmente

```bash
npm install
npm run dev:host -- --port 5190 --strictPort
```

URLs:

- Local: `http://localhost:5190/`
- Rede: use o IP exibido pelo Vite, por exemplo `http://192.168.0.113:5190/`

## Acessos de demonstracao

- Coletor: usuario `ana`
- Admin: usuario `admin`
- Senha demo: `demo123`

Tambem existem botoes rapidos na tela de login para entrar como coletor ou admin.

## Entregue nesta versao

- Login por usuario e senha, com separacao simples entre coletor e admin.
- App de coleta com experiencia mobile, tela inicial, navegacao inferior, rascunho local, finalizacao, GPS, foto e simulacao de sincronizacao.
- Dashboard administrativo com filtros, indicadores, grafico, mapa, tabela e exportacao CSV/PDF.
- Area administrativa para controlar usuarios do app e do dashboard, ativar/inativar perfis e gerar senha temporaria.
- Dados ficticios para comunidades, coletores, formularios, fotos e stakeholders.
- Paleta visual baseada na logo PAF.
- Supabase preparado com tabelas, RLS, bucket privado de fotos e seed inicial.

## Supabase

Projeto usado: `paf-vna`

URL:

```bash
https://auisvfbloziehspzpnvg.supabase.co
```

Crie um `.env.local` a partir do `.env.example`:

```bash
VITE_SUPABASE_URL=https://auisvfbloziehspzpnvg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_publishable_ou_anon
VITE_SUPABASE_PHOTOS_BUCKET=form-photos
```

O app e o dashboard usam apenas a chave publica. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend, no GitHub ou em variaveis `VITE_`.

O login continua sendo por usuario e senha. Internamente, o Supabase Auth usa emails tecnicos:

- `ana@paf.local`
- `carlos@paf.local`
- `marina@paf.local`
- `admin@paf.local`

Depois de criar cada usuario no Supabase Auth, vincule o ID do Auth em `public.profiles.auth_user_id` para o username correspondente. A RLS usa esse vinculo para separar:

- coletor: ve e sincroniza apenas as proprias coletas;
- admin: ve dashboard, perfis, fotos e todas as coletas.

## Proximas etapas

- Criar os usuarios reais no Supabase Auth.
- Vincular `auth_user_id` em `profiles`.
- Preencher `.env.local` e variaveis da Vercel.
- Criar Edge Function para criacao/reset de senha pelo dashboard.
- Publicar preview e depois producao.
