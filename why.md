# Auction Bidding System — Architecture & Design Decisions

---

### 1. Data Model & Rationale

- **Schema Structure**:
  - **`auctions` Entity**: Stores immutable auction configuration parameters (`title`, `description`, `startingPrice`, `startTime`, `endTime`, `status`, `version`, `deletedAt`).
  - **`bids` Entity**: Append-only log storing every placed bid (`id`, `auctionId`, `userId`, `amount`, `status`, `timestamp`).
  - **In-Memory Redis Hash (`auction:<id>:state`)**: Holds active mutable state (`current_top_bid`, `top_bidder_id`, `end_time_ms`, `status`).

> **One-Sentence Rationale**:  
> The schema is structured with an immutable `auctions` table and append-only `bids` table to eliminate database row-level write contention during high-concurrency spikes, deriving real-time top-bid state in-memory via atomic Redis data structures.

---

### 2. Auction-Close Boundary Handling

- **Atomic Clock Source**: Bids are validated against the Redis server atomic clock (`redis.call('TIME')`) inside a single Lua script execution, preventing clock skew between application containers.
- **750ms Network Jitter Buffer**: Accommodates client-side network latency on boundary bids under heavy traffic (`nowMs > endMs + 750`). Bids transmitted just before the closing timestamp that reach the gateway within the buffer window are accepted.
- **Anti-Sniping Soft Close Extension**: If a valid higher bid is accepted within the last 60 seconds of the auction duration, the `endTime` is automatically extended by 60 seconds in both Redis memory and PostgreSQL to ensure fair competition.

---

### 3. Duplicate & Retried Bid Handling

- **Idempotency Key Specification**: Enforces an idempotency key formatted strictly as `<userId:UUIDv4/v7>:<UUIDv7>` passed via the `X-Idempotency-Key` HTTP header or `bid_id` payload property.
- **Atomic Distributed Locking**: Acquires a Redis lock using `SET idempotency:<key> {"status":"PROCESSING"} EX <ttl> NX`.
  - If a retry arrives while processing, the system rejects the duplicate with `409 Conflict`.
  - When completed, the final response is cached with a TTL matched to the auction lifecycle. Subsequent network retries immediately receive the cached response without re-executing bidding logic or duplicating records in PostgreSQL.

---

### 4. User Bidding on Their Own Current Top Bid

- **Decision**: **Permitted**, provided the new bid amount is strictly greater than the current top bid amount.
- **Rationale**:
  1. In live auctions, bidders frequently utilize preemptive bidding strategies to raise their own maximum threshold, discouraging competing bidders or satisfying dynamic reserves before the auction closes.
  2. Because each bid is recorded as an immutable append-only event with monotonically increasing values, permitting self-outbidding maintains mathematical and transactional consistency without corrupting the highest-bidder state.

---

### 5. Production Flaw, Underspecified Requirement & Proposed Solution

- **The Problem: Lack of Minimum Bid Increment Rules & Financial Pre-Authorization**:
  1. **Penny-Bidding Spam & Denial of Service**: The requirement that bids must only be _"strictly higher"_ allows micro-increment spam (e.g., bidding \$1000.01 over \$1000.00). Under high concurrency, automated bots can exploit micro-increments in the final seconds to indefinitely trigger the anti-sniping extension at negligible cost.
  2. **Unbacked Bids (Phantom Bidding)**: Accepting raw amounts without escrow holds or wallet pre-authorization leaves auctions vulnerable to winner default upon close.
- **Proposed Production Solution**:
  - **Dynamic Tiered Minimum Increments**: Enforce dynamic bid step rules based on the current price tier (e.g., minimum \$10 increment below \$500; \$50 increment above \$1,000).
  - **Two-Phase Bidding with Escrow Hold**: Integrate an asynchronous wallet/funds reservation lock before committing top bids to guarantee solvency at auction conclusion.
