# PAF Agricultura Familiar

MVP local para validar o fluxo de coleta em campo e o dashboard administrativo.

## Rodar localmente

```bash
npm install
npm run dev:host -- --port 5190 --strictPort
```

URLs:

- Local: `http://localhost:5190/`
- Rede: `http://172.16.2.177:5190/`

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

## Proximas etapas

- Criar projeto Supabase.
- Implementar Auth real e tabela `profiles`.
- Criar schema Postgres com RLS.
- Migrar mocks para queries Supabase.
- Criar bucket de fotos no Supabase Storage.
- Configurar variaveis de ambiente na Vercel.
- Publicar preview e depois producao.
