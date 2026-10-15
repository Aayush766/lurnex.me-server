# SAT Master Class enquiries

Enquiries use the existing MongoDB `User` lead collection and existing `/api/admin/leads` authorization. No additional database or environment variable is required. Run the backend with its existing `.env` values (`MONGO_URI`, `MONGO_DB_NAME`, and `JWT_SECRET`). The public registration limiter allows five requests per IP per 15 minutes; this uses the existing `express-rate-limit` dependency and in-memory store.

## Registration endpoint

`POST /api/leads/sat-masterclass`

JSON fields: `studentName` (required), `parentName` (optional), `email`, `whatsappNumber` (E.164 with `+`), `grade`, `satFocus` (`Math`, `Reading & Writing`, or `Both`), `preferredSession` (`October 24`, `October 31`, or `Both`), `targetSatDate`, `pageUrl`, `referrerUrl`, `utm` (`source`, `medium`, `campaign`, `term`, `content`), and optional honeypot `website`.

Success is HTTP 201 with `{ message, reference }`. Invalid fields return HTTP 400 with `{ message, errors }`; rate limits return 429 and persistence failures return 503. A non-empty `website` honeypot receives a generic success response but creates no record. Keep the form pending until the POST resolves, display success only for HTTP 201, and fire any conversion event only after that response. Do not count an enquiry as an enrollment.

The checked-in `public` app is Vite/React and contains no `/sat-masterclass` form; no Next.js `app/sat-masterclass/sat-masterclass.tsx` or `lib/api` exists in this repository. `public/src/services/api.js` exports `registerSatMasterclassEnquiry(form)` for the landing page integration. The form caller should provide the exact displayed field values and handle rejected promises as submission errors. The helper supplies page URL, document referrer, and URL UTM parameters.

## Admin

Admin staff use the existing authenticated admin SPA at `/sat-masterclass` (the app's routing convention), backed by the JWT protected `/api/admin/leads` endpoints. The specialized list accepts the existing pagination/search/date/grade filters plus `satMasterclass=true`, `preferredSession`, `focus`, and `status`. Detail, update, and CSV export use the same protected endpoints as other leads. Status changes and internal notes record the authenticated admin ID and timestamp.
