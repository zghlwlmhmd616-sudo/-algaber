# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Supabase Production Setup

The storefront uses Supabase for persistent products, orders, reviews, settings, administrator authentication, and image storage.

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) once in the project's SQL Editor.
3. Create the administrator under **Authentication > Users** and disable public sign-ups in Auth settings.
4. Add that user to the admin allowlist in SQL Editor, replacing the email:

  ```sql
  insert into public.admin_users (user_id)
  select id from auth.users where email = 'ADMIN_EMAIL'
  on conflict (user_id) do nothing;
  ```

5. Copy `.env.example` to `.env.local` and set the Supabase Project URL and Publishable key. Never use the `service_role` key in frontend code.
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your hosting provider's build environment before deployment.

## Publish with GitHub Pages

Create a GitHub repository and push the project to its `main` branch. In **Settings > Secrets and variables > Actions > Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The workflow at `.github/workflows/deploy-pages.yml` enables Pages and deploys on each push to `main`. The site URL will be `https://OWNER.github.io/REPOSITORY/`.

Demo products and reviews are not copied into production automatically. Add real products through the admin dashboard after setup. Vodafone Cash deposits are recorded for manual verification; no online payment gateway is connected.
