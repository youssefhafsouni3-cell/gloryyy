# Glory Aures — Fix Notes

## ⚠️ Do this first — rotate your credentials

Your original `prisma/.env` (Postgres connection string + Gmail password in plaintext)
was included in the uploaded zip and is treated as compromised. It has been
**removed from this delivered package**. Before you deploy:

1. Rotate your Render Postgres password (or create a fresh database).
2. Create a new Gmail **App Password** for `EMAIL_USER` (don't use your normal
   Gmail password — Gmail will reject it for SMTP in most cases, which was
   likely part of why sign-up emails were failing).
3. Create a new local `prisma/.env` with:
   ```
   DATABASE_URL="postgresql://..."
   EMAIL_USER=your-address@gmail.com
   EMAIL_PASS=your-16-char-app-password
   ```
4. In Render's dashboard, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`
   as environment variables (they're declared `sync: false` in `render.yaml`,
   meaning Render won't set them for you).

## Root causes found & fixed

| Symptom you reported | Root cause | Fix |
|---|---|---|
| Admin login unreliable | `render.yaml` build step ran `prisma db push` but **never ran `seed.js`**, so the admin account was never (re)created on a fresh/redeployed DB | Build command now runs the seed script after every deploy |
| Can't click posts/categories/catalogs after leaving admin | `Catalogue` had no `posts` relation in the schema, but the frontend called `catalogue.posts.forEach(...)` / `cat.posts.length` on the exact screen you land on after leaving admin — this threw an uncaught error mid-render, so the rest of the page (including category tiles) never got its click handlers | Added `Post.catalogueId` relation end-to-end (schema, backend routes, frontend payloads) so catalogue objects now actually carry their `posts` array |
| Sign-up completely stopped working | Pending registrations were kept in an in-memory `Map`, wiped whenever Render's free-tier server cold-starts/restarts between "send code" and "verify code" | Moved to a persisted `PendingRegistration` table |
| Order/demand status doesn't update | There was no `PATCH /api/orders/:id` route — the "Accept/Refuse" buttons only mutated a local JS array that was never sent to the server | Added `PATCH /api/orders/:id` (and `DELETE`) and wired the buttons to it |
| Orders/catalogues missing after refresh | `loadData()` only ever fetched categories | Now fetches categories, catalogues, and orders |
| Category/catalogue/product edits silently fail | Frontend called `PUT /api/categories/:id`, catalogue edits, and product edits that had **no matching backend route** | Added `PUT` routes for categories, catalogues, and posts |
| Product descriptions always blank | Frontend read/wrote `post.content`; backend column is `description` | Standardized on `description` everywhere |
| Switching FR/EN/AR does nothing visually | `changeLanguage()` updated the language variable but never re-rendered the page | Now calls `renderApp()` immediately |
| Logout | Worked, but with no confirmation | Added a confirmation modal ("Are you sure you want to log out?" → Confirm / Cancel); session is now only cleared on confirm |
| Create-account UX | No countdown, generic messages | Added a live 1-minute countdown before "resend code" is enabled, "Account created successfully" on success, "We already have an account with this email" on duplicate email, plus server + client email/password validation |

## Files changed
- `prisma/schema.prisma` — added `Post.catalogueId`/`catalogue` relation, made `Post.categoryId` optional, added `PendingRegistration` model
- `prisma/server.js` — persisted pending registrations, added `PUT` for categories/catalogues/posts, `PATCH`/`DELETE` for orders, `DELETE` for catalogues, validation, consistent `description` field, catalogue `posts` include
- `render.yaml` — build command now seeds the admin user
- `script.js` — `loadData()` fetches catalogues/orders, fixed `content`→`description`, wired edit/delete calls to real endpoints, added countdown timer, logout confirmation flow, fixed language switching, client-side validation
- `index.html` — added logout confirmation modal, countdown display + resend button id

## After deploying
Run once (or let the build step do it): `node prisma/seed.js` to create/update the
admin account, using whatever `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in Render.
