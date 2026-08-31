# High-Concurrency Auction Bidding Platform Backend

A production-grade, distributed auction bidding backend built with **NestJS**, **Fastify**, **PostgreSQL**, and **Redis**. Engineered for sub-millisecond atomic bid execution under thousands of concurrent bids per second while guaranteeing data consistency, idempotency, anti-sniping protection, and normalized schema persistence.

**Hosted URL**: [https://api.pandrillalabs.com/auction/api/docs](https://api.pandrillalabs.com/auction/api/docs)

---

## Key Architectural Features

### 1. Atomic High-Concurrency Bidding Engine

- **Precompiled Lua Script Execution (`EVALSHA`)**: Bidding logic executes atomically in Redis memory via a precompiled SHA1 Lua script, eliminating race conditions, out-of-order bids, and database lock contention.
- **Clock Synchronization**: Uses Redis atomic server time (`redis.call('TIME')`) rather than application container clocks to eliminate clock skew issues.
- **750ms Network Jitter Buffer**: Incorporates a 750ms grace period (`nowMs > endMs + 750`) on auction close boundaries to tolerate network delays under heavy client traffic.
- **Anti-Sniping Soft Close**: Bids arriving in the final 60 seconds automatically extend the auction deadline by 60 seconds.
- **Real-Time Event Broadcast**: Accepted bids publish events immediately to Redis Pub/Sub (`auction:<id>:bids`) for real-time live updates.

### 2. Normalized Data Architecture & In-Memory Feeds

- **Strictly Normalized Schema**: The `auctions` table contains only immutable configuration data (start/end times, starting price, metadata). Mutable bid state is never denormalized into `auctions`.
- **Dynamic State Derivation**: Highest bid amount and winning bidder are dynamically resolved from Redis RAM state or the append-only `bids` table.
- **Sub-Millisecond Public Feed**: The latest 50 bids per auction are cached in Redis List data structures (`auction:<id>:recent_bids`) for fast retrieval without hitting PostgreSQL.
- **Redis Pipeline Batching**: Batch lookups across auction feeds use Redis Pipelines to minimize TCP round-trips.

### 3. Distributed Idempotency Engine

- **Header Format**: Accepts `X-Idempotency-Key` formatted strictly as `<userId>:<UUIDv7>` (where `userId` is a valid UUIDv4 or UUIDv7).
- **Atomic Lock Lifecycle**: Uses Redis `SET ... EX ... NX` with dynamic TTL calculated from auction duration, preventing replay attacks and duplicate bid processing.

### 4. Enterprise Security & User Management

- **Argon2id Hashing**: Passwords and security question answers are hashed using `argon2`.
- **Password Complexity**: Requires uppercase, lowercase, digit, and special characters.
- **Role-Based Access Control (RBAC)**: Supports `ADMIN`, `MODERATOR`, and `BIDDER` roles with guards.
- **Admin Role Delegation**: Administrators can promote or demote any user to `ADMIN`, `MODERATOR`, or `BIDDER` via `PATCH /users/:id/role`.
- **Profile Privacy Protection**: Users with `isPrivate: true` have their real names masked on public endpoints (`GET /users/:username`).
- **Account Lifecycle**: Supports soft deletion (`DELETE /users/me` and `DELETE /auctions/:id`).

### 5. Automated Settlement Cron Worker

- Background cron worker runs every 30 seconds (`@Cron(CronExpression.EVERY_30_SECONDS)`) to transition expired active auctions to `ENDED` and prune stale Redis state keys.

---

## Tech Stack

- **Framework**: NestJS 11 (Fastify Engine)
- **Database**: PostgreSQL 16+ (TypeORM with connection pooling & SSL support)
- **Cache & Message Broker**: Redis (ioredis with Lua scripting)
- **Authentication**: JWT & Passport (Argon2id)
- **Documentation**: OpenAPI 3.0 (Swagger UI)
- **Scheduling**: `@nestjs/schedule`

---

## Architecture Overview

```mermaid
flowchart TD
    Client([Client / Bidder]) -->|POST /bid with X-Idempotency-Key| Fastify[NestJS Fastify Gateway]

    subgraph Security & Validation
        Fastify --> JwtGuard[JWT & Roles Guard]
        JwtGuard --> IdempCheck[Idempotency Validator]
    end

    subgraph Atomic Memory Layer
        IdempCheck -->|Acquire Lock| RedisLock[Redis Distributed Lock]
        RedisLock -->|EVALSHA placeBidLua| RedisLua[Redis In-Memory Engine]
        RedisLua -->|Atomic CAS Check| RedisState[(Redis State Hash)]
        RedisLua -->|750ms Jitter Buffer| RedisClock[Redis Clock TIME]
        RedisLua -->|Anti-Sniping Soft Close| RedisState
    end

    subgraph Persistence & PubSub
        RedisLua -->|On Accepted| AsyncSave[(PostgreSQL - TypeORM)]
        RedisLua -->|Push to List| RecentBidsCache[Redis Recent Bids List]
        RedisLua -->|Publish Event| RedisPubSub[Redis PubSub Channel]
    end

    subgraph Background Settlement
        CronWorker[Settlement Cron @ 30s] -->|Find Expired| AsyncSave
        CronWorker -->|Invalidate State| RedisState
    end
```

---

## Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **pnpm** / **npm** / **yarn**
- **PostgreSQL**: 16+ instance (Local or Cloud e.g., Aiven / AWS RDS)
- **Redis**: 7.x instance (Local or Cloud e.g., Upstash / Redis Cloud / Aiven)

---

## Environment Configuration

Create a `.env` file in the root directory:

```env
# Application Port & Environment
PORT=3000
NODE_ENV=development

# Database Configuration (PostgreSQL)
DATABASE_URL=postgres://user:password@hostname:port/database_name?sslmode=require
# Path to SSL CA certificate (required for Aiven / cloud databases with custom CA)
DATABASE_CA_CERT=ca.pem

# Redis Configuration
REDIS_URL=rediss://default:password@hostname:port

# JWT Authentication
JWT_SECRET=super_secure_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

---

## Installation & Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Database Migrations & Seeds

The application automatically synchronizes schemas in development mode (`NODE_ENV=development`).

To run the initial administrator seed:

```bash
npx ts-node -r dotenv/config src/database/seeds/admin.seed.ts
```

### 3. Start Development Server

```bash
# Start with hot reload
pnpm run start:dev

# Or using Nest CLI directly
nest start --watch
```

The server will start at `http://localhost:3000`.

- **Swagger Documentation**: `http://localhost:3000/api/docs`
- **Swagger JSON Specification**: `http://localhost:3000/api/docs-json`
- **Root Status Endpoint**: `http://localhost:3000/`

---

## Production Build & Deployment

### Build the Application

```bash
pnpm run build
```

### Start in Production Mode

```bash
NODE_ENV=production node dist/main.js
```

---

## Docker Deployment

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY ca.pem ./ca.pem

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
```

### Build & Run Container

```bash
docker build -t auction-bidding-backend .
docker run -p 3000:3000 --env-file .env auction-bidding-backend
```

---

## API Reference

### 1. System & App Endpoints

| Method | Endpoint | Access | Summary                                                 |
| :----- | :------- | :----- | :------------------------------------------------------ |
| `GET`  | `/`      | Public | Check server, PostgreSQL, and Redis connectivity health |

---

### 2. Authentication (`/auth`)

| Method | Endpoint                  | Access | Description                                                      |
| :----- | :------------------------ | :----- | :--------------------------------------------------------------- |
| `POST` | `/auth/register`          | Public | Register new user with password complexity and security question |
| `POST` | `/auth/login`             | Public | Authenticate user credentials and receive JWT bearer token       |
| `GET`  | `/auth/security-question` | Public | Retrieve configured security question for password reset         |
| `POST` | `/auth/reset-password`    | Public | Reset password using verified security question answer           |

---

### 3. User Management (`/users`)

| Method   | Endpoint             | Access        | Description                                                              |
| :------- | :------------------- | :------------ | :----------------------------------------------------------------------- |
| `GET`    | `/users/me`          | Authenticated | Get own complete user profile                                            |
| `PATCH`  | `/users/me`          | Authenticated | Update profile name, privacy toggle (`isPrivate`), or security questions |
| `GET`    | `/users/me/bids`     | Authenticated | View all bids placed by the user (supports pagination)                   |
| `GET`    | `/users/me/auctions` | Authenticated | View all auctions in which the user has participated                     |
| `PATCH`  | `/users/me/password` | Authenticated | Change password with current password verification                       |
| `PATCH`  | `/users/:id/role`    | Admin Only    | Promote or demote user to `ADMIN`, `MODERATOR`, or `BIDDER`              |
| `DELETE` | `/users/me`          | Authenticated | Soft delete own user account                                             |
| `GET`    | `/users/:username`   | Authenticated | Lookup user profile (masks name if user enabled `isPrivate`)             |

---

### 4. Auctions (`/auctions`)

| Method   | Endpoint               | Access      | Description                                                                 |
| :------- | :--------------------- | :---------- | :-------------------------------------------------------------------------- |
| `POST`   | `/auctions`            | Admin / Mod | Create a new active auction item                                            |
| `POST`   | `/auctions/draft`      | Admin / Mod | Create an auction item with `DRAFT` status                                  |
| `GET`    | `/auctions`            | Public      | List auctions with optional status filter (`?status=ACTIVE`) and pagination |
| `GET`    | `/auctions/:id`        | Public      | Retrieve single auction details with real-time highest bid and bidder info  |
| `PATCH`  | `/auctions/:id`        | Admin / Mod | Update auction title, description, starting price, or schedule              |
| `PATCH`  | `/auctions/:id/draft`  | Admin / Mod | Transition auction status back to `DRAFT`                                   |
| `PATCH`  | `/auctions/:id/cancel` | Admin / Mod | Cancel an auction (`CANCELLED`) and invalidate cached state                 |
| `PATCH`  | `/auctions/:id/end`    | Admin / Mod | Conclude an active auction prematurely (`ENDED`)                            |
| `DELETE` | `/auctions/:id`        | Admin Only  | Soft delete an auction item                                                 |

---

### 5. High-Concurrency Bidding (`/bid`)

| Method | Endpoint           | Access        | Description                                                   |
| :----- | :----------------- | :------------ | :------------------------------------------------------------ |
| `POST` | `/bid`             | Authenticated | Place an atomic concurrent bid on an active auction item      |
| `GET`  | `/bid/auction/:id` | Public        | Get public bid feed for an auction (served from Redis memory) |

#### Bidding Request Headers & Body

```http
POST /bid HTTP/1.1
Host: localhost:3000
Authorization: Bearer <jwt_token>
X-Idempotency-Key: <userId:UUIDv4/v7>:<UUIDv7>
Content-Type: application/json

{
  "auction_id": "7ccb6652-0a44-4dd5-bd2d-72817c0a6441",
  "amount": 350
}
```

#### Successful Bidding Response (`201 Created`)

```json
{
  "message": "Bid accepted",
  "current_bid": 350,
  "bid_id": "018f9e0a-7b3d-7bad-9bdd-2b0d7b3dcc06",
  "auction_id": "7ccb6652-0a44-4dd5-bd2d-72817c0a6441",
  "status": "ACCEPTED"
}
```

---

## Testing

```bash
# Run unit tests
pnpm run test

# Run e2e tests
pnpm run test:e2e

# Run test coverage
pnpm run test:cov
```

---

## License

This project is licensed under the MIT License.
