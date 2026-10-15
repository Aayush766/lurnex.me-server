# Learner Accounts API

Base URL: `https://lurnex-me-server.onrender.com/api`. Start MongoDB and run `npm start` from `backend/`.

Copy `.env.example` to `.env`. Set `MONGO_URI` and `MONGO_DB_NAME` explicitly, plus a long random `JWT_SECRET`. Authentication and admin routes use the same `User` collection on the single shared Mongoose connection. An Atlas URI without a database path otherwise defaults to MongoDB's `test` database. The inspected environment had four learner accounts and one admin in `test`, and none in `lurnex`; the active API queried `test` and returned the learner records. The local example now names `lurnex` explicitly. Set the same intended database name for the running API and migration scripts.

Account email delivery needs `RESEND_API_KEY` and a verified `EMAIL_FROM`. Avatar uploads use the existing Cloudinary provider and need `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, and `CLOUDINARY_SECRET`. `FRONTEND_URL` configures CORS; admin notification variables are optional.

## Authentication

`POST /auth/register-student` is backward compatible. Lead capture requests omit `accountRegistration` or set it to `false`; they create only a lead record, do not store login credentials, and return `201 { message, lead: { id } }`. Account signup sets `accountRegistration: true` and sends `name`, `email`, `password` (8–128 characters), `mobile` (E.164), `course` or `curriculum`, `grade`, `school`, `country`, `parentName`, `parentEmail`, and `parentMobile` (E.164), plus optional existing attribution fields (`leadSource`, `leadIntent`, `registrationUrl`, `sourcePage`, `referrerUrl`). The account is active immediately and returns `201 { token, user }`; signup does not send or require an email verification code. An existing lead record may share the email with this separate account.

`POST /auth/login` accepts `{ email, password }`; suspended learner accounts are rejected. Legacy verification endpoints remain available for older pending accounts, but new registrations do not use them. `POST /auth/password-reset/request` accepts `{ email }` and returns a generic response. `POST /auth/password-reset/confirm` accepts `{ email, code, password }` and consumes a valid single-use code. Auth endpoints are rate limited.

The learner `user` object contains only `id`, `name`, `email`, `emailVerified`, `accountStatus`, `avatarUrl`, `curriculum`, `course`, `grade`, `school`, `country`, `mobile`, `parentName`, `parentEmail`, and `parentMobile`; it excludes password hashes and code secrets.

## Learner endpoints

All endpoints below require `Authorization: Bearer <token>` from an active learner account. The authenticated token supplies the learner ID; request body IDs are not used for ownership.

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /students/me` | — | Learner profile with `id`, `name`, `email`, `emailVerified`, `avatarUrl`, `curriculum`, `course`, `grade`, `school`, `country`, `mobile`, `parentName`, `parentEmail`, `parentMobile` |
| `PATCH /students/me` | Editable fields only: `name`, `mobile`, `course`, `curriculum`, `grade`, `school`, `country`, `parentName`, `parentEmail`, `parentMobile` | Updated learner profile; rejects attempts to change role, ownership, email, or verification state |
| `POST /students/me/avatar` | Multipart field `avatar`; JPEG/PNG/WebP, at most 5 MB | `{ avatarUrl }` after file signature validation and Cloudinary storage |
| `GET /students/me/dashboard` | — | `{ profile, stats, activity, downloads, forumQuestions }`; arrays are learner scoped. Activity entries use `{ id, type, title, createdAt, href? }`; download and forum entries use `{ id, title, createdAt, href? }`. |

Reads are limited to 60/minute and writes to 15/minute per client. Current activity uses the existing assessment attempts, class records and learner-owned Doubt records. There is no resource-download endpoint/model in this backend yet, so `downloads` is an empty array. No forum creation route exists; existing Doubt ownership is already stored in `student`.

## Email index migration

The old `users.email_1` index made emails globally unique, including leads. Learner accounts now need uniqueness among accounts while allowing a pre-existing lead to use the same email. Before deploying this schema to a database created under the old index, run:

```sh
node scripts/migrateLearnerEmailIndex.js
```

The migration checks for duplicate normalized learner emails before changing indexes, drops legacy global unique email indexes, normalizes learner account email values, and creates the unique partial index for records with `accountRegistration: true`. Lead records remain separate and may share an email with an account. A read-only preflight found no duplicate normalized learner emails in the active database. Run this migration against the explicitly configured `MONGO_DB_NAME` before relying on the new index.

## Existing admin APIs

All endpoints below require an admin Bearer token. The server enforces the admin role in `routes/adminRoutes.js`; guardian fields are only included in these authorized responses.

| Method and path | Query/body | Response |
| --- | --- | --- |
| `GET /admin/learners` | `search`, `verified=true|false`, `accountStatus=pending|active|suspended`, `curriculum`, `grade`, `from`, `to`, `sortBy`, `order=asc|desc`, `page`, `limit` | `{ learners, page, limit, total, pages, filters: { curricula, grades } }`; pending and unverified accounts are included unless filtered out. |
| `GET /admin/learners/:id` | — | `{ learner, linkedLeads, activity: { assessments, classes, downloads, forumQuestions } }`; activity queries use the learner's stored ID. |
| `PATCH /admin/learners/:id/status` | `{ status: "active" | "suspended" }` | `{ learner }`; action is audited. |
| `POST /admin/learners/:id/resend-verification` | — | `{ message }`; action is audited and rate limited. |

List pagination always reports at least one page, even for an empty result. Responses use `Cache-Control: no-store`.
