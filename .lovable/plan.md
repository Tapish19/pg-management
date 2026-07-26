## PG One — Build Plan

This is a very large scope (public site + 3 role dashboards + 20+ backend tables + notifications + booking + payments UI). Shipping all of it in a single turn would produce shallow, buggy pages. I'll deliver it in clearly-scoped phases so each phase is polished, buildable, and demo-ready.

Before I start, one quick confirmation to lock the direction — I'll assume the answers below unless you say otherwise and proceed with **Phase 1 immediately**.

### Assumptions (tell me if any are wrong)
1. **Backend**: Enable Lovable Cloud (Supabase) for real auth + tables. Demo Admin/Staff/Tenant accounts auto-seeded so the login page has one-click role preview.
2. **Payments**: UI-only (Cash/UPI/Bank/Card demo confirmations) + a clearly-labeled "Connect Razorpay/Stripe" placeholder card. No live keys.
3. **Design language**: Premium neutral SaaS — slate/zinc base with a single emerald accent, Inter font, rounded-xl cards, subtle shadows. Not purple, not generic.
4. **Charts**: Recharts (already in shadcn ecosystem).
5. **Scope of "realistic demo data"**: 3 properties, ~8 rooms each, ~15 tenants, 30 days of invoices/payments, ~20 notifications per role, seeded via SQL migration.

### Phased delivery

**Phase 1 — Foundation & App Shell** (this turn)
- Enable Lovable Cloud.
- Design system in `src/styles.css` (emerald accent, neutral base, tokens for surfaces/status badges).
- App shell: sticky top bar (global search, notification bell, user menu, role switcher), collapsible sidebar with role-aware nav, mobile drawer.
- Public landing page (`/`) — hero, PG search, featured properties, amenities, food, testimonials, FAQ, contact.
- Auth pages: `/auth` (login/signup/forgot) with **one-click demo login** for Admin / Staff / Tenant.
- `_authenticated` layout with role-based routing.
- Notification center (bell dropdown + `/notifications` page).
- Full DB schema migration (all ~20 tables, enums, RLS, `has_role` helper) + seed data.

**Phase 2 — Public Booking Flow**
- `/browse` listing with filters (city, gender, price, sharing, food, AC, amenities).
- `/pg/$id` detail page (gallery, rooms, amenities, menu, rules, reviews, map placeholder).
- Multi-step booking wizard (`/book/$id`): room → date → tenant → KYC → add-ons → summary → payment → receipt.

**Phase 3 — Admin/Owner Dashboard**
- Overview + charts (occupancy, revenue, funnel).
- Properties, Floors/Rooms/Beds, Bookings, Tenants, Rent/Payments, Staff, Food, Expenses, Complaints, Visitors, Notices, Reports, Settings.

**Phase 4 — Staff Dashboard**
- Today's tasks, complaints, visitors, check-ins, food menu, attendance.

**Phase 5 — Tenant Dashboard**
- My room, pay rent, payment history, food menu + feedback, complaints, notices, visitor pre-approval, profile/KYC, move-out request.

**Phase 6 — Polish**
- Empty states, skeletons, mobile QA, build/typecheck, seed refresh, README of demo accounts.

### Technical notes (for reference)
- Stack: TanStack Start + React + TS + Tailwind v4 + shadcn/ui + Recharts + Supabase (Lovable Cloud).
- Roles stored in separate `user_roles` table with `has_role()` security-definer function (never on profiles).
- RLS: admins scoped to their org, staff to assigned properties, tenants to their own rows.
- Every sidebar entry gets a real page — no dead links.
- All colors via semantic tokens; no hardcoded hex in components.

**Reply "go" (or with edits) and I'll ship Phase 1 in the next turn.** If you want a different phase order or a smaller MVP first (e.g., skip public booking, focus on admin), tell me now.
