# Real WhatsApp test for a recording

The owner demo can send Meta's `hello_world` template (`en_US`) to one verified test recipient. It uses Meta Cloud API v25.0. This is a real outbound message, separate from the existing simulated role inbox. No PG action automatically sends real notifications.

## Render setup

In the PG Management Render service, open Environment and set:

| Variable                   | Value                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `WHATSAPP_DEMO_ENABLED`    | `true`                                                                                       |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID from Meta's test setup (not the display phone number or Business Account ID) |
| `WHATSAPP_ACCESS_TOKEN`    | Token authorized for that sender                                                             |
| `WHATSAPP_TEST_RECIPIENT`  | Your verified test recipient with country code, for example `+919876543210`                  |
| `WHATSAPP_DEMO_PASSCODE`   | A private passcode of at least 12 characters, at most 200                                    |

Save and deploy the updated code. Secrets must stay in Render, with no `VITE_` prefix, and out of recordings and GitHub. This demo has no recipient input: requests always use the server-configured phone. The passcode protects the real-send action even though anyone can enter the owner demo. Sharing the passcode grants the ability to trigger this fixed sample message.

## Record the demo

1. Enter the Owner / Admin demo.
2. Open Settings > Notifications.
3. Find **Send a real WhatsApp test**.
4. Enter the private demo passcode (masked).
5. Press **Send test WhatsApp** once.
6. Show the Hello World message arriving on your phone.

The app reports **accepted by Meta**, which is not proof of delivery. It does not process delivery webhooks. Temporary Meta tokens expire: replace the token in Render if the app reports it is invalid/expired.

## Limits and errors

- Maximum one attempt per minute, ten attempts per rolling 24 hours across this deployment/database. Attempts are reserved transactionally before calling Meta, so concurrent requests cannot bypass the limit. Failed/uncertain attempts also count.
- With hosted Turso the limiter survives redeploys. A local ephemeral Render SQLite database resets on redeploy, like the rest of that database.
- No automatic retry: if a request times out, check your phone before retrying after the cooldown.
- No arbitrary message, recipient or template is accepted from the browser.
- Disable after recording by setting `WHATSAPP_DEMO_ENABLED=false` and redeploying.

## Verification

`npx tsx scripts/test-whatsapp.ts` exercises the provider call with mocked HTTP, fixed recipient/template, credentials, error redaction, and limits. `scripts/smoke-next-fixes.mjs` checks production server-function validation without sending a message. A final real delivery check requires your configured Render credentials and an explicit button press.
