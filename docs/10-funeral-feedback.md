# Funeral Feedback

Collect attendee feedback to improve service quality.

## Purpose

The Funeral Feedback feature allows funeral attendees who have viewed a published memorial to rate the funeral service. This helps funeral homes gather actionable feedback, measure satisfaction, and respond to contact requests.

## How It Works

1. A guest views a published memorial on the public portal.
2. The guest navigates to the **Funeral Feedback** tab.
3. The guest rates their experience across several dimensions and optionally provides contact details.
4. The feedback is stored and can be viewed by funeral home staff in the admin portal.
5. If the guest requests contact, an email notification is sent to the funeral home.

## Questions

The feedback form collects:

### Ratings (1–5 stars)
- **Overall Experience** — required
- **Staff Professionalism** — optional
- **Organisation** — optional
- **Venue** — optional

### Yes/Maybe/No Questions
- **Would you recommend this funeral home?** — optional
- **Would you use this funeral home again?** — optional

### Open Text
- **Comments** — optional, up to 2,000 characters

### Contact Request
- **May the funeral home contact me?** — checkbox
- If checked: Name (required), Phone (required), Email (optional)

## Ratings

All ratings use a 1–5 star scale:
- 1 = Poor
- 2 = Below Average
- 3 = Average
- 4 = Good
- 5 = Excellent

## Reports

### Summary Statistics (per memorial)
- Average overall rating
- Total responses
- % who would recommend
- % who would use again
- Average staff rating
- Average organisation rating
- Average venue rating

### Individual Responses
- All responses listed newest first
- Each response shows ratings, comments, and contact request status

## Privacy

- Contact details are only collected when the attendee explicitly opts in
- Contact details are stored in the FuneralFeedback record
- Only funeral home staff and SUPER_ADMIN can view feedback data
- Contact requests have a status workflow: NEW → CONTACTED → CLOSED

## Contact Requests

When an attendee checks "May the funeral home contact me?" and provides their details:

1. The request is stored with status `NEW`
2. An email notification is sent to the funeral home's registered email address (if SMTP is configured)
3. If SMTP is unavailable, the notification is logged to the server console
4. The request appears in the **Customer Enquiries** dashboard widget
5. Funeral home admins can update the status: NEW → CONTACTED → CLOSED

### Admin Dashboard Widget

The Customer Enquiries widget shows:
- Counts for NEW, CONTACTED, and CLOSED
- Total enquiries and this month's count
- Conversion rate (% CLOSED)
- Recent enquiries with name, phone, email, memorial, date
- Quick status update buttons

## Database

The `FuneralFeedback` model stores:
- `id` — unique identifier
- `memorialId` — foreign key to Memorial
- `overallRating` — 1–5 (required)
- `staffRating` — 1–5 (optional)
- `organisationRating` — 1–5 (optional)
- `venueRating` — 1–5 (optional)
- `recommend` — boolean or null
- `useAgain` — boolean or null
- `comments` — free text, max 2,000 characters
- `allowContact` — boolean, default false
- `name` — attendee name (when contact requested)
- `phone` — attendee phone (when contact requested)
- `email` — attendee email (when contact requested)
- `contactStatus` — NEW, CONTACTED, or CLOSED
- `contactedAt` — timestamp when status changed to CONTACTED
- `createdAt` / `updatedAt` — timestamps

## API Endpoints

### Public
- `POST /api/v1/public/memorials/:slug/feedback` — Submit feedback

### Admin (authenticated)
- `GET /api/v1/admin/memorials/:id/feedback` — List all feedback
- `GET /api/v1/admin/memorials/:id/feedback/summary` — Aggregated summary
- `PATCH /api/v1/admin/memorials/:id/feedback/:feedbackId/status` — Update contact status
- `GET /api/v1/admin/contact-enquiries` — All contact enquiries across funeral home

## Permissions

| Role | Submit Feedback | View Feedback | Update Contact Status | View Enquiries |
|------|----------------|---------------|----------------------|----------------|
| Public (guest) | ✓ | ✗ | ✗ | ✗ |
| FUNERAL_HOME_STAFF | ✗ | ✓ | ✗ | ✗ |
| FUNERAL_HOME_ADMIN | ✗ | ✓ | ✓ | ✓ |
| SUPER_ADMIN | ✗ | ✓ | ✓ | ✓ |

## Business Benefit

- Measure funeral service quality across multiple dimensions
- Identify areas for improvement in staff, organisation, and venue
- Capture new customer leads through contact requests
- Track conversion rate of enquiries to closed business
- Demonstrate commitment to quality to the families you serve
