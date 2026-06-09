# comments.fullstackjam.com

A tiny Cloudflare Worker backing a GitHub-Issues–based comment system. It proxies
GitHub OAuth login and the GitHub Issues API so a static site can read and post
comments without exposing the OAuth client secret to the browser.

Based on [EAimTY/comments.eaimty.com](https://github.com/EAimTY/comments.eaimty.com).

## Endpoints

| Method | Path        | Purpose                                                        |
|--------|-------------|----------------------------------------------------------------|
| GET    | `/login`    | Start GitHub OAuth (`?redirect_uri=…`) / exchange `?code=…` for a token |
| GET    | `/userinfo` | Fetch the authenticated user (`?github_access_token=…`)        |
| GET    | `/comments` | List comments for an issue (`?issue_id=…`, optional token)     |
| POST   | `/comments` | Post a comment to an issue (`?issue_id=…&github_access_token=…`)|

## Configuration

| Name                        | Type      | Where it's set                          |
|-----------------------------|-----------|-----------------------------------------|
| `GITHUB_APP_CLIENT_ID`      | Plaintext | `wrangler.toml` → `[vars]` (public)     |
| `REPO`                      | Plaintext | `wrangler.toml` → `[vars]` (e.g. `owner/repo`) |
| `GITHUB_APP_CLIENT_SECRET`  | Secret    | GitHub Actions secret `GH_APP_CLIENT_SECRET`, pushed on deploy |

The OAuth credentials live in the 1Password **Dev** vault as
`GitHub OAuth App - comments`.

## Deployment

Deployment is automated via GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
every push to `master` runs `cloudflare/wrangler-action@v4`, which deploys the
Worker (carrying the plaintext `[vars]`) and pushes `GITHUB_APP_CLIENT_SECRET`.

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — token with *Workers Scripts: Edit*
- `CLOUDFLARE_ACCOUNT_ID`
- `GH_APP_CLIENT_SECRET` — the GitHub OAuth App client secret

> Note: plaintext `[vars]` in `wrangler.toml` are the source of truth — a deploy
> overwrites any plaintext variables set only in the dashboard. Secrets are
> preserved across deploys.

### Manual deploy (fallback)

```bash
npm install
npx wrangler login
npx wrangler deploy
```

The custom domain is configured under the Worker's **Domains** tab in the
Cloudflare dashboard.
