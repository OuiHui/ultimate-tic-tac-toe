# Ultimate Tic-Tac-Toe React

A modern, high-performance web implementation of **Ultimate Tic-Tac-Toe** built with React, Vite, Web Workers, and Supabase real-time multiplayer.

Features single-player AI powered by Minimax with Alpha-Beta pruning, live positional evaluation streaming, move analysis (blunder detection), interactive time-travel with branching history, and dual-mode online multiplayer (Supabase Realtime + Local BroadcastChannel fallback).

---

## Table of Contents

- [Getting Started](#getting-started)
- [How Game Logic Works](#how-game-logic-works)
  - [Board Architecture](#board-architecture)
  - [Targeting & Constraint Mechanics](#targeting--constraint-mechanics)
  - [Winning Conditions](#winning-conditions)
  - [State Management & Game Hook](#state-management--game-hook)
  - [Timer Control System](#timer-control-system)
  - [Move History & Time Travel](#move-history--time-travel)
- [How AI Works](#how-ai-works)
  - [Minimax Engine & Search Depth](#minimax-engine--search-depth)
  - [Transposition Table](#transposition-table)
  - [Heuristic Move Ordering](#heuristic-move-ordering)
  - [Evaluation Function](#evaluation-function)
  - [Multithreaded Web Worker Execution](#multithreaded-web-worker-execution)
  - [Blunder Analysis & Move Classification](#blunder-analysis--move-classification)
- [How Multiplayer Works & System Design](#how-multiplayer-works--system-design)
  - [System Architecture Overview](#system-architecture-overview)
  - [Room Lifecycle & Matchmaking](#room-lifecycle--matchmaking)
  - [Player Identity & Role Assignment](#player-identity--role-assignment)
  - [Dual Synchronization Architecture](#dual-synchronization-architecture)
  - [Turn Validation & State Synchronization](#turn-validation--state-synchronization)

---

## Getting Started

### Prerequisites

- **Node.js**: v16 or higher
- **npm** or **yarn**

### Installation & Run

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

---

## How Game Logic Works

The core game rules and state transitions are encapsulated in [`useSuperTicTacToe.jsx`](src/hooks/useSuperTicTacToe.jsx) and supported by pure helper utilities in [`gameUtils.js`](src/utils/gameUtils.js).

### Board Architecture

The Ultimate Tic-Tac-Toe grid (or "Super Board") is a 2D hierarchical structure:
- **Macro-board (Super Board)**: A $3 \times 3$ grid containing 9 small boards indexed $0..8$.
- **Micro-boards (Small Boards)**: Each small board is itself a $3 \times 3$ grid containing 9 individual cells indexed $0..8$.
- **Total Cells**: 81 cells, stored as an array of 9 board arrays: `boards[boardIndex][cellIndex]`.

```
Macro Board Indices:            Micro Board Cell Indices:
 [ 0 ] [ 1 ] [ 2 ]               [ 0 ] [ 1 ] [ 2 ]
 [ 3 ] [ 4 ] [ 5 ]               [ 3 ] [ 4 ] [ 5 ]
 [ 6 ] [ 7 ] [ 8 ]               [ 6 ] [ 7 ] [ 8 ]
```

### Targeting & Constraint Mechanics

Ultimate Tic-Tac-Toe enforces strict movement constraints based on the previous player's cell selection:
1. **Target Board Calculation**: If a player plays a piece in cell `c` of small board `b`, the next player is **forced** to play their turn inside small board `c` (`activeBoard = c`).
2. **Wildcard / Free Move**: If the target board `c` is already won (claimed by 'X', 'O', or marked 'tie') or completely filled with moves, the constraint is lifted (`activeBoard = null`). The next player receives a **free move** to play in any non-won, available small board across the entire macro-board.

### Winning Conditions

Game victory proceeds on two distinct levels evaluated after every move (`checkWin`):

1. **Local Board Victory**:
   - Evaluated against standard Tic-Tac-Toe win lines (3 horizontal, 3 vertical, 2 diagonal).
   - If a player gets 3-in-a-row inside board `b`, `wonBoards[b]` is permanently set to `'X'` or `'O'`.
   - If all 9 cells of board `b` fill up without a 3-in-a-row, `wonBoards[b]` is marked as `'tie'`.

2. **Global Game Victory**:
   - Evaluated on the `wonBoards` array ($3 \times 3$ meta-board). Ties in small boards act as neutral blockers.
   - If a player completes a 3-in-a-row line of won boards on the macro-board, that player wins the game (`gameWinner = 'X' | 'O'`).
   - If all 9 small boards are resolved (`wonBoards.every(r => r !== '')`) without a macro-board 3-in-a-row, the overall game ends in a tie (`gameWinner = 'tie'`).

### State Management & Game Hook

The custom React hook [`useSuperTicTacToe`](src/hooks/useSuperTicTacToe.jsx) manages state immutably:
- `boards`: `Array(9).fill(Array(9).fill(''))`
- `currentPlayer`: `'X'` | `'O'`
- `activeBoard`: `number | null`
- `wonBoards`: `Array(9).fill('')`
- `gameWinner`: `'' | 'X' | 'O' | 'tie'`
- `gameOver`: `boolean`

Every move creates a fresh state snapshot, checks for local/global wins, calculates the next active board index, and appends the move to history.

### Timer Control System

Time management is isolated in [`timerStore.js`](src/stores/timerStore.js):
- Uses an external pub/sub store model (`subscribe` / `getSnapshot`) so second-by-second countdown ticks do not trigger full React component tree re-renders.
- Supports selectable presets: **Off ($\infty$)**, **1m**, **3m**, **5m**, **10m**.
- If a player's timer reaches `0`, an automatic timeout loss is declared (`gameWinner = opponent`).

### Move History & Time Travel

The game records every move in an array of history objects containing:
- Move index, player, `boardIndex`, `cellIndex`.
- `prevState` and `stateAfter`.
- Real-time engine move analysis.

Players can use navigation controls to step through past moves or branch off from any prior state into a new move line.

---

## How AI Works

The AI engine is implemented in pure JavaScript ([`botEngine.js`](src/utils/botEngine.js)) and executed off the main thread inside a dedicated Web Worker ([`botWorker.js`](src/utils/botWorker.js)).

### Minimax Engine & Search Depth

The AI evaluates future moves using **Minimax with Alpha-Beta Pruning**:
- **Easy**: Search depth 1 (immediate heuristic evaluation of valid moves).
- **Medium**: Search depth 3 (looks 3 ply ahead).
- **Hard**: Search depth 8 (deep search utilizing alpha-beta cutoffs and transposition caching).

Alpha-beta pruning eliminates branches in the search tree that are proven worse than previously analyzed moves, drastically reducing node computations.

### Transposition Table

To prevent redundant evaluation of identical game states reached through different move transpositions, [`botEngine.js`](src/utils/botEngine.js) implements an in-memory Transposition Table (TT):
- **State Key Hashing**: Serializes the 81 cells, active player, and active board into a unique string:
  ```
  [81-cell string]|[currentPlayer]|[activeBoard]
  ```
- **Stored Entry Data**: Depth reached, score value, lookup flag (`EXACT`, `LOWERBOUND`, `UPPERBOUND`), and the recommended `bestMove`.

### Heuristic Move Ordering

Alpha-beta pruning efficiency relies heavily on inspecting promising moves first. Move candidates are pre-sorted prior to depth evaluation (`scoreMoveHeuristic`):
1. **TT Best Move**: High priority (+1000 score) if matching the cached transposition table recommendation.
2. **Local Board Win**: Priority (+500 score) if making the move claims a small board.
3. **Block Opponent Win**: Priority (+400 score) if the move blocks an opponent's 3-in-a-row on that board.
4. **Positional Weight**: Center cell ($4$) > Corner cells ($0, 2, 6, 8$) > Edge cells ($1, 3, 5, 7$).

### Evaluation Function

The position evaluator [`evaluator.js`](src/utils/evaluator.js) scores states from **X's perspective** (range $[-99, +99]$ for ongoing games, $\pm 100 \pm \text{depth}$ for terminal wins/losses):

$$\text{Total Score} = S_{\text{macro}} + S_{\text{boards}} + S_{\text{cells}} + S_{\text{active}}$$

1. **Macro-Board Pattern Score ($S_{\text{macro}}$)**:
   Scores partial 3-in-a-row threats on the meta-board of won boards (weighted $\times 3$).
2. **Small Board Positional Control ($S_{\text{boards}}$)**:
   Points awarded for won small boards based on their strategic location on the macro-board ($10 \times \text{weight}$), plus internal 2-in-a-row threats ($0.3 \times \text{threat}$).
3. **Live Cell Occupation ($S_{\text{cells}}$)**:
   Subtle positional bonuses ($0.05 \times \text{weight}$) for occupying central and corner cells inside active small boards.
4. **Active Board Strategic Advantage ($S_{\text{active}}$)**:
   Grants a $+15$ point advantage when receiving a free move (`activeBoard === null`), or evaluates the tactical advantage of sending the opponent to a specific board.

### Multithreaded Web Worker Execution

To keep the UI smooth at 60 FPS during deep Minimax computations:
- [`useBot.js`](src/hooks/useBot.js) instantiates a Web Worker (`botWorker.js`).
- State snapshots are posted to the worker; when search completes, the worker sends back the computed move message.
- **Streaming Live Evaluation Bar**: `botWorker.js` continuously executes iterative deepening ($1 \to 12$) and streams live evaluation updates (`EVAL_UPDATE`) to the [`EvalBar.jsx`](src/components/EvalBar.jsx) UI element.

### Blunder Analysis & Move Classification

When a human player makes a move, [`blunderAnalyzer.js`](src/utils/blunderAnalyzer.js) compares the played move against engine-evaluated optimal moves:
- **$\Delta \text{Eval}$ Calculation**: Difference between top engine move score and played move score.
- **Classification Categories**:
  - **BEST**: Played move matches the engine's optimal move choices ($\Delta \text{Eval} \le 0.5$).
  - **GOOD**: Minor loss in position ($\Delta \text{Eval} < 4$).
  - **INACCURACY**: Sub-optimal move ($4 \le \Delta \text{Eval} < 11$).
  - **MISTAKE**: Significant loss ($11 \le \Delta \text{Eval} < 25$).
  - **BLUNDER**: Major tactical error ($\Delta \text{Eval} \ge 25$ or dropping evaluation to lose position).

---

## How Multiplayer Works & System Design

Multiplayer enables real-time head-to-head competition online or across browser windows using a resilient dual-layer architecture implemented in [`SupabaseContext.jsx`](src/contexts/SupabaseContext.jsx).

### System Architecture Overview

```
                      +-----------------------------+
                      |       Client UI / App       |
                      +--------------+--------------+
                                     |
                                     v
                       +---------------------------+
                       |     SupabaseContext       |
                       +-------------+-------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v (Primary Cloud Sync)                              v (Zero-Config Local Sync)
+-----------------------------------+               +-----------------------------------+
|         Supabase Database         |               |     BroadcastChannel API          |
|    - Table: `games`               |               |    - `ttt-game-{CODE}`            |
|    - Realtime: `postgres_changes` |               |  + localStorage Mirroring         |
+-----------------------------------+               +-----------------------------------+
           |                                                   |
           +-------------------------+-------------------------+
                                     |
                                     v
                      +-----------------------------+
                      |    Opponent Browser Client  |
                      +-----------------------------+
```

### Room Lifecycle & Matchmaking

1. **Room Creation**:
   - Host clicks "Create Game".
   - Generates a random 6-character alphanumeric room code (e.g., `K9X2M7`).
   - Initializes a game record containing `boards`, `currentPlayer = 'X'`, `wonBoards`, timers, and timestamps.
2. **Room Joining**:
   - Second player enters the 6-character room code on the menu.
   - Client fetches room metadata and subscribes to state change events.

### Player Identity & Role Assignment

- **Client Persistence**: [`getPlayerId()`](src/contexts/SupabaseContext.jsx#L10) generates a UUID stored in `sessionStorage` (`ttt-player-id`).
- **Role Binding**:
  - The creator is assigned as **Player X** (`player_x_id`).
  - The first joiner is assigned as **Player O** (`player_o_id`).
  - Any subsequent connections to the room code are assigned as **Spectators** (read-only state observers).

### Dual Synchronization Architecture

The app uses a hybrid synchronization model:

1. **Cloud Realtime Mode (Supabase)**:
   - When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided, game moves update the `games` table in PostgreSQL.
   - Opponents receive instant state updates via Supabase Realtime WebSocket subscriptions (`postgres_changes` listener).

2. **Local Cross-Tab Broadcast Mode (Fallback)**:
   - If Supabase is unconfigured or offline, the app seamlessly switches to browser-native `BroadcastChannel('ttt-game-CODE')`.
   - Allows testing or playing multiplayer locally across two browser windows/tabs without any cloud setup. State is mirrored in `localStorage`.

### Turn Validation & State Synchronization

- **Client Enforcement**: Move execution is strictly validated:
  ```js
  if (gameState.gameOver || myPlayer !== gameState.currentPlayer) return;
  ```
- **State Broadcast Payload**: When a valid move occurs:
  1. The move is applied to local state via `useSuperTicTacToe`.
  2. The updated state payload (including full `moveHistory`) is transmitted to Supabase / BroadcastChannel.
  3. Receiving clients invoke `syncRemoteState(remoteState)` to reconcile their board rendering, move history, and timer sync deterministically.

---

## License

MIT License. Built for fun and competitive strategy games!
