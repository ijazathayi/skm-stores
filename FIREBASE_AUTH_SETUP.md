# Set up worker and admin accounts

1. In the Firebase console for **skm-billing-33a82**, open **Authentication** → **Sign-in method** and enable **Email/Password**.
2. In **Authentication** → **Users**, create an email/password account for every worker and administrator.
3. Copy each user's UID. In Firestore, create this document for each person:

   - Collection: `users`
   - Document ID: that user's Firebase UID
   - Field: `role` (string)
   - Value: `admin` for an administrator, or `worker` for a worker

4. In Firestore **Rules**, publish the contents of `firestore.rules` from this project.

Workers can use the store pages but cannot open the Admin page. Administrators have access to the Admin page and can delete records. A person whose `users/{uid}` document does not have a valid role cannot sign in to the app.
