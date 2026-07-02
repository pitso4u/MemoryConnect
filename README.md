# Memory Connect

Digital Funeral Program & Memorial Experience Platform.

Transform the traditional printed funeral program into a modern digital memorial experience — viewable on any smartphone, tablet, projector, or television.

## Architecture

| App | Port | Purpose |
|-----|------|---------|
| **API** | 4000 | Express + Prisma |
| **Admin Portal** | 5173 | Funeral home staff management |
| **Memorial Portal** | 5174 | Guest-facing PWA (QR / short URL) |

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, PWA
- **Backend:** Node.js, Express, Prisma
- **Database:** SQLite (local dev) / PostgreSQL (production)
- **Auth:** JWT

## Quick Start

### Prerequisites

- Node.js 20+

### Setup

```bash
npm install
cp .env.example .env
cp .env.example apps/api/.env
npm run db:push
npm run dev
```

When `npm run dev` starts, each service prints **Local** and **Network** URLs in the terminal.

### URLs (on your laptop)

- Admin Portal: http://localhost:5173
- Memorial Portal: http://localhost:5174
- API: http://localhost:4000

---

## Local Network Demo Guide

Use this to demo on phones/tablets **without cloud hosting or internet**. All devices must be on the **same Wi-Fi network**.

### Quick Start

```bash
npm install
cp .env.example .env
cp .env.example apps/api/.env
npm run db:push
npm run dev
```

### 1. Find your laptop IP address

**Windows** (PowerShell or CMD):

```bash
ipconfig
```

Look for **IPv4 Address** under your Wi-Fi adapter, e.g. `192.168.0.105`.

**macOS/Linux**:

```bash
ifconfig | grep "inet "
```

### 2. Configure environment

The API `.env` should include:

```env
HOST=0.0.0.0
PORT=4000
CORS_ORIGIN=*
JWT_SECRET=your-secret-key-min-16-chars
DATABASE_URL="file:./dev.db"
```

`CORS_ORIGIN=*` allows phones on your network to call the API during demos.

### 3. Start the app

```bash
npm run dev
```

Terminal output will show network URLs, for example:

```
🚀 Memory Connect API v1
   Environment: development
   Host: 0.0.0.0
   Port: 4000
Memory Connect API (Backend)
  ➜  Local:   http://localhost:4000
  ➜  Network: http://192.168.0.105:4000

Memory Connect Admin Portal
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.0.105:5173/
```

### 4. Open admin from your laptop

```
http://localhost:5173
```

### 5. Set Demo Network URL for QR codes

1. Open a memorial in the admin portal
2. Scroll to **QR Code** section
3. In **Demo Network URL**, enter your laptop IP memorial URL:
   ```
   http://192.168.0.105:5174
   ```
4. Click **Save URL**
5. Download or display the QR code

### 6. Test on a phone

1. Connect the phone to the **same Wi-Fi** as your laptop
2. Scan the QR code **or** open:
   ```
   http://192.168.0.105:5174/your-memorial-slug
   ```
3. The memorial page should load

### Auto-detection

If you open the admin or memorial app using your network IP (e.g. `http://192.168.0.105:5173`), API calls automatically target `http://192.168.0.105:4000`.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Phone cannot connect | Confirm same Wi-Fi; check Windows Firewall allows Node on private networks |
| API errors on phone | Ensure `CORS_ORIGIN=*` in `apps/api/.env` |
| QR opens localhost | Set **Demo Network URL** to your laptop IP |
| Wrong IP after router change | Run `ipconfig` again and update Demo Network URL |
| JWT_SECRET error | Set a secure JWT_SECRET (min 16 characters) in `.env` |

### Switching to Production (VPS)

When ready to deploy to a VPS:

1. Change `CORS_ORIGIN` to your domain (not `*`)
2. Set `NODE_ENV=production`
3. Switch Prisma to PostgreSQL in `apps/api/prisma/schema.prisma`
4. Update `DATABASE_URL` to PostgreSQL connection string
5. Set strong `JWT_SECRET` from environment
6. Build and deploy:
   ```bash
   npm run build
   npm run start -w @memorialconnect/api
   ```

---

## Project Structure

```
MemorialConnect/
├── apps/
│   ├── api/          # Express REST API
│   ├── admin/        # Funeral home admin portal
│   └── memorial/     # Guest memorial PWA
└── packages/
    └── shared/       # Shared TypeScript types
```

## Production Database

For production, switch Prisma to PostgreSQL in `apps/api/prisma/schema.prisma` and set:

```
DATABASE_URL=postgresql://user:password@host:5432/memorialconnect
```

## Core Features

- Digital programme with live progress tracking
- Projector mode with remote control
- Photo & video galleries with slideshow
- Biography, obituary, and family tree
- Tribute wall with moderation
- Live announcements
- QR code generation with local-network demo support
- Offline PWA support

## Pay-per-funeral publishing

Memory Connect charges **R299.99 per published funeral**. Drafts are free, and each successful payment provides 30 days of public viewing.

1. Add these values to `.env.production` on the VM:

   ```env
   PAYSTACK_SECRET_KEY=sk_live_your_key
   MEMORIAL_EDIT_LOCK_HOURS=72
   ADMIN_URL=https://admin.memoryconnect.co.za
   ```

3. Configure the Paystack webhook URL:

   ```text
   https://api.memoryconnect.co.za/api/v1/payments/webhook
   ```

Use Paystack test keys before switching to live keys. The API verifies the reference, amount, currency, and success state server-side, and validates webhook signatures before publishing.

- `POST /api/v1/memorials/:id/initialize-publish-payment` starts the R299.99 checkout.
- `GET /api/v1/memorials/:id/verify-publish-payment/:reference` verifies and publishes.
- `POST /api/v1/payments/webhook` handles signed Paystack events.
- `scripts/expire-public-memorials.ts` ends viewing after 30 days.
- `scripts/delete-expired-videos.ts` removes videos after 30 days.
- `scripts/delete-expired-memorials.ts` removes the full memorial and media after 90 days.

## License

Proprietary — Pitso Soetsang
