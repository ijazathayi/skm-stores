# Public Firestore access

This app does not require login. Publish the contents of `firestore.rules` in the Firebase console for **skm-billing-33a82** to allow direct access from any device.

**Warning:** these rules allow anyone on the internet to read, add, change, and delete every document in this Firestore database, including inventory, sales, and debtor records. Anyone with the app URL can use all app features. Do not use these rules if the data must remain private or protected from edits.
