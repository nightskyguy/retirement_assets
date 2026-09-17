# Feedback Worker

The Cloudflare Worker behind the **✉ Feedback** button in `retirement_optimizer.html`. It checks each
message and emails it to the site owner. The recipient address exists only in this Worker's secrets:
it is not in the page, not in this folder and not anywhere else in the repo.

The folder name starts with a dot so GitHub Pages does not publish it. The repo is public, so nothing
secret may be committed here.

| file | what it is |
|---|---|
| `src/logic.cjs` | every check, the daily count and the email itself; covered by `feedback.tests.js` in the repo root |
| `src/index.js` | the Cloudflare entry point: the `DailyCounter` Durable Object, and a few lines that pass in the mail binding, `fetch` and a clock |
| `wrangler.jsonc` | name, route, bindings, the rate limit and the allowed page origins |
| `local-server.cjs` | the same `handle()` under plain node, for testing the page with nothing installed |
| `.dev.vars.example` | test values for running it locally |

## What it accepts

A `POST` of JSON from `https://tools.netcitizen.us` (and from `localhost` while `ALLOW_LOCALHOST` is
`"1"`), carrying a Turnstile token that Cloudflare confirms. Everything else is refused, in this order:

| reply | when |
|---|---|
| 403 `origin` | the page is not one of ours |
| 405 `method` | anything but `POST` (and `OPTIONS` for the browser's preflight) |
| 415 `type` | the body is not `application/json` |
| 413 `size` | the request is over 1.6 MB |
| 500 `config` | a secret or binding is missing; nothing is sent |
| 429 `rate` | more than 3 messages a minute from one address |
| 400 `json` / field name | the body is not valid JSON, or a field breaks a rule in `validatePayload` |
| 403 `bot` | no Turnstile token, or Cloudflare did not confirm it |
| 429 `daily` | `DAILY_LIMIT` messages have already been sent today (UTC); the page then points to GitHub |
| 503 `busy` | the day's counter could not be reached; nothing is sent |
| 502 `verify` / `send` | Cloudflare could not be reached, or would not send the mail |

Replies never repeat anything from the request, and the Worker keeps no logs.

## What stops a flood

Nothing in the page is secret, and nothing needs to be. Anyone can read `feedback.js` and find the
Worker's address and the Turnstile **site key**, but neither lets them send anything:

1. **Every message needs a fresh Turnstile token.** Cloudflare issues one only after its bot check
   passes in a real browser on an allowed hostname. A token works once and expires after five
   minutes, and the Worker has Cloudflare confirm each one with the **secret key**, which exists only
   in this Worker's secrets.
2. **Three messages a minute** from any one address.
3. **`DAILY_LIMIT` messages a day in total** (50), counted exactly by a Durable Object. However a
   flood is paid for, it ends there, and until midnight UTC the page sends people to GitHub.
4. **One fixed recipient.** The address comes from a secret, never from the request, so the Worker
   cannot be used to mail anyone else.

The worst case is therefore `DAILY_LIMIT` unwanted messages in a day. A mail filter on the subject
prefix `[Feedback]` keeps even those out of the way.

## One-time setup

You need the Cloudflare account that holds `netcitizen.us`.

1. **Check the destination inbox.** Dashboard, **Email**, **Email Routing**, **Destination
   addresses**. The inbox the help address forwards to must show **Verified**. A Worker can send only
   to a verified destination, not to a routing address such as the help address itself.
2. **Create the Turnstile widget.** Dashboard, **Turnstile**, **Add widget**. Hostnames:
   `tools.netcitizen.us`, `localhost`, `127.0.0.1`. Mode: **Managed**. Copy both keys.
   - The **site key** is public. Put it in `SITE_KEY` near the top of `feedback.js`.
   - The **secret key** is not. It goes in step 3 and nowhere else.
3. **Store the three secrets.** From this folder:

   ```sh
   npx wrangler login
   npx wrangler secret put FEEDBACK_TO
   npx wrangler secret put FEEDBACK_FROM
   npx wrangler secret put TURNSTILE_SECRET
   ```

   - `FEEDBACK_TO` is the verified inbox from step 1.
   - `FEEDBACK_FROM` must be an address on a domain with Email Routing turned on, for example
     `feedback@tools.netcitizen.us`. It does not need a routing rule of its own.
   - `TURNSTILE_SECRET` is the secret key from step 2.
4. **Deploy.**

   ```sh
   npx wrangler deploy
   ```

   The first deploy creates `feedback.netcitizen.us`, with its DNS record and certificate, and the
   `DailyCounter` Durable Object that keeps the day's count. Wrangler 4.36 or later is needed for the
   rate-limit binding; `npx` fetches a current one. To change the daily limit, edit `DAILY_LIMIT` in
   `wrangler.jsonc` and deploy again.

Publish the page change only after this works. Until then the button reports that sending failed.

## Testing

**Every commit** runs `feedback.tests.js`, which drives `handle()` with stand-ins for the mail
binding, the rate limiter and Turnstile, so each refusal above is checked without Cloudflare.

**Locally, with nothing installed.** From the repo root:

```sh
node .feedback-worker/local-server.cjs
```

Serve the page from `localhost` and open it with `?fbdev` added to the address. The dialog then posts
to `http://localhost:8787/` and uses Cloudflare's always-pass Turnstile test key. The local server runs
the Worker's own `handle()`, confirms the test token with Cloudflare, applies the same rate limit, and
instead of sending mail writes each message to `.feedback-worker/.outbox/` as an `.eml` file that any
mail program opens. It reads `.dev.vars` if you create one from `.dev.vars.example`; a
`DAILY_LIMIT` environment variable overrides the daily limit, so `DAILY_LIMIT=2` shows the "full for
today" message after two sends. `?fbdev` does nothing on a page that is not served from `localhost`
or `127.0.0.1`.

**Locally, on Cloudflare's own runtime**, if you want the real bindings rather than stand-ins:

```sh
cp .dev.vars.example .dev.vars
npx wrangler dev --port 8787
```

`wrangler dev` simulates the mail binding and does not deliver mail.

**After a deploy**, send one message from the live page with a screenshot and a reply address. Check
that it arrives with the attachment, and that replying goes to the address you typed.

Mail sent by a Worker shows as "dropped" in the Email Routing activity summary even when it was
delivered. That is a known quirk of the summary, not a failure.
