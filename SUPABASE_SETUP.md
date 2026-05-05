# Supabase Setup For PaidSoon

Use this when you are ready to connect real login and database.

## 1. Create project

1. Go to `https://supabase.com`
2. Create a free account
3. Create a new project called `paidsoon`
4. Save your database password somewhere safe

## 2. Create tables

In Supabase:

1. Open your project
2. Go to **SQL Editor**
3. Copy the contents of `supabase-schema.sql`
4. Run it

## 3. Add keys to the app

In Supabase:

1. Go to **Project Settings**
2. Open **API**
3. Copy:
   - Project URL
   - anon public key

In this project:

1. Copy `.env.local.example`
2. Rename the copy to `.env.local`
3. Fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 4. Restart the app

Stop the dev server with `Ctrl + C`, then run:

```bash
npm run dev
```

## Current status

The app currently uses browser local storage. Supabase connection is prepared, but the pages still need to be switched from local state to database queries.
