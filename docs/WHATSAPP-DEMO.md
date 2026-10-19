# Real WhatsApp test for a recording

The owner demo can send Meta's `hello_world` template (`en_US`) to one verified test recipient. It uses Meta Cloud API v25.0. This is a real outbound message, separate from the existing simulated role inbox. Automatic event notifications can also be explicitly enabled as described below.

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

## Connect actual demo events

1. Send Hello World, then **reply Hi from your phone to the Meta test sender**. Receiving Hello World alone does not open the customer service window. Your reply opens the 24-hour window for custom text, as explained in [Meta's guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started).
2. Under Settings > Notifications > **Automatic WhatsApp demo messages**, enter the same demo passcode, confirm that you replied, and choose **Enable automatic messages**.
3. The app saves the current demo as a shared workspace and authorizes forwarding for one hour. Role switches and other browsers on that private share link use the same records. Anyone holding that link can trigger events while forwarding is enabled, subject to the limits below.
4. Perform a **new** action: pay demo rent, approve/change a booking, submit a complaint, change complaint status, undo a payment, or click Generate rent reminders. Each supported action forwards its new notifications as one real text message to the configured demo phone. Payment owner/tenant duplicates are combined; bulk reminders become a bounded digest. No old inbox messages are replayed. Reminder checks are manual, not scheduled.
5. Switch back to Owner > Settings > Notifications to see recent attempts and disable forwarding. The passcode is required to enable, renew or disable. It is never stored in the browser or shared workspace.

Every real message is labelled DEMO, including receipts, and no real money or booking is created. All intended tenant/owner updates go to **the same configured test recipient**, never the fictional phone numbers in demo records. Production/real-account workflows are not connected to this demo sender.

Event messages are opt-in and off by default. They are written to an outbox in the same transaction as the demo mutation; Meta is contacted only after commit. Failures never roll back the PG action. At most five event-send attempts per minute and thirty per rolling day are allowed globally, separately from the Hello World button limits. Repeated actions that create no new notification do not send again. Forwarding expires after one hour and stops if the configured sender/recipient changes or demo sending is disabled.

The UI asks you to confirm replying but cannot independently verify the 24-hour window; Meta enforces it. If Meta rejects a text outside the window, reply on your phone and perform a new action. Production messages outside this window require approved templates; this demo does not configure those. Temporary tokens can also expire. Accepted requests are not proof of delivery: there is no delivery webhook. Failed or interrupted attempts remain visible and are not automatically retried, avoiding duplicate sends if delivery is uncertain.

## Verification

`npx tsx scripts/test-whatsapp.ts` exercises provider calls, event grouping, credentials, redaction and limits. `scripts/smoke-next-fixes.mjs` and `scripts/smoke-demo-browser.mjs` explicitly load a mock provider using Node's `--import` option and isolated databases, exercising event delivery without contacting Meta. The app never loads that mock. A final real delivery check requires your configured Render credentials and explicit opt-in or a button press.
