# Application Security Specification

## 1. Data Invariants
1. A transaction MUST reference an existing book and user.
2. A book's `availCopies` MUST NEVER be negative or exceed `totalCopies`.
3. Users can only read their own preferences and write to their assigned role areas.
4. Admins can write anywhere.
5. Librarians can do operations on books and transactions.
6. A student can only see their own transactions, reservations, and payments.

## 2. The Dirty Dozen Payloads
1. `ShadowAdmin`: Attempt to change `status` or `role` fields via user profile update.
2. `IDPoisoning`: Pass a 1MB string to {userId} URL.
3. `CrossTenant`: A student tries to read another student's transactions.
4. `NegativeInventory`: Action that sets `totalCopies` < 0 or `availCopies` < 0.
5. `Impersonation`: Providing `userId: "adminUID"` when logged in as a student.
6. `NullPointer`: Deleting fields unexpectedly.
7. `BypassRenew`: A student trying to renew a book setting `status = "Returned"`.
8. `FakePayment`: A student marking their fineStatus as Paid.
9. `OrphanedTx`: Creating a transaction without a real bookId.
10. `UnauthorizedReserve`: Student trying to modify `facultyReserves`.
11. `TimeTravel`: Setting `checkout` or `createdAt` to a historical/future date maliciously.
12. `UnlimitedBorrow`: Bypassing maxBooksPerStudent limit by issuing a book.

## 3. Test Runner
We will omit the full runner here since we only have server scaffolding, but `firestore.rules.test.ts` would normally execute passing these 12 malicious payloads to Firebase Emulator and expecting `false` for all modifications.
