# BG’s Christmas Party 2026

Saturday 19 December 2026, 1 pm AEDT (Melbourne time).

These are the website files for https://github.com/BeeGee-source/christmas-party-2026.
They use the Supabase table, policies and functions already created during setup.
No npm install, paid service or build process is required.

## Your next step: upload the website files

1. Extract the downloaded ZIP on your Windows computer (right-click → Extract All).
2. Open your GitHub repository and choose **Add file → Upload files**.
3. Select the files INSIDE the extracted folder and drag them into GitHub.
4. Check that `index.html`, `admin.html`, `styles.css`, `config.js`, `api.js`,
   `ui.js`, `guest.js`, `admin.js` and `favicon.svg` appear at the repository root.
   `START-HERE.md` can be uploaded too. Do not upload the ZIP itself.
5. Enter `Add Christmas party website` as the commit message and commit to `main`.

Your existing README.md can remain. This package does not replace it.

## Publishing (the next guided step)

1. In the repository, open Settings → Pages.
2. Under Build and deployment, choose Deploy from a branch.
3. Select `main` and `/ (root)`, then Save.
4. Wait for GitHub to finish the deployment and use its displayed Visit site link.
5. The expected address is https://beegee-source.github.io/christmas-party-2026/.
   The host page is `admin.html` under that address.

Nothing in this download has been published automatically.

## Files

- `index.html`: guest page with RSVP form and potluck list.
- `admin.html`: host sign-in page and dashboard.
- `config.js`: public Supabase URL/key and event text.
- `api.js`: requests to the existing Supabase functions and host authentication.
- `ui.js`: shared form and display helpers.
- `guest.js`: submissions, private editing links and potluck filtering.
- `admin.js`: totals, host edits, removals and CSV export.
- `styles.css`: responsive page design.
- `favicon.svg`: browser tab icon.

The `NEXT_PUBLIC_` names from Supabase's example were only names for its sample
Next.js project. This plain JavaScript site uses the same values in `config.js`.
The publishable key is intended to be visible in browser code. Never replace it
with a secret key, service-role key, database password or host password.

## What connects to what

The guest page calls these exact functions:

- `submit_rsvp(p_household_name, p_attendance, p_adults, p_children,
  p_food_category, p_bringing, p_quantity, p_dietary_requirements)`
- `get_rsvp_for_edit(p_edit_token)`
- `update_rsvp(p_edit_token, p_household_name, p_attendance, p_adults,
  p_children, p_food_category, p_bringing, p_quantity, p_dietary_requirements)`
- `get_potluck_list()`

The host signs in with the separate email/password account created in Supabase
Authentication. The host dashboard reads and updates `public.rsvps` with that
user's access token. The UID-based policy in the database controls permission.
The host dashboard never requests the `edit_token_hash` column.

## Before sharing invitations: live check

The website was checked locally with simulated API responses. The build
environment could not reach the live Supabase project, so these checks remain:

1. Open the published guest site in a private/incognito window.
2. Submit `TEST Household`, Yes, 2 adults and 1 child, bringing a dessert.
3. Copy or download the private editing link immediately.
4. Check that the confirmed household appears on the potluck list.
5. Open the editing link in a DIFFERENT private window. Change the dish, save,
   and refresh the potluck. Check the change appears only once.
6. Change attendance to No. The household should leave the public list.
7. Sign in at `admin.html` with your host account. The declined household should
   still appear; confirmed headcounts should exclude it.
8. Edit the test RSVP from the host dashboard and check the updated totals.
9. Download the CSV and check the contents. CSV export includes all responses,
   regardless of the active search/filter, and includes private dietary notes.
10. Remove the test RSVP with the dashboard's Remove button. Its old edit link
    should then be rejected. Sign out before leaving a shared computer.

The dashboard and potluck refresh when opened or when you press Refresh; they
are not realtime subscriptions. Guest saves also refresh the local potluck.

## Editing party details

The location is marked “Location details coming soon” because no location was
provided. Update `location` in `config.js` when ready. A location entered there
will be public, like the rest of the website's code. You can instead share the
address privately with your invitees and set the location text accordingly.

Party date/time wording currently appears in `index.html`, `admin.html` and
the edit-link download text in `guest.js`. If the event changes, update those
as well as `config.js`. There is no automatic RSVP deadline configured.

## Using the site

- One RSVP represents one household. The form allows 0–50 adults and 0–50 kids.
- Food category describes the main contribution; the Bringing field can list
  more than one dish. Food totals count households, not individual dishes.
- Confirmed names and food contributions are readable without login.
- Dietary details are accessible by the host and by anyone holding that
  household's private edit link. Keep editing links private.
- Editing links put the code after `#edit=` so the browser does not send it to
  GitHub when requesting the page. The code is sent to Supabase to verify edits.
- The current tab remembers its edit code. There is no email delivery or
  recovery service. Guests should copy/download their link after submitting.
- A guest who loses the link can ask the host to make changes in the dashboard.
- Host access and refresh tokens stay in this tab's session storage. Explicitly
  sign out when finished. Passwords are sent to Supabase only for sign-in and
  are never saved by this code.
- Guest input is displayed as text. CSV text fields that could be treated as
  formulas are prefixed with an apostrophe for safer spreadsheet opening.

## Current limitations and event maintenance

- There is no invitation-code gate, CAPTCHA or custom per-visitor submission
  rate limit. Anyone with the site/API details can submit. Share with your
  invitees and check for unwanted responses before the event.
- Duplicate household names and duplicate dishes are allowed. The Submit
  button prevents repeated clicks while waiting, but the backend has no
  idempotency mechanism: a manual retry after an uncertain network failure can
  create another response. The UI warns about that case. The host can remove
  duplicates. There are no automatic reminders or email notifications.
- New Supabase sign-ups must stay disabled and the host UID policy must match
  your host account. The app does not assign host privileges itself.
- Supabase Free can pause after low activity. Check its dashboard and restore
  the project if needed before testing/sharing, and check again near the event.
- Download a CSV backup periodically. Keep it private because it contains
  dietary information. Storing the website on GitHub does not back up RSVPs.

## If something does not load

- A completely unstyled page: ensure styles.css is next to index.html.
- A disabled form: ensure every .js file is uploaded and use the hosted HTTPS
  site; don't double-click index.html as a file on your computer.
- Potluck or RSVP errors: check Supabase is active and all four functions exist.
- A host sign-in error: use the WEBSITE host password, not your GitHub login or
  database password. Check the user was auto-confirmed and Email is enabled.
- Empty host dashboard despite existing data: check the UID in the host policy.
- Permissions errors: keep RLS enabled; check the grants and policies from our
  setup instead of exposing the full table publicly.

## Reference documentation

https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/platform/free-project-pausing
