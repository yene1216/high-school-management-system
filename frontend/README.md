# School frontend (React + TypeScript + Vite)

The web app for the Django API in `../backend`. It talks only to `/api/v1/…` (same origin, through the Vite dev proxy or nginx), so the API's HttpOnly refresh cookie works.

## Run it (development)

Start the backend first (`python manage.py runserver` on port 8000), then:

```bat
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. If the API isn't on `http://localhost:8000`, copy `.env.example` to `.env` and set `VITE_PROXY_TARGET`.

## Build for production

```bat
npm run build          :: outputs dist/  (fast; no type check)
npm run typecheck      :: full TypeScript check
npm run build:strict   :: typecheck, then build
```
`Dockerfile` + `nginx.conf.template` build and serve `dist/` behind nginx, proxying `/api` to the backend (see `../docs/PRODUCTION.md`). Commit `package-lock.json` after your first `npm install`.

## What each role sees

| Role | Screens |
|---|---|
| Parent / guardian | Dashboard (child cards, register strip, results, balance), My children (attendance, results + report card, fees, documents), Invoices, Payments, Announcements, Notifications, Settings |
| Student | The same, for their own record |
| Teacher | Dashboard, Students (own classes), Attendance, Gradebook (create, enter marks, publish), Corrections (view), Reports (attendance), Announcements (to own classes) |
| Registrar | Students (add, edit, import CSV, photo, documents, guardians, enroll), Guardians, Enrollments, Attendance |
| Accountant | Invoices (create, bulk-generate, issue, void, record payments), Payments, Receipts, Refunds (request/decide), Fees on each student, Finance report |
| Principal | Read access to students and classes, Gradebook, Corrections (approve), Refunds, Reports, Audit log, Message delivery, Announcements |
| School admin | Everything above plus School setup (school settings, years, terms, grades, classes, subjects, teaching, fee categories, fees, discounts), Users, logins for parents and students |
| Counselor | Students, confidential support notes |
| Platform admin | Schools, Users (view), Audit log |

## API coverage

Every endpoint the backend exposes has a screen, except server-to-server ones:

* **Auth:** login, refresh (silent), logout, me (view/edit), change password, password reset request/confirm.
* **Setup:** schools, academic years, terms, grade levels, subjects, classes (+roster), teacher assignments, enrollments.
* **People:** students (list, create, edit, photo, CSV import, guardians link/create, attendance, grades, invoices, support notes), guardians, student documents (upload, verify/reject, download, delete).
* **Attendance:** take (bulk), history, request correction, review corrections.
* **Grading:** assessments (create, edit, delete), grades (view, enter), publish, report card (printable).
* **Finance:** fee categories, fee structures, discounts, student discounts, invoices (list, detail, generate, bulk-generate, issue, void), payments (list, record, receipt), refunds (request, decide).
* **Communication:** announcements (list, publish, delete), notifications (list, read, read-all, unread count), preferences, delivery log.
* **Insight:** dashboard, attendance report, finance report (CSV export), audit log.
* Not in the UI on purpose: `POST /payments/webhook/<provider>/` (called by the payment gateway) and hard-deleting students or users (use status / deactivate instead).

## Known limits (backend, not frontend)

* A platform admin can't create a school's first administrator through the API; do that in the Django admin (private `ADMIN_URL`). After that the school admin creates every other user in **Users**.
* Deleting a record that other records depend on returns a server error from the API; the app shows "in use elsewhere" instead.
* The backend has no endpoints yet for timetable, library, transport, staff/HR, admissions, messaging, leave requests, class promotion or emergency contacts, so the app has no screens for them.

## Security notes

* The access token is kept in memory only. The refresh token is an HttpOnly, SameSite=Strict cookie, so page scripts can't read it.
* All cached data is cleared on sign-out or session expiry.
* Photos and documents are private: they're fetched with the bearer token and shown from temporary object URLs.
* Spreadsheet exports neutralise formula injection.
* nginx sets a strict Content-Security-Policy; the app uses no inline scripts, no external fonts and no third-party scripts.

## Layout

```
src/
  api/          fetch client (auth, refresh, errors), API types, data hooks (useList, useItem, useAction)
  auth/         AuthContext, role groups that mirror the backend permissions
  app/          routes, guards, app shell with role-aware navigation
  components/   ui/ (buttons, forms, modal, tables, tabs, toasts), domain/ (register strip, charts, pickers), crud/ (generic list+form manager)
  features/     one folder per area: account, dashboard, students, people, attendance, grading, finance, communication, reports, admin
  i18n/         English + Amharic (have a native speaker review the Amharic)
```
