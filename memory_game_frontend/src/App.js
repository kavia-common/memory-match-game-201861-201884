import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * Generate a stable set of emoji “faces” for the game.
 * We keep this list small and friendly; the board size is derived from it.
 */
const EMOJI_FACES = ["🐶", "🐱", "🦊", "🐻", "🐼", "🐸", "🦁", "🐵"];

/**
 * Shuffle array in-place (Fisher–Yates).
 * @param {Array<any>} arr
 * @returns {Array<any>}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @typedef {Object} Card
 * @property {string} id Unique id for React keys and tracking.
 * @property {string} face Emoji to show when flipped/matched.
 * @property {boolean} isFlipped Whether the card is currently face up.
 * @property {boolean} isMatched Whether the card has been matched permanently.
 */

/**
 * Create a new deck from emoji faces.
 * @param {string[]} faces
 * @returns {Card[]}
 */
function createDeck(faces) {
  // Create a unique-ish id without assuming the Web Crypto API exists (jsdom tests may not provide it).
  const makeId = () => {
    try {
      /**
       * Prefer Web Crypto randomUUID when available.
       * Note: avoid referencing `globalThis` directly to satisfy the template's ESLint globals.
       */
      const cryptoObj =
        (typeof window !== "undefined" && window.crypto) ||
        (typeof global !== "undefined" && global.crypto) ||
        null;

      if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    } catch {
      // Ignore and fall back below.
    }

    // Fallback: time + random. Sufficient for React keys in this small demo.
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const pairs = faces.flatMap((face) => [
    { id: `${face}-a-${makeId()}`, face },
    { id: `${face}-b-${makeId()}`, face },
  ]);

  return shuffle(
    pairs.map((c) => ({
      ...c,
      isFlipped: false,
      isMatched: false,
    }))
  );
}

// PUBLIC_INTERFACE
function App() {
  /**
   * Board configuration:
   * - 8 faces => 16 cards (4x4 on desktop-ish widths, responsive otherwise)
   */
  const faces = useMemo(() => EMOJI_FACES, []);
  const [deck, setDeck] = useState(() => createDeck(faces));
  const [moves, setMoves] = useState(0);

  // Track currently selected (face-up but not yet resolved) card indices.
  const [firstIndex, setFirstIndex] = useState(null);
  const [secondIndex, setSecondIndex] = useState(null);

  // While resolving two cards, lock input to prevent rapid clicks.
  const [isBoardLocked, setIsBoardLocked] = useState(false);

  // Simple timer (seconds since first interaction).
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);

  const matchedCount = useMemo(
    () => deck.filter((c) => c.isMatched).length,
    [deck]
  );
  const totalPairs = faces.length;
  const matchedPairs = matchedCount / 2;
  const isWon = matchedPairs === totalPairs;

  // Start/stop timer.
  useEffect(() => {
    const shouldRun = startedAt !== null && !isWon;

    if (!shouldRun) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [startedAt, isWon]);

  // Resolve match/mismatch when two cards are selected.
  useEffect(() => {
    if (firstIndex === null || secondIndex === null) return;

    const first = deck[firstIndex];
    const second = deck[secondIndex];

    if (!first || !second) return;

    setIsBoardLocked(true);

    if (first.face === second.face) {
      // Match: keep flipped, mark as matched immediately.
      const next = deck.map((c, idx) => {
        if (idx === firstIndex || idx === secondIndex) {
          return { ...c, isMatched: true, isFlipped: true };
        }
        return c;
      });

      // Small delay for a nice “confirm” feel.
      window.setTimeout(() => {
        setDeck(next);
        setFirstIndex(null);
        setSecondIndex(null);
        setIsBoardLocked(false);
      }, 250);
    } else {
      // Mismatch: flip back after a short delay so user can see.
      window.setTimeout(() => {
        setDeck((prev) =>
          prev.map((c, idx) => {
            if (idx === firstIndex || idx === secondIndex) {
              return { ...c, isFlipped: false };
            }
            return c;
          })
        );
        setFirstIndex(null);
        setSecondIndex(null);
        setIsBoardLocked(false);
      }, 700);
    }
  }, [firstIndex, secondIndex, deck]);

  // PUBLIC_INTERFACE
  const resetGame = () => {
    setDeck(createDeck(faces));
    setMoves(0);
    setFirstIndex(null);
    setSecondIndex(null);
    setIsBoardLocked(false);
    setStartedAt(null);
    setElapsedSec(0);
  };

  const beginIfNeeded = () => {
    if (startedAt === null) setStartedAt(Date.now());
  };

  const canFlipIndex = (index) => {
    const card = deck[index];
    if (!card) return false;
    if (isBoardLocked) return false;
    if (card.isMatched) return false;
    if (card.isFlipped) return false;
    // Don't allow a third selection.
    if (firstIndex !== null && secondIndex !== null) return false;
    return true;
  };

  // PUBLIC_INTERFACE
  const handleCardActivate = (index) => {
    if (!canFlipIndex(index)) return;

    beginIfNeeded();

    setDeck((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, isFlipped: true } : c))
    );

    if (firstIndex === null) {
      setFirstIndex(index);
    } else if (secondIndex === null) {
      setSecondIndex(index);
      setMoves((m) => m + 1);
    }
  };

  return (
    <div className="App">
      <main className="game">
        <header className="gameHeader">
          <div className="titleBlock">
            <h1 className="gameTitle">Memory Match</h1>
            <p className="gameSubtitle">
              Flip two cards at a time and find all pairs.
            </p>
          </div>

          <div className="statsAndActions">
            <div className="stats" aria-label="Game statistics">
              <div className="stat">
                <span className="statLabel">Moves</span>
                <span className="statValue">{moves}</span>
              </div>
              <div className="stat">
                <span className="statLabel">Matched</span>
                <span className="statValue">
                  {matchedPairs}/{totalPairs}
                </span>
              </div>
              <div className="stat">
                <span className="statLabel">Time</span>
                <span className="statValue">
                  {startedAt === null ? "—" : `${elapsedSec}s`}
                </span>
              </div>
            </div>

            <button
              className="btnPrimary"
              onClick={resetGame}
              type="button"
              aria-label="Reset game"
            >
              Reset
            </button>
          </div>
        </header>

        {isWon ? (
          <section className="winBanner" role="status" aria-live="polite">
            <div className="winBannerInner">
              <h2 className="winTitle">You matched them all!</h2>
              <p className="winText">
                Completed in <strong>{moves}</strong> moves
                {startedAt !== null ? (
                  <>
                    {" "}
                    and <strong>{elapsedSec}s</strong>.
                  </>
                ) : (
                  "."
                )}
              </p>
              <button className="btnSecondary" onClick={resetGame} type="button">
                Play again
              </button>
            </div>
          </section>
        ) : null}

        <section className="boardSection" aria-label="Memory card grid">
          <div className="board" role="grid" aria-label="Card grid">
            {deck.map((card, idx) => {
              const isFaceUp = card.isFlipped || card.isMatched;

              return (
                <button
                  key={card.id}
                  type="button"
                  className={[
                    "card",
                    isFaceUp ? "isFlipped" : "",
                    card.isMatched ? "isMatched" : "",
                  ].join(" ")}
                  onClick={() => handleCardActivate(idx)}
                  onKeyDown={(e) => {
                    // Space/Enter activate by default on buttons, but keep explicit for clarity.
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardActivate(idx);
                    }
                  }}
                  disabled={!canFlipIndex(idx)}
                  role="gridcell"
                  aria-label={
                    card.isMatched
                      ? `Matched card ${card.face}`
                      : isFaceUp
                      ? `Flipped card ${card.face}`
                      : "Hidden card"
                  }
                  aria-pressed={isFaceUp}
                >
                  <span className="cardInner" aria-hidden="true">
                    <span className="cardFace cardBack">?</span>
                    <span className="cardFace cardFront">{card.face}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="hintText">
            Tip: On touch devices, flip carefully—cards lock briefly while
            resolving.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
