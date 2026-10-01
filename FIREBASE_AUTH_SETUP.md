# Set up the administrator account

1. In the Firebase console for **skm-billing-33a82**, open **Authentication** → **Sign-in method** and enable **Email/Password**.
2. In **Authentication** → **Users**, create the administrator's email/password account.

   - Use `NAME@skm.local` as the email, such as `admin@skm.local`.
   - Sign in using only the account name and password. The app turns the name into the internal Firebase email automatically.
3. Copy each user's UID. In Firestore, create this document for each person:

   - Collection: `user`
   - Document ID: that user's Firebase UID
   - Field: `role` (string)
   - Value: `admin`

4. In Firestore **Rules**, publish the contents of `firestore.rules` from this project.

Only accounts whose `user/{uid}` document has the `admin` role can use the app. The existing sign-in route is only needed to authorize a new device; an authorized browser remains signed in and opens directly to Home.

Firebase keeps the administrator signed in on the same browser. A new browser or device must be authorized once through the sign-in route. Existing staff account records are not deleted by this app, but staff roles cannot access the application or store data.

## Fingerprint sign-in (passkeys)

Fingerprint sign-in is device-based: do not collect a person's fingerprint or try to upload one to Firebase. Sign in as the administrator on the device you will use, open **Settings**, and select **Set up fingerprint on this device**. Windows Hello, Android, or iPhone will ask the administrator to verify their fingerprint (or device PIN/face unlock where applicable).

After setup, enter the administrator account name on the sign-in screen and choose **Sign in with fingerprint**.

The passkey server must run with these private server environment variables. Add them to the deployment service's environment settings; do not put them in `NEXT_PUBLIC_*` variables or commit them to the repository.

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
PASSKEY_RP_ID=your-real-domain.example
PASSKEY_RP_ORIGIN=https://your-real-domain.example
```

Create the service-account JSON in Google Cloud Console → IAM & Admin → Service Accounts for the `skm-billing-33a82` project. Its private key is required only by the server so it can verify a passkey and issue a Firebase sign-in token. `PASSKEY_RP_ID` and `PASSKEY_RP_ORIGIN` must exactly match the HTTPS address where the app is deployed. Passkeys work on HTTPS (or `localhost` while testing), not on an ordinary local-network HTTP address.

The app must be hosted by a Next.js server platform (for example Vercel, Firebase App Hosting, or Cloud Run). A static-only host, including ordinary Firebase Hosting or GitHub Pages, cannot run the `/api/passkeys/*` verification routes and will show a "service is unavailable" message.
