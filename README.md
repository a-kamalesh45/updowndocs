# Building a Collaborative Document Editor — Complete Build Guide

## How to use this guide

This is a **stage-based build plan**, not a tutorial you read once. Each stage produces something that *runs*, so you always have a working app, just a less impressive one early on. Do not skip ahead to real-time collaboration before your basic CRUD app works — 80% of beginners who try this project fail because they try to build Google Docs on day one instead of building a boring document list app first.

**Order of stages:**

0. Project setup & planning
1. Auth (signup/login with JWT)
2. Document CRUD (create/edit/rename/delete) — still single-user, no real-time yet
3. Rich text editor integration (TipTap)
4. WebSocket plumbing (no CRDT yet — just "last write wins" broadcasting)
5. Real CRDT-based collaboration (Yjs) — this is the heart of the project
6. Presence, typing indicators, cursors
7. Autosave + version history
8. Sharing & roles (Owner/Editor/Viewer)
9. Redis Pub/Sub for horizontal scaling
10. Docker Compose, deployment, polish
11. Advanced/stretch features

Each stage below has: **what you're building**, **concepts you need first**, **step-by-step instructions**, and **how to know you're done**. Don't move to the next stage until "how to know you're done" is true.

---

## Stage 0 — Project Setup & Planning

### What you're building
The skeleton repo, folder structure, and your local dev environment, before writing any feature code.

### Concepts you need
- **Monorepo vs separate repos**: you'll have a frontend (Next.js) and backend (Node.js). You can put both in one Git repo with two folders (`/client`, `/server`) — simpler for a solo CV project. A monorepo tool like Turborepo is overkill here; skip it.
- **Environment variables**: secrets (DB passwords, JWT secret) never go in code. They live in `.env` files that are git-ignored.

### Steps

1. **Create the repo structure:**
   ```
   collab-editor/
     client/        ← Next.js app
     server/        ← Node.js backend
     docker-compose.yml
     README.md
     .gitignore
   ```

2. **Install Postgres and Redis locally** so you're not fighting Docker on day one. Easiest path: install Docker Desktop now anyway, and just run:
   ```bash
   docker run --name pg-dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:16
   docker run --name redis-dev -p 6379:6379 -d redis:7
   ```
   This gives you real Postgres/Redis instances without installing them natively. You'll formalize this into `docker-compose.yml` in Stage 10.

3. **Initialize the backend:**
   ```bash
   mkdir server && cd server
   npm init -y
   npm install express pg jsonwebtoken bcrypt cors dotenv
   npm install -D typescript ts-node-dev @types/node @types/express
   npx tsc --init
   ```
   Use TypeScript. For a CV project, typed code signals seniority and catches bugs early — worth the small upfront friction.

4. **Initialize the frontend:**
   ```bash
   npx create-next-app@latest client --typescript --app --tailwind
   ```

5. **Set up `.env` files** (and add `.env` to `.gitignore` immediately, before you forget):
   ```
   # server/.env
   DATABASE_URL=postgresql://postgres:devpass@localhost:5432/postgres
   JWT_SECRET=replace_with_a_long_random_string
   REDIS_URL=redis://localhost:6379
   PORT=4000
   ```

6. **Write a one-paragraph architecture note in your README now**, before code, describing the system diagram from your spec (Client → WebSocket → Backend → Redis → Postgres). This forces you to actually understand the flow before implementing it, and it doubles as documentation later.

### How to know you're done
You can run `npm run dev` in both `client/` and `server/` folders, hit `localhost:3000` (Next.js default page) and `localhost:4000` (an empty Express server), and both Postgres and Redis containers respond to `docker ps`.

---

## Stage 1 — Authentication (JWT-based signup/login)

### What you're building
Signup and login endpoints, password hashing, JWT issuing/verifying, and a protected-route pattern on both frontend and backend.

### Concepts you need

- **Password hashing (bcrypt)**: Never store plaintext passwords. Bcrypt takes a password and a "salt" (random data) and produces a one-way hash — you can check if a password matches a hash, but can't reverse the hash back to the password.
- **JWT (JSON Web Token)**: A signed, tamper-proof string the server hands the client after login, containing claims like `{ userId, exp }`. The client sends it back on every request (usually in an `Authorization: Bearer <token>` header). The server verifies the signature with a secret key — no database lookup needed to check who's making the request. Key property: JWTs are *signed, not encrypted* — anyone can read the payload, so never put secrets inside one.
- **Access vs refresh tokens**: A short-lived access token (e.g. 15 min) limits damage if stolen. A longer-lived refresh token (e.g. 7 days), stored more carefully (httpOnly cookie), is used to silently get new access tokens. For a CV project, a single longer-lived JWT (e.g. 1 day) is acceptable to start; add refresh tokens in Stage 11 if you want to show you understand the full pattern.
- **Middleware**: a function that runs before your route handler to check something (e.g. "is this request authenticated?") and either lets it through or rejects it.

### Steps

1. **Design the `users` table** in Postgres:
   ```sql
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     email TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
   Use UUIDs instead of auto-incrementing integers for primary keys — it's the convention in distributed/collaborative systems (no central counter needed, IDs can be generated client-side later if needed) and it's a detail that shows architectural awareness.

2. **Write `POST /auth/signup`:**
   - Validate input (email format, password length — use a library like `zod` for this; manual `if` checks get messy fast).
   - Hash the password: `const hash = await bcrypt.hash(password, 10)`.
   - Insert the user row.
   - Issue a JWT: `jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' })`.
   - Return the token (and basic user info, never the password hash) to the client.

3. **Write `POST /auth/login`:**
   - Look up user by email.
   - Compare password: `await bcrypt.compare(inputPassword, user.password_hash)`.
   - If valid, issue and return a JWT exactly as in signup.

4. **Write the auth middleware** (`server/middleware/auth.ts`):
   ```ts
   function requireAuth(req, res, next) {
     const header = req.headers.authorization;
     if (!header) return res.status(401).json({ error: 'No token' });
     try {
       const token = header.split(' ')[1];
       const payload = jwt.verify(token, JWT_SECRET);
       req.userId = payload.userId;
       next();
     } catch {
       res.status(401).json({ error: 'Invalid token' });
     }
   }
   ```
   Apply this to every route that needs a logged-in user.

5. **Frontend: build signup/login forms**, and on success store the JWT. For a CV project, storing it in **memory + httpOnly cookie** is the more secure pattern than `localStorage` (which is vulnerable to XSS token theft) — but `localStorage` is simpler and acceptable to ship first, with a note in your README that you know the tradeoff. If you want to do it properly: have the backend set the JWT as an httpOnly cookie on login, and the browser will send it automatically on every request (no manual header management needed).

6. **Frontend: create an auth context/hook** (`useAuth()`) that exposes `user`, `login()`, `logout()`, `signup()`, so any component can check auth state.

7. **Protect frontend routes**: redirect to `/login` if there's no valid session, using a layout-level check (Next.js App Router: a `(protected)` route group with a layout that checks auth).

### How to know you're done
You can sign up a new user, see them in the `users` table (with a bcrypt hash, not plaintext), log in, get redirected to a dashboard, and hitting a protected API route without a token returns 401.

---

## Stage 2 — Document CRUD (single-user, no real-time yet)

### What you're building
The ability to create, list, rename, and delete documents, with ownership tied to the logged-in user. No collaboration, no rich text yet — just a database-backed list of documents you can open and see a title for. This is intentionally boring; it's the foundation everything else sits on.

### Concepts you need

- **Foreign keys & ownership**: every document belongs to exactly one owner at creation time (`owner_id` references `users.id`). Later, the `collaborators` table will let *other* users access it too.
- **REST conventions**: `GET /documents` (list mine), `POST /documents` (create), `PATCH /documents/:id` (rename), `DELETE /documents/:id`. Predictable naming matters for anyone (including future-you) reading the code.
- **Authorization vs authentication**: authentication is "who are you" (handled in Stage 1). Authorization is "are you allowed to do this" — e.g., can this user delete *this specific* document? You check this per-request, not just at login.

### Steps

1. **Create the `documents` table:**
   ```sql
   CREATE TABLE documents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     title TEXT NOT NULL DEFAULT 'Untitled Document',
     owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     content JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```
   Note: `content` is added here even though your original spec didn't list it on the table — you need *somewhere* to store the actual document body. Storing it as `JSONB` lets you store the rich text editor's native JSON format directly (TipTap/ProseMirror documents are JSON trees). Don't store rich text as raw HTML in the database; JSON is queryable, less ambiguous, and is what Stage 5's CRDT library will want anyway.

2. **Build the four endpoints**, each behind `requireAuth`:
   - `POST /documents` — insert with `owner_id = req.userId`, return the new row.
   - `GET /documents` — return all documents where the user is owner OR appears in `collaborators` (for now, just owner — collaborators table comes in Stage 8).
   - `PATCH /documents/:id` — check `owner_id === req.userId` before allowing a title change (this is your first real authorization check).
   - `DELETE /documents/:id` — same ownership check, then delete (the `ON DELETE CASCADE` on collaborators/versions foreign keys, added later, will clean up related rows automatically).

3. **Use a query builder or raw SQL — skip a full ORM for now.** A lot of guides push you straight to Prisma. It's fine, but for a learning project, writing raw SQL with the `pg` library for at least this stage teaches you what an ORM is abstracting away. If you want less boilerplate, switch to **Prisma** here — it's a reasonable, common choice and worth listing on your CV. Pick one and move on; don't deliberate long.

4. **Frontend: dashboard page** listing the user's documents as cards/rows, with a "New Document" button (calls `POST /documents`, then router-pushes to `/documents/[id]`), inline rename (calls `PATCH`), and a delete button with a confirmation dialog.

5. **Frontend: document page** (`/documents/[id]`) that, for now, just fetches the document and renders its title and raw content in a `<textarea>` — you're not building the rich editor until Stage 3. This is deliberately a placeholder.

### How to know you're done
You can sign up, log in, create three documents, rename one, delete another, refresh the page and the list persists correctly, and you cannot see or delete a document owned by a different user account (test this with two accounts).

---

## Stage 3 — Rich Text Editor (TipTap)

### What you're building
Replacing the placeholder `<textarea>` with a real rich text editor supporting bold, italics, headings, lists, and code blocks, that saves its content as structured JSON to your `documents.content` column.

### Concepts you need

- **Why not `contentEditable` raw**: the browser's native rich-text editing is notoriously inconsistent across browsers and produces messy HTML. Editor frameworks (TipTap, Lexical, Slate) wrap this in a sane, extensible document model.
- **TipTap vs Lexical**: TipTap is built on **ProseMirror** and has first-class, well-documented support for Yjs (your Stage 5 CRDT library) via `@tiptap/extension-collaboration`. Lexical (Meta's editor) is excellent but its collaboration story is less mature/documented for this kind of project. **Use TipTap** — this single choice will save you significant pain in Stage 5.
- **Document model as a tree, not a string**: a rich text doc isn't "text with style tags sprinkled in" — it's a tree of nodes (paragraph → text, heading → text, bulletList → listItem → paragraph...). This is *why* JSON, not HTML, is the natural storage format.
- **Extensions**: TipTap features (bold, headings, code blocks) are individually installable "extensions" you compose together — you don't get one monolithic editor.

### Steps

1. **Install TipTap in the client:**
   ```bash
   npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
   ```
   `starter-kit` bundles paragraph, bold, italic, headings, lists, code blocks, blockquote — essentially everything in your spec, out of the box.

2. **Build a basic editor component:**
   ```tsx
   import { useEditor, EditorContent } from '@tiptap/react'
   import StarterKit from '@tiptap/starter-kit'

   function Editor({ initialContent, onUpdate }) {
     const editor = useEditor({
       extensions: [StarterKit],
       content: initialContent,
       onUpdate: ({ editor }) => onUpdate(editor.getJSON()),
     })
     return <EditorContent editor={editor} />
   }
   ```

3. **Build a toolbar** with buttons for Bold/Italic/H1/H2/Bullet List/Ordered List/Code Block, each calling `editor.chain().focus().toggleBold().run()` (TipTap's chainable command API) and visually indicating active state via `editor.isActive('bold')`.

4. **Wire it to your document page**: load `document.content` (the JSONB column) as `initialContent`, and on update, `PATCH` it back to the server — for now, on every keystroke is fine; you'll replace this naive save with proper autosave debouncing in Stage 7.

5. **Style it.** TipTap ships unstyled; you'll want basic CSS for headings/lists/code blocks to look like an actual document, not plain browser defaults.

### How to know you're done
You can type formatted text (headings, bold, lists, code blocks) into the editor, refresh the page, and see the same formatted content reload correctly from the database — proving your JSON round-trips properly.

---

## Stage 4 — WebSocket Plumbing (naive broadcast, no CRDT yet)

### What you're building
A WebSocket connection between client and server so that when User A types, User B's screen updates — using the simplest possible strategy first (broadcast the whole document on every change). This version will have real bugs under concurrent editing — that's intentional. You need to *feel* the problem before Stage 5's CRDT solves it for you; otherwise CRDTs will feel like unmotivated complexity.

### Concepts you need

- **WebSockets vs HTTP**: HTTP is request/response — the client always initiates. WebSockets establish one persistent, two-way connection: either side can push a message anytime, with no per-message connection setup overhead. This is why they fit live collaboration and HTTP polling doesn't.
- **Socket.io vs raw `ws`**: raw `ws` is a thin, fast WebSocket library — you handle reconnection, rooms, and message framing yourself. Socket.io adds automatic reconnection, "rooms" (broadcast to a subset of connected clients), and fallback transports, at the cost of being a bigger, more opinionated dependency. **For this project, use Socket.io** — "rooms" map perfectly onto "users currently in this document," and you'll want reconnection handling regardless; writing it yourself adds learning value but eats time better spent on the CRDT logic in Stage 5.
- **Rooms**: a Socket.io concept where you `socket.join(documentId)` and can then `io.to(documentId).emit(...)` to reach only clients editing that specific document, instead of broadcasting to everyone connected to the server.
- **The "naive broadcast" problem you're about to build and then feel**: if two users type at the same time and you just send "here's my full document now," whoever's update arrives last at the server wins, silently discarding the other person's keystrokes. This is the concrete problem CRDTs solve.

### Steps

1. **Install on the server:** `npm install socket.io`. Attach it to your existing HTTP server (don't create a second server):
   ```ts
   import { Server } from 'socket.io'
   const io = new Server(httpServer, { cors: { origin: CLIENT_URL } })
   ```

2. **Authenticate the socket connection.** Don't let just anyone connect — use a Socket.io middleware that verifies the JWT (sent as a query param or auth payload on connection) before allowing the handshake to complete, same idea as your HTTP `requireAuth` middleware.

3. **Implement room joining:**
   ```ts
   io.on('connection', (socket) => {
     socket.on('join-document', (documentId) => {
       socket.join(documentId)
     })
     socket.on('doc-update', ({ documentId, content }) => {
       socket.to(documentId).emit('doc-update', content) // to others, not self
     })
   })
   ```

4. **Client side:** on mounting the document page, connect, `emit('join-document', id)`, and listen for `doc-update` events to update the editor's content. On every local edit, `emit('doc-update', ...)`.

5. **Deliberately test the failure case** with two browser windows (or one normal + one incognito, logged in as different users): type in both *at the same time, in different parts of the document*. Watch one person's edit disappear. Write a one-paragraph note in your README describing what you observed — this is genuinely useful documentation of *why* Stage 5 exists, and shows whoever reads your repo that you understand the problem, not just the solution.

### How to know you're done
Two browser windows on the same document show each other's changes live with no manual refresh, *and* you've reproduced and written down the lost-update bug under concurrent typing.

---

## Stage 5 — Real Collaboration with CRDTs (Yjs) — the heart of the project

### What you're building
Replacing the naive "broadcast the whole doc" approach with **Yjs**, a CRDT library, so concurrent edits from multiple users merge correctly with no lost keystrokes, no matter the timing or order messages arrive.

### Concepts you need (slow down here — this is the part employers will ask you about)

- **The core problem, precisely stated**: in Stage 4, "last write wins" at the document level means concurrent edits = data loss. You need a strategy where every operation is preserved and the result is *deterministic* (everyone ends up with the identical final document) regardless of the order operations arrive in.

- **Operational Transformation (OT) — the older approach, and why you're not using it**: OT (used in early Google Docs) transforms each incoming operation against every other concurrent operation so they compose correctly — e.g., "insert at position 5" needs adjusting if someone else already inserted 3 characters at position 2. This requires a **central server that maintains operation order** and transforms ops sequentially; it's hard to implement correctly (subtle bugs in transform functions are notorious) and doesn't naturally support offline editing, since the client needs to know the server's current state to transform against. You should know OT exists and why Google Docs historically used it — but you are not implementing it yourself.

- **CRDTs (Conflict-free Replicated Data Types) — what you're actually using**: a CRDT structures data so that merging two divergent copies is *mathematically guaranteed* to converge to the same result, regardless of order or timing, with **no central coordinator needed**. For text specifically, Yjs assigns every inserted character a unique, stable identifier (roughly: "this character comes after character X, inserted by client Y"), so insertions and deletions from different clients can be merged by comparing identifiers rather than raw positions. This is why CRDTs naturally support **offline editing**: a client can keep editing locally with no connection, and merge cleanly once it reconnects, because merging never depended on real-time ordering in the first place.

- **Yjs specifically**: a JS CRDT implementation with a `Y.Doc` as the shared root, shared types like `Y.XmlFragment` for rich text, "providers" that handle network transport (you'll use a custom one over your existing Socket.io connection, or the simpler path: `y-websocket`), and `awareness` for ephemeral state (cursors, presence — Stage 6).

- **Why Yjs + TipTap specifically**: TipTap's `@tiptap/extension-collaboration` package binds a TipTap editor directly to a `Y.XmlFragment`, so local edits automatically become Yjs updates, and incoming Yjs updates automatically render in the editor — you don't manually diff or re-set content anymore.

- **Automerge as an alternative**: similar guarantees to Yjs, different API/internals, less specialized tooling for rich text editors specifically. Yjs is the better fit here mainly because of the TipTap integration; mention Automerge in your README as "considered, but Yjs chosen for its native ProseMirror/TipTap binding" — that sentence alone signals real understanding to a reviewer.

### Steps

1. **Install:**
   ```bash
   npm install yjs @tiptap/extension-collaboration y-protocols
   ```

2. **Decide on the transport.** Two reasonable options:
   - **(a) `y-websocket`'s server**, a ready-made Yjs sync server you run alongside your app. Fastest to get working.
   - **(b) Pipe Yjs updates through your existing Socket.io connection** manually, broadcasting binary update messages instead of full documents. More work, but it means you don't run two separate WS servers, and it's more impressive/instructive for a CV project since you're not just plugging in a black box.

   **Recommendation: go with (b)** since you already built the Socket.io plumbing in Stage 4 — extend it rather than replace it. The pattern: each Yjs document update fires a local event with a binary diff (`Y.encodeStateAsUpdate` / on the `update` event of `Y.Doc`); you `socket.emit` that binary diff to the room; on receipt, `Y.applyUpdate(ydoc, receivedUpdate)`. Yjs handles the merge logic — your server is just relaying bytes, which is *also* why this scales: the server doesn't need to understand document structure at all, just rebroadcast.

3. **Server holds one `Y.Doc` per active document** (in memory, keyed by document ID) so that a client joining mid-session can be sent the current full state (`Y.encodeStateAsUpdate(ydoc)`) to catch up, rather than only future diffs.

4. **Bind TipTap to Yjs on the client:**
   ```ts
   import * as Y from 'yjs'
   import Collaboration from '@tiptap/extension-collaboration'

   const ydoc = new Y.Doc()
   // ... wire ydoc to your socket as described above ...

   const editor = useEditor({
     extensions: [
       StarterKit.configure({ history: false }), // Yjs handles undo/history now
       Collaboration.configure({ document: ydoc }),
     ],
   })
   ```
   Note `history: false` — Yjs has its own undo manager (`Y.UndoManager`) that's CRDT-aware; TipTap's built-in undo extension isn't, and the two will conflict if both are active.

5. **Persist Yjs state to Postgres**, not just in server memory. On a debounced interval (ties into Stage 7's autosave), serialize the `Y.Doc` (`Y.encodeStateAsUpdate(ydoc)`, stored as `bytea`/binary in Postgres, or converted to your TipTap JSON via `editor.getJSON()` if you'd rather store the human-readable structure) so a server restart doesn't lose in-progress documents.

6. **Re-run your Stage 4 concurrent-typing test.** Both users typing simultaneously in different parts of the document should now both survive, correctly interleaved, with no lost characters.

### How to know you're done
Concurrent edits from two clients in the same paragraph never silently drop characters; killing and restarting your server mid-session doesn't lose document content (because of step 5); and you can explain, out loud, without looking anything up, why a CRDT doesn't need a central coordinator to stay consistent while OT does.

---

## Stage 6 — Presence, Typing Indicators, Cursor Sync

### What you're building
Showing who's currently viewing/editing a document, live typing indicators ("Priya is typing"), and colored cursors at each remote user's actual position in the text.

### Concepts you need

- **Ephemeral vs persistent state**: a cursor position or "is typing" flag is *not* something you want in your CRDT document or your database — it's transient, changes constantly, and is meaningless once someone disconnects. Yjs has a separate mechanism for exactly this: **Awareness**.
- **Yjs Awareness protocol**: a lightweight pub/sub layer, separate from document content, where each connected client broadcasts a small JSON blob (their user info, cursor position, selection range) that's automatically cleared when they disconnect (via heartbeat/timeout), and merged (last-write-per-client) rather than CRDT-merged, since you don't need history for "where is Bob's cursor right now."
- **Heartbeats**: clients periodically signal "I'm still here" (Awareness does this internally); if the server stops hearing from a client, it's presumed disconnected and removed from presence lists. This is what your spec's "Redis sets and heartbeat mechanisms" is describing at the infra level — Awareness gives you this per-document; Redis (Stage 9) is for when it needs to work across multiple server instances.

### Steps

1. **Use `y-protocols/awareness`** (ships alongside Yjs):
   ```ts
   import { Awareness } from 'y-protocols/awareness'
   const awareness = new Awareness(ydoc)
   awareness.setLocalState({ user: { name, color }, cursor: null })
   ```

2. **Broadcast awareness updates over your socket** the same way you broadcast Yjs document updates in Stage 5 — `awareness.on('update', ...)` fires a binary payload you emit to the room; on receipt, `applyAwarenessUpdate(awareness, payload, origin)`.

3. **Use TipTap's `CollaborationCursor` extension** (`@tiptap/extension-collaboration-cursor`), which is purpose-built to render colored cursors and selection highlights for each remote Awareness state, keyed by a `user: { name, color }` field you set per client — assign each user a consistent color (hash their user ID to a color from a fixed palette).

4. **Typing indicators**: on every local editor keystroke, update your own awareness state with `{ typing: true }`, debounced to flip back to `false` after ~1.5s of inactivity. Other clients read this off the Awareness states they're already receiving and render "X is typing" near the presence list.

5. **Presence list UI**: render avatars/names for everyone currently in `awareness.getStates()`, distinguishing "editing" (recent typing activity) vs "viewing" (connected but idle) — your spec's "Kamalesh is editing / Rahul is viewing" distinction.

### How to know you're done
Open the same document as three different users: you see all three in a presence list, see "X is typing" appear/disappear correctly as each types and pauses, and see each user's distinctly colored cursor move live as they click around or type.

---

## Stage 7 — Autosave & Version History

### What you're building
Debounced saving of the live Yjs state to Postgres (so nothing is lost on crash/refresh), plus periodic immutable **snapshots** users can browse and restore.

### Concepts you need

- **Debouncing vs throttling**: debouncing waits for a pause in activity before firing ("save 5 seconds after the *last* keystroke, restart the timer on every new keystroke"); throttling fires at a fixed maximum rate regardless of pauses ("save at most once every 5 seconds, period"). Your spec's "buffer updates → save every 5 seconds" is closer to throttling — it guarantees a save cadence even if the user never stops typing. Implement it as throttling, not debouncing, or a user typing continuously for two minutes would never get an intermediate save.
- **Snapshot vs continuous save are different problems**: continuous/autosave keeps the *current* state durable (overwrite). Version history needs *distinct restorable points in time* (append-only) — these need separate storage strategies even though they're triggered by similar events.
- **Storage cost of snapshots**: storing a full copy of the document on every snapshot is simple but can get large for long-lived documents. A reasonable middle ground for a CV project: store full JSON snapshots, but only at meaningful intervals (every N minutes of active editing, or on significant events), not on every single autosave tick.

### Steps

1. **Autosave**: on the server, maintain a per-document throttled save function (a simple `setInterval` per active document, or a timestamp check on each incoming update: "has it been ≥5s since the last save? if so, save now"). On trigger, persist `Y.encodeStateAsUpdate(ydoc)` (or `editor`-equivalent JSON) to the `documents.content` column and bump `updated_at`.

2. **Create the `versions` table** as in your spec:
   ```sql
   CREATE TABLE versions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     content JSONB NOT NULL,
     created_by UUID REFERENCES users(id),
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
   (Added `created_by` beyond your original spec — knowing *who* triggered a version is useful and easy to show in a version history UI: "restored to Priya's version from 2pm.")

3. **Snapshot trigger logic**: simplest reasonable rule — take a snapshot every 10 minutes of active editing per document, plus one immediately when the last collaborator disconnects (end-of-session snapshot). Implement as a server-side timer per active document room.

4. **Version history UI**: a sidebar/modal listing versions by timestamp + author, each with a "Preview" (render that JSON read-only in a TipTap instance with `editable: false`) and "Restore" button.

5. **Restore logic**: restoring should not silently destroy the current state — save a version of the *current* state first, then apply the old version's content as a *new* Yjs update (so it propagates live to all connected collaborators, rather than just overwriting the DB row underneath active editors).

### How to know you're done
Typing continuously for 30 seconds produces multiple autosave writes spaced ~5s apart (check your server logs/DB `updated_at`); you can browse a list of past versions with timestamps; restoring an old version updates the document live for all currently-connected collaborators, and the state right before the restore is itself preserved as a version.

---

## Stage 8 — Sharing & Role-Based Permissions

### What you're building
Letting an owner invite other users to a document as Editor or Viewer, and enforcing those roles on both the API and the real-time layer.

### Concepts you need

- **Role-Based Access Control (RBAC), minimal version**: you only need three roles and a small permission matrix — Owner (full control, including deleting the doc and managing collaborators), Editor (can change content, can't delete the doc or manage sharing), Viewer (read-only, no edit operations accepted at all). Write this matrix down explicitly before coding — it's the kind of detail that's easy to leave inconsistent between your REST API and your WebSocket handlers if you don't.
- **Authorization at two separate layers**: a role check on a REST endpoint (e.g. `PATCH /documents/:id`) does *not* automatically protect your WebSocket events — `doc-update` socket events need their *own* permission check, or a Viewer could bypass the UI and emit edit events directly. This is a common real bug in collaborative apps; explicitly handling it is a good thing to call out in an interview.

### Steps

1. **Create the `collaborators` table:**
   ```sql
   CREATE TABLE collaborators (
     document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
     PRIMARY KEY (document_id, user_id)
   );
   ```
   Note: it's reasonable to *also* insert an `owner` row here for the creating user at document-creation time, rather than relying solely on `documents.owner_id` — that way all permission checks ("what's this user's role on this doc?") go through one consistent table/query instead of two different paths.

2. **Build a `getRole(userId, documentId)` helper** used everywhere you need a permission check — one source of truth, not copy-pasted logic.

3. **Sharing UI + endpoint**: `POST /documents/:id/share { email, role }` — owner-only, looks up the invited user by email and inserts/updates their `collaborators` row. (Stretch: if the email doesn't match an existing user, you could send an invite email — not required for v1.)

4. **Update `GET /documents`** to return documents where the user appears in `collaborators` at all (not just as owner), and include their role in the response so the frontend can conditionally render edit controls vs. read-only.

5. **Enforce roles on REST writes**: `PATCH`/`DELETE` on a document requires `role === 'owner'`; content-modifying actions require `role IN ('owner', 'editor')`.

6. **Enforce roles on the socket layer**: in your `doc-update`/Yjs-update handler, look up the sender's role before applying/relaying the update; silently drop (and log) updates from Viewers rather than trusting the client to not send them.

7. **Frontend**: render the editor as `editable: false` for Viewers (TipTap supports this directly), hide formatting toolbar and sharing controls accordingly, and show each collaborator's role in the presence list from Stage 6.

### How to know you're done
A Viewer cannot edit content (blocked in the UI *and* if you bypass the UI and emit a socket event directly, it's rejected server-side); an Editor can edit but not delete the document or change sharing; only the Owner can manage collaborators or delete the document — verified with three real test accounts, not just by reading the code.

---

## Stage 9 — Redis Pub/Sub for Horizontal Scaling

### What you're building
Making your real-time layer work correctly across *multiple* backend server instances, not just one — the actual reason your spec lists Redis at all.

### Concepts you need

- **The problem this solves, concretely**: Socket.io rooms only know about connections on *that one server process*. If User A connects to backend instance 1 and User B connects to instance 2 (because you're running multiple instances behind a load balancer for scalability), instance 1 has no built-in way to tell instance 2 "broadcast this update to your connected clients." Without fixing this, collaboration silently breaks the moment you run more than one server instance.
- **Redis Pub/Sub**: a simple publish/subscribe messaging pattern — any process can `PUBLISH` a message to a named channel, and any process that has `SUBSCRIBE`d to that channel receives it, instantly, with no persistence (if no one's subscribed when you publish, the message is just gone — this is fine for our case, since it's only relaying live updates, not the source of truth, which is still Postgres).
- **The `@socket.io/redis-adapter`**: a drop-in Socket.io adapter that uses Redis Pub/Sub under the hood, so `io.to(room).emit(...)` automatically reaches clients connected to *any* server instance, not just the one that called `.emit`. This is the standard, well-supported way to do this — you do not need to hand-roll your own pub/sub bridging logic, and using a known library here is the *correct* choice, not a shortcut; the value for your CV is in correctly architecting around the problem, not reinventing Redis adapters.

### Steps

1. **Install:** `npm install @socket.io/redis-adapter redis`

2. **Wire up the adapter:**
   ```ts
   import { createClient } from 'redis'
   import { createAdapter } from '@socket.io/redis-adapter'

   const pubClient = createClient({ url: process.env.REDIS_URL })
   const subClient = pubClient.duplicate()
   await Promise.all([pubClient.connect(), subClient.connect()])
   io.adapter(createAdapter(pubClient, subClient))
   ```
   That's genuinely most of the integration work — the adapter transparently handles cross-instance broadcast from here on.

3. **Fix the in-memory `Y.Doc` problem from Stage 5.** Right now, each server instance holds its own in-memory `Y.Doc` per active document. With multiple instances, two users on the *same* document but *different* server instances would each be editing a separate, diverging in-memory copy. You need either:
   - **(a) Sticky sessions**: configure your load balancer so all clients editing the same document land on the same server instance (simplest, but limits true horizontal scaling for very large documents/rooms), or
   - **(b) A shared source of truth**: have every server instance subscribe to a Redis channel per active document, and apply/relay Yjs updates through Redis rather than only through in-process Socket.io state, so any instance can serve any client and stay in sync via Redis as the relay.

   For a CV project, **implement (a) and explicitly document (b) as the production-grade alternative** in your README — sticky sessions are a one-line load balancer config and let you demonstrate the Redis adapter correctly, while still showing you understand the deeper scaling problem and its real solution.

4. **Use Redis for presence too**, instead of relying solely on in-memory Awareness per instance: on connect/disconnect, write/remove the user from a Redis Set keyed by document ID (`SADD presence:{docId} {userId}`, with a TTL-refreshing heartbeat), so presence lists are correct cluster-wide. This matches your spec's "Redis sets and heartbeat mechanisms" line precisely.

### How to know you're done
Run two instances of your backend on different ports locally, put them behind a simple round-robin setup (or just manually connect two browser tabs to the two different ports) — with sticky-session document routing in place, collaboration still works correctly across instances, and you can explain in plain language why a *naive* multi-instance setup (no Redis adapter) would silently break it.

---

## Stage 10 — Docker Compose, Deployment, Polish

### What you're building
A one-command local environment (`docker-compose up`) that spins up everything (Postgres, Redis, backend, frontend), plus a real deployment so the project is something you can *link to*, not just a GitHub repo.

### Concepts you need

- **Why Docker Compose for this project specifically**: a reviewer who clones your repo shouldn't need to manually install and configure Postgres, Redis, and two Node apps with matching versions. `docker-compose up` doing all of it is a strong, legible signal of engineering maturity — arguably as valuable on your CV as the CRDT work itself, since it's rarer for portfolio projects to get right.
- **Multi-stage Docker builds**: building your TypeScript backend/frontend in one Docker stage (with dev dependencies) and copying only the compiled output into a slimmer final stage, so your production image isn't bloated with build tooling.

### Steps

1. **Write a `Dockerfile` for the server** (multi-stage: build TS → copy `dist/` + `node_modules` into a slim `node:20-alpine` final image).

2. **Write a `Dockerfile` for the client** (Next.js has an official `output: 'standalone'` build mode designed exactly for small Docker images — enable it in `next.config.js`).

3. **Write `docker-compose.yml`** wiring together: `postgres`, `redis`, `server` (depends_on postgres, redis; reads `.env`), `client` (depends_on server). Use named volumes for Postgres so data survives `docker-compose down`.

4. **Run database migrations as part of startup**, not manually — use a lightweight migration tool (`node-pg-migrate` or, if you adopted Prisma in Stage 2, `prisma migrate deploy`) run automatically on server container start, so a fresh `docker-compose up` ends with a fully-migrated, ready-to-use database.

5. **Deploy somewhere real and put the live link in your README and CV.** Reasonable, mostly-free options for a project like this: Railway or Render for the backend + Postgres + Redis (both support Docker Compose-like multi-service setups directly), Vercel for the Next.js frontend specifically (best-in-class Next.js hosting, though you'll point it at your separately-deployed backend's WebSocket URL). A working link massively outweighs a perfect README for actually getting attention on a CV.

6. **Polish pass** — this is where projects go from "functional" to "portfolio-grade":
   - Loading states and skeletons (document list, editor mounting).
   - Error boundaries / toast notifications for failed saves or lost connections (the WebSocket *will* drop sometimes — show a "reconnecting..." indicator rather than failing silently).
   - Empty states ("no documents yet — create your first one").
   - Basic responsive design — at least usable on a tablet-width screen.
   - A genuinely good README: the architecture diagram, a GIF or short screen recording of real-time collaboration in action (this is the single highest-impact thing you can add — text descriptions of "real-time collaboration" are unconvincing; a 10-second GIF of two cursors typing simultaneously is not), setup instructions, and the OT-vs-CRDT design note from Stage 5.

### How to know you're done
A stranger can clone your repo, run one documented command, and have the full stack running locally without asking you anything; and there is a live, deployed URL you could hand someone in an interview, right now, without you doing anything first.

---

## Stage 11 — Advanced / Stretch Features

Only attempt these once Stages 0–10 are solid — a project with 6 polished core features beats one with 14 half-working ones, both in practice and in how it reads on a CV. Pick 1-2 based on what's most relevant to roles you're targeting.

- **Commenting system**: anchor comments to a position/range in the Yjs document (store as a `Y.RelativePosition`, which — unlike a raw character index — stays correctly anchored even as other edits shift surrounding text). This is a nice one to pick if you want more CRDT depth on your CV.
- **Notifications**: "X commented on your document" / "Y shared a document with you" — a `notifications` table plus either polling or pushing over your existing socket connection.
- **Offline editing**: Yjs's CRDT design already makes this *possible* in principle (per Stage 5) — the remaining work is mostly client-side: detect disconnection, queue local edits in IndexedDB (`y-indexeddb` is a ready-made Yjs persistence provider for exactly this), and resync/merge on reconnect. Good to pick if you want to *prove* the offline claim in your resume bullet rather than just asserting it.
- **AI-assisted summarization / grammar suggestions**: call an LLM API with the document's plain text (strip it from the TipTap JSON via `editor.getText()`) for a "Summarize" button, or run suggestions through TipTap's decoration/mark system to underline issues inline. Good if you're targeting roles where AI integration experience matters.
- **Document search**: full-text search across a user's documents — Postgres's built-in `tsvector`/`to_tsquery` full-text search is sufficient at this scale; no need for Elasticsearch on a portfolio project.
- **Activity logs**: an append-only `activity_log` table (`document_id, user_id, action, created_at`) written to on key events (created, renamed, shared, restored-version) and rendered as a simple timeline.

---

## A note on your resume bullets

Your draft resume bullets are good, but make sure every one of them is true of what you actually built, not what the spec described — interviewers who've built real-time systems will probe exactly these claims (e.g., "walk me through what happens when two people edit the same word at the same time" is a very likely question given the bullet about CRDTs). Stage 5's "how to know you're done" check exists specifically so that line is something you can defend, not just state.
