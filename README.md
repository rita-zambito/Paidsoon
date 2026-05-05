# PaidSoon Next.js

PaidSoon is a SaaS-style web app for UK freelancers and small businesses who need to chase unpaid invoices.

Promise: **Get paid faster without awkward chasing.**

## What this version includes

- Next.js app structure
- TypeScript
- Dashboard
- Invoice tracker
- Customer list
- Message generator
- AI message generation through a server-side Gemini/OpenAI API route
- Placeholder Supabase client for the future database/login step
- Example Supabase database schema

## How to run

You need Node.js with npm installed.

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## If npm is missing

Install the normal Node.js LTS version from:

```text
https://nodejs.org
```

During install, keep the option that adds Node/npm to PATH enabled.

## Next steps

1. Connect Supabase for login and database.
2. Save invoices and customers per user.
3. Add email sending.
4. Add Stripe subscriptions.

## AI setup

PaidSoon uses Gemini first because it has a useful free tier for prototypes. OpenAI remains available as an optional fallback.

To enable Gemini AI message generation:

1. Create a Gemini API key in Google AI Studio.
2. Add it to `.env.local` as `GEMINI_API_KEY`.

Optional OpenAI fallback:

1. Create an OpenAI API key in the OpenAI platform dashboard.
2. Add it to `.env.local` as `OPENAI_API_KEY`.

After changing env values, restart the dev server with `Ctrl + C`, then:

```bash
npm run dev
```

AI keys are used only by the server route at `app/api/generate-message/route.ts`; they are not exposed to the browser.

See `SUPABASE_SETUP.md` when you are ready to create the database project.

## Important

Right now this version saves data in your browser using local storage. It is useful for testing the product flow, but the production version needs Supabase login and database.
