const { v4: uuidv4 } = require('uuid');

/**
 * Card Ranks: 1-7, 10 (Sota), 11 (Caballo), 12 (Rey)
 * Suits: oros, copas, espadas, bastos
 */
const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const createDeck = () => {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

/**
 * Calculate Cantos for a hand of 3 cards
 */
const calculateCanto = (hand) => {
    if (hand.length !== 3) return null;

    const ranks = hand.map(c => c.rank).sort((a, b) => a - b);
    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);

    const uniqueRanks = Object.keys(counts).length;

    // 1. Trivilín (3 equal)
    if (uniqueRanks === 1) {
        const rank = ranks[0];
        let points = 5;
        // Trivilín of Kings (12) wins automatically (handled in game flow)
        return { type: 'trivilin', points, rank, name: 'Trivilín' };
    }

    // 2. Ronda (2 equal)
    if (uniqueRanks === 2) {
        let pairRank;
        for (const r in counts) if (counts[r] === 2) pairRank = parseInt(r);

        let points = 0;
        if (pairRank <= 7) points = 1;
        else if (pairRank === 10) points = 2;
        else if (pairRank === 11) points = 3;
        else if (pairRank === 12) points = 4;

        return { type: 'ronda', points, rank: pairRank, name: 'Ronda' };
    }

    // 3. Patrulla (Consecutive 3) - Note: 7, 10, 11 is NOT consecutive in standard rules usually, 
    // but rules say "without 8 or 9", so 7-10-11 IS consecutive?
    // Rule text: "Secuencia de 3 cartas consecutivas (sin usar 8 ni 9) hasta el 12."
    // So 1-2-3, ... 6-7-10, 7-10-11, 10-11-12.
    const isConsecutive = (r1, r2) => {
        if (r2 === r1 + 1) return true;
        if (r1 === 7 && r2 === 10) return true;
        return false;
    };

    if (isConsecutive(ranks[0], ranks[1]) && isConsecutive(ranks[1], ranks[2])) {
        return { type: 'patrulla', points: 6, rank: ranks[2], name: 'Patrulla' };
    }

    // 4. Vigía (2 equal + 1 consecutive)
    // Example: 4,4,5 or 3,4,4.
    if (uniqueRanks === 2) {
        // Wait, uniqueRanks=2 is already Ronda. Can it be BOTH?
        // Usually you declare the highest. Vigía (7pts) > Ronda (1-4pts).
        // Let's check logic:
        // Pair is X. Third card is Y. Y must be X-1 or X+1 (handling 7-10 gap).
        let pairRank, otherRank;
        for (const r in counts) {
            if (counts[r] === 2) pairRank = parseInt(r);
            else otherRank = parseInt(r);
        }

        if (isConsecutive(otherRank, pairRank) || isConsecutive(pairRank, otherRank)) {
            return { type: 'vigia', points: 7, rank: pairRank, name: 'Vigía' };
        }
    }

    // 5. Registro (1, 11, 12)
    if (ranks.includes(1) && ranks.includes(11) && ranks.includes(12)) {
        return { type: 'registro', points: 8, name: 'Registro' };
    }

    // 6. Registrico (1, 10, 11)
    if (ranks.includes(1) && ranks.includes(10) && ranks.includes(11)) {
        return { type: 'registrico', points: 10, name: 'Registrico' };
    }

    // 7. Casa Chica (1, 11, 11)
    if (ranks.includes(1) && counts[11] === 2) {
        return { type: 'casa_chica', points: 11, name: 'Casa Chica' };
    }

    // 8. Casa Grande (1, 12, 12)
    if (ranks.includes(1) && counts[12] === 2) {
        return { type: 'casa_grande', points: 12, name: 'Casa Grande' };
    }

    return null;
};

/**
 * Process a move
 * @param {Object} gameState 
 * @param {Object} move { playerId, card }
 */
const processMove = (gameState, move) => {
    const { playerId, card } = move;
    const { table_cards, last_played_card, collected_cards, scores } = gameState;

    let points = 0;
    let message = '';
    let capturedCards = [];
    let isCaida = false;

    // 1. Check for Match (Capture)
    // Find matching rank on table
    const matchIndex = table_cards.findIndex(c => c.rank === card.rank);

    if (matchIndex !== -1) {
        // Capture!
        const matchedCard = table_cards[matchIndex];
        capturedCards.push(matchedCard);
        capturedCards.push(card); // The played card is also captured

        // Remove from table
        table_cards.splice(matchIndex, 1);

        // Check for Sequence Capture (picking up subsequent cards)
        // E.g. Played 4, matched 4. Table has 5, 6. Pick them up too.
        let nextRank = card.rank;
        let keepChecking = true;

        while (keepChecking) {
            // Determine next rank (handling 7->10)
            if (nextRank === 7) nextRank = 10;
            else if (nextRank === 12) keepChecking = false;
            else nextRank++;

            if (keepChecking) {
                const nextIndex = table_cards.findIndex(c => c.rank === nextRank);
                if (nextIndex !== -1) {
                    capturedCards.push(table_cards[nextIndex]);
                    table_cards.splice(nextIndex, 1);
                } else {
                    keepChecking = false;
                }
            }
        }

        // 2. Check Caída
        // If the matched card was the VERY LAST card played by the previous opponent
        if (last_played_card && last_played_card.card.rank === card.rank) {
            isCaida = true;
            // Points for Caída
            if (card.rank <= 7) points += 1;
            else if (card.rank === 10) points += 2;
            else if (card.rank === 11) points += 3;
            else if (card.rank === 12) points += 4;
            message = `¡Caída! (+${points})`;
        }

        // 3. Check Mesa Limpia
        if (table_cards.length === 0) {
            if (isCaida) {
                // Caída con Mesa Limpia is usually more points or cumulative?
                // Rules: "Caída con mesa: caída que además deja la mesa vacía → 5 puntos."
                // So override the points.
                points = 5; // Fixed 5 points? Or 5 + value? Usually fixed 5.
                message = '¡Caída y Mesa Limpia! (+5)';
            } else {
                points += 4;
                message += ' ¡Mesa Limpia! (+4)';
            }
        }

        // Add to collected
        if (!collected_cards[playerId]) collected_cards[playerId] = [];
        collected_cards[playerId].push(...capturedCards);

        // Clear last played because sequence was broken by capture (or just set to null?)
        // Actually, if I capture, the next player cannot do "Caída" on me because I didn't leave a card.
        gameState.last_played_card = null;

    } else {
        // No match, leave on table
        table_cards.push(card);
        gameState.last_played_card = { card, playerId };
    }

    // Update score
    if (points > 0) {
        scores[playerId] = (scores[playerId] || 0) + points;
    }

    return {
        points,
        message,
        capturedCards,
        isCaida
    };
};

module.exports = {
    createDeck,
    calculateCanto,
    processMove,
    SUITS,
    RANKS
};
