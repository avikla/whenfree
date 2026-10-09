---
name: deploy-functions
description: Deploy WhenFree's Firebase Cloud Functions (sendMail, storeCreatorEmail, notifyOrganizer, dailyReport) from functions/ via gcloud. Use when functions/index.js or functions/package.json changes, or when the user asks to deploy, redeploy, or verify the Cloud Functions.
---

# Deploy WhenFree Cloud Functions

All four functions share one source file, `functions/index.js`. Any change to that file requires redeploying **all four**, not just the one you are touching. Deploys use `gcloud` directly. This project has no Firebase CLI configuration.

## Before deploying

1. **Confirm with the user.** A deploy goes live immediately and affects production mail. Show the list of functions to deploy and wait for an explicit yes. Do not deploy as part of a larger task unless the user has asked for it in that task.
2. **Run the tests.** From `functions/`, run `npm test`. Stop if anything fails.
3. **Check the diff.** `git diff -- functions/` should contain only the intended changes. Confirm `functions/node_modules/` is not staged. It is ignored by `.gitignore`.
4. **Do not paste secret values.** Secrets are bound from Secret Manager with `--set-secrets` (names only). Never echo, print, or write the value of `zepto-api-key`, `whenfree-mail-key`, or `healthcheck-ping-url`.

## Deploy commands

Run from the repo root in PowerShell. Each deploy triggers a Cloud Build that runs `npm install` from `functions/package.json` automatically.

```powershell
gcloud functions deploy sendMail --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=sendMail `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy storeCreatorEmail --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=storeCreatorEmail `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy notifyOrganizer --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=notifyOrganizer `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy dailyReport --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --no-allow-unauthenticated --source=functions/ --entry-point=dailyReport `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,HEALTHCHECK_PING_URL=healthcheck-ping-url:latest' `
  --max-instances=2 --project=meteor-meet
```

Notes on the flags:

- `sendMail`, `storeCreatorEmail`, and `notifyOrganizer` use `--allow-unauthenticated` because browsers call them directly. Their `X-WhenFree-Key` header check is the real gate.
- `dailyReport` uses `--no-allow-unauthenticated`. Its only caller is Cloud Scheduler, so IAM/OIDC is the gate. Do not switch it to public.
- All four run as the default compute service account. Do not add IAM bindings without asking.

## Verify after deploying

Check that each function responds. The isolated check below expects `403 forbidden`. That proves the header gate and the Firestore lookup work without touching real data. Ask the user for the `WHENFREE_MAIL_KEY` value at run time. Do not store it in the skill or the transcript.

```powershell
curl -i -X POST https://us-central1-meteor-meet.cloudfunctions.net/storeCreatorEmail `
  -H "Content-Type: text/plain" -H "X-WhenFree-Key: <WHENFREE_MAIL_KEY value>" `
  -d '{\"eventSlug\":\"sometestslug123\",\"creatorEmail\":\"test@example.com\",\"creatorToken\":\"bad-token\"}'
```

- Do not use `__`-wrapped test IDs such as `__curl_test__`. Firestore reserves them and the call fails with `INVALID_ARGUMENT`.
- `dailyReport` has no public header check, so test it through Cloud Scheduler rather than curl:

```powershell
gcloud scheduler jobs run dailyReport --location=us-central1 --project=meteor-meet
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="dailyreport"' --project=meteor-meet --freshness=1h
```

Use `gcloud logging read` against the Cloud Run revision. `gcloud functions logs read` misses gen2 stdout.

## If something breaks

- The nightly report is silent: check Cloud Scheduler's history first (`gcloud logging read 'resource.type="cloud_scheduler_job"' --project=meteor-meet --freshness=2d`), then the function's own logs. The old GAS OAuth-expiry failure no longer applies.
- A bare 500 with no JSON body means an error escaped a handler's try/catch. The rate-limit check must stay inside its own try/catch, and document IDs must avoid the reserved `__...__` pattern. See the Security Patterns section of CLAUDE.md.
