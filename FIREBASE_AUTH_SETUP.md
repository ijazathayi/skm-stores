# Set up worker and admin accounts

1. In the Firebase console for **skm-billing-33a82**, open **Authentication** → **Sign-in method** and enable **Email/Password**.
2. In **Authentication** → **Users**, create an email/password account for every worker and administrator.

   - Create each account using `NAME@skm.local` as its email. For example, use `siddica@skm.local`, `kasim@skm.local`, and `ijaz@skm.local`.
   - Everyone signs in using only their name and password. The app turns the name into the internal Firebase email automatically.
3. Copy each user's UID. In Firestore, create this document for each person:

   - Collection: `user`
   - Document ID: that user's Firebase UID
   - Field: `role` (string)
   - Value: `admin` for an administrator, or `worker` for a worker

4. In Firestore **Rules**, publish the contents of `firestore.rules` from this project.

Workers can use the store pages but cannot open the Admin page. Administrators are sent directly to the Admin page and can delete records. A person whose `user/{uid}` document does not have a valid role cannot sign in to the app.

Login remains active on the same device and browser until the person uses **Sign out**. It will not remain active in a different browser or device.

## Fingerprint sign-in (passkeys)

Fingerprint sign-in is device-based: do not collect a person's fingerprint or try to upload one to Firebase. Instead, have the worker sign in with their password on the device they will use, open **Settings**, and select **Set up fingerprint on this device**. Windows Hello, Android, or iPhone will ask the worker to verify their own fingerprint (or device PIN/face unlock where applicable).

For example, Siddica signs in once as `siddica` (the app uses `siddica@skm.local` internally), opens Settings, and sets up the fingerprint on her device. From then on she enters `siddica` on the login screen and chooses **Sign in with fingerprint**.

The passkey server must run with these private server environment variables. Add them to the deployment service's environment settings; do not put them in `NEXT_PUBLIC_*` variables or commit them to the repository.

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
PASSKEY_RP_ID=your-real-domain.example
PASSKEY_RP_ORIGIN=https://your-real-domain.example
```

Create the service-account JSON in Google Cloud Console → IAM & Admin → Service Accounts for the `skm-billing-33a82` project. Its private key is required only by the server so it can verify a passkey and issue a Firebase sign-in token. `PASSKEY_RP_ID` and `PASSKEY_RP_ORIGIN` must exactly match the HTTPS address where the app is deployed. Passkeys work on HTTPS (or `localhost` while testing), not on an ordinary local-network HTTP address.

The app must be hosted by a Next.js server platform (for example Vercel, Firebase App Hosting, or Cloud Run). A static-only host, including ordinary Firebase Hosting or GitHub Pages, cannot run the `/api/passkeys/*` verification routes and will show a "service is unavailable" message.
