# Set up worker and admin accounts

1. In the Firebase console for **skm-billing-33a82**, open **Authentication** → **Sign-in method** and enable **Email/Password**.
2. In **Authentication** → **Users**, create an email/password account for every worker and administrator.

   - For an administrator, use their real email address. They will sign in with that email.
   - For a worker, choose a Worker ID such as `siddica` or `kasim`, then create the Firebase account using `WORKER-ID@skm.local` as its email. For example, Worker ID `siddica` uses `siddica@skm.local`. The worker will only enter `siddica` and their password in the app; they will never need to enter or know this email.
3. Copy each user's UID. In Firestore, create this document for each person:

   - Collection: `users`
   - Document ID: that user's Firebase UID
   - Field: `role` (string)
   - Value: `admin` for an administrator, or `worker` for a worker

4. In Firestore **Rules**, publish the contents of `firestore.rules` from this project.

Workers can use the store pages but cannot open the Admin page. Administrators have access to the Admin page and can delete records. A person whose `users/{uid}` document does not have a valid role cannot sign in to the app.

Login remains active on the same device and browser until the person uses **Sign out**. It will not remain active in a different browser or device.
