# MarketMatch

Find a phone in a busy electronics plaza (like Hafeez Centre) without walking 50 shops.

- **Buyers** post what they want (model, storage, colour, PTA, condition, battery, budget).
- **Shops** in that plaza get an alert and reply with a price and a **live photo**.
- The buyer compares offers, taps **"I'm going"**, and the shop **holds the phone for 20 minutes**.
- The buyer gets **floor, shop number, landmark and step-by-step directions**, scans the shop's **QR code** at the counter, and checks the phone with a built-in checklist before paying.
- Only QR-confirmed visits can leave a **review**, so ratings can't be faked.

Built with **Expo (React Native)** + **Supabase** (Postgres, phone login, realtime, storage, edge functions).

---

## What you need

| Tool | Why | Link |
|---|---|---|
| Node.js 20 or newer | runs the project | https://nodejs.org |
| Git | get the code | https://git-scm.com |
| A Supabase account (free) | database, login, photos | https://supabase.com |
| An Expo account (free) | builds and push notifications | https://expo.dev/signup |
| An Android phone with **Expo Go** | try the app | Play Store → "Expo Go" |

---

## 1. Get the code

```bash
git clone https://github.com/<your-username>/<your-repo>.git marketmatch
cd marketmatch
npm install
```

## 2. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**. Pick the region closest to Pakistan (e.g. **Mumbai** or **Singapore**). Save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**.
3. Paste everything from [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql) and press **Run**.
   - If you get an error about `pg_cron`, go to **Database → Extensions**, turn on **pg_cron**, then run the file again in a fresh project (or just run the last two lines).
4. New query → paste [`supabase/seed.sql`](supabase/seed.sql) → **Run**. This adds Hafeez Centre and a starter list of phone models.

## 3. Turn on phone-number login

1. **Authentication → Sign In / Providers → Phone** → enable it.
2. **For testing (free, no SMS):** in the same Phone settings, add **test phone numbers** with a fixed code, for example:
   - `923001111111` → code `123456` (buyer)
   - `923002222222` → code `123456` (shopkeeper)

   In the app, type `0300 1111111`, then the code `123456`.
3. **For real users:** connect an SMS provider in the same screen (Twilio, Vonage, MessageBird or Textlocal). This costs money per SMS.

## 4. Connect the app to Supabase

```bash
cp .env.example .env
```

Open `.env` and paste your values from **Project Settings → API** (Project URL and the `anon` / publishable key):

```
EXPO_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> The anon key is safe to ship in the app. **Never** put the `service_role` key in the app.

## 5. Run it

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone. You can now:

1. Sign in as the shopkeeper test number → choose **"I own a phone shop"** → fill in shop details → **My stock** → add a phone.
2. On a second phone (or after signing out), sign in as the buyer → post a request for the same phone.
3. The shop sees it live under **Matches my stock** → **I have it** → price + live photo → **Send offer**.
4. The buyer sees the offer appear live → opens it → **I'm going** → the shop sees **A buyer is on the way** with its QR code.
5. The buyer taps **Scan its QR** → scans the shop's screen → visit confirmed → the checklist → **I bought it** → rates the shop.

Everything works in Expo Go **except push notifications** (Expo Go on Android no longer supports them). The live screens still update in real time while the app is open.

---

## 6. Push notifications (alerts when the app is closed)

Push needs a **development build** instead of Expo Go, plus a small server function.

### a) Link the app to Expo and make a development build

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # adds your EAS project id to app.json
npx eas-cli@latest build --profile development --platform android
```

When the build finishes, open the link on your Android phone and install the APK. Then run `npx expo start` and open the project in that app instead of Expo Go.

For Android push you also need Firebase credentials in EAS. Follow Expo's guide: https://docs.expo.dev/push-notifications/fcm-credentials/

### b) Deploy the `notify` function

Install the Supabase CLI (https://supabase.com/docs/guides/cli), then:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set WEBHOOK_SECRET=<make-up-a-long-random-string>
npx supabase functions deploy notify --no-verify-jwt
```

### c) Create three Database Webhooks

In the dashboard: **Database → Webhooks → Create a new hook**. Make three hooks with these settings:

| Name | Table | Events | Type | URL |
|---|---|---|---|---|
| `new-request` | `requests` | Insert | HTTP Request, POST | `https://<ref>.supabase.co/functions/v1/notify` |
| `new-offer` | `offers` | Insert | HTTP Request, POST | same |
| `offer-accepted` | `offers` | Update | HTTP Request, POST | same |

For each one, add an **HTTP header**: `x-webhook-secret` = the same string you used above.

Now:
- a new request alerts every **online** shop in that plaza ("Buyer wants a phone you have" if it's in their stock),
- a new offer alerts the buyer,
- an accepted offer tells the shop "A buyer is on the way".

Tapping a notification opens the right screen.

---

## 7. Share a test app (APK)

```bash
npx eas-cli@latest build --profile preview --platform android
```

Send the download link to the shopkeepers you're testing with. No Play Store needed.

---

## Running the app day to day

| Task | Where |
|---|---|
| Add another plaza | Supabase → **Table Editor → markets** → insert row |
| Add phone models | **Table Editor → device_models** (storage in GB, `1024` = 1TB) |
| Give a shop the blue verified badge | **Table Editor → shops** → set `is_verified` to `true` |
| See all requests / offers / visits | **Table Editor** → `requests`, `offers`, `visits` |

---

## How it's built

```
src/
  app/                    ← every file is a screen (Expo Router)
    sign-in.tsx, verify.tsx, onboarding.tsx
    buyer/
      index.tsx           home: search, brands, active requests, phone on hold
      new-request.tsx     pick model → storage, colour, PTA, condition, battery, budget
      request/[id].tsx    live offers, sort by price / rating / nearest
      offer/[id].tsx      offer details, directions, call/WhatsApp, "I'm going"
      visit/[id].tsx      hold timer, scan QR, checklist, bought / didn't buy, review
      scan/[id].tsx       camera QR scanner
    shop/
      index.tsx           live requests, "matches my stock", online switch, buyers coming
      setup.tsx           shop name, floor, shop no., landmark, directions, phone
      stock.tsx           saved phones = 1-tap reply templates
      reply/[id].tsx      price, condition, battery, PTA, live photo → send offer
      visit/[id].tsx      buyer on the way, shop QR, mark sold / no sale
  components/ui.tsx       buttons, chips, cards, countdown, icons (the design system)
  lib/                    Supabase client, login state, push, photo upload, formatting
supabase/
  migrations/0001_schema.sql   tables, security rules, server actions, realtime, storage
  seed.sql                     Hafeez Centre + phone catalogue
  functions/notify/            push notifications
  tests/flow.test.js           end-to-end database test (35 checks)
```

### Security, in plain words

Security is enforced **in the database** (Row Level Security), not just in the app:

- Buyers only see their own requests; shops only see requests in their own plaza.
- A shop's stock is private. Only the buyer and that shop can see an offer.
- A shop can't accept its own offer, verify itself, or change its rating.
- The QR secret can't be read by buyers, so a visit can only be confirmed by actually standing at the counter.
- Reviews are only allowed after a QR-confirmed visit, one per visit.
- Photos can only be uploaded into the shop's own folder, and must be taken live with the camera.

### Checks

```bash
npm run typecheck   # TypeScript
npm run test:db     # runs the full buyer ↔ shop flow against the schema (35 checks)
```

---

## Ideas for the next version

- Price bidding / counter-offers
- Urdu language toggle
- Shop analytics (what people searched for, lost bids)
- Paid plans for shops (unlimited replies, featured placement)
- IMEI check integration and "Verified Genuine Retailer" badge rules
