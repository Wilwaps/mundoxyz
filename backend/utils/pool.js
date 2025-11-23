const { v4: uuidv4 } = require('uuid');

/**
 * Initial game state for 8-Ball
 */
const getInitialState = () => {
  return {
    balls: [], // Will be populated by client or initial setup
    cueBall: { x: 0, y: 0 }, // Placeholder
    activeSuit: null, // 'solids' or 'stripes'
    turnState: 'open', // 'open', 'solids', 'stripes'
    fouls: 0,
    pocketedBalls: []
  };
};

/**
 * Validate if a move is legal based on 8-ball rules
 * This is a simplified validation - mostly trusting client physics but checking logical rules
 */
const validateTurn = (oldState, turnResult) => {
  const { 
    pottedBalls, // Array of ball numbers potted this turn
    firstHitBall, // Number of the first ball hit by cue ball
    cueBallPotted, // Boolean
    isBreak // Boolean
  } = turnResult;

  let foul = false;
  let foulReason = null;
  let turnEnds = false;
  let nextSuit = oldState.activeSuit;

  // 1. Check for Scratch (Cue ball potted)
  if (cueBallPotted) {
    foul = true;
    foulReason = 'scratch';
    turnEnds = true;
  }

  // 2. Check for "No Contact" (if not break)
  if (!isBreak && !firstHitBall && !foul) {
    foul = true;
    foulReason = 'no_contact';
    turnEnds = true;
  }

  // 3. Check for "Wrong Ball First" (if suit is assigned)
  if (!isBreak && !foul && oldState.activeSuit) {
    const isSolid = firstHitBall >= 1 && firstHitBall <= 7;
    const isStripe = firstHitBall >= 9 && firstHitBall <= 15;
    const isEight = firstHitBall === 8;

    if (oldState.activeSuit === 'solids' && !isSolid && firstHitBall !== 8) {
      // Allowed to hit 8 only if all solids are gone (client should handle this logic too)
      // For now, strict rule: must hit solid
      foul = true;
      foulReason = 'wrong_ball_first';
      turnEnds = true;
    } else if (oldState.activeSuit === 'stripes' && !isStripe && firstHitBall !== 8) {
      foul = true;
      foulReason = 'wrong_ball_first';
      turnEnds = true;
    }
  }

  // 4. Determine if turn continues
  // If no foul and at least one valid ball potted, turn continues
  if (!foul) {
    if (pottedBalls.length > 0) {
      // Check if valid ball for current suit
      const hasSolid = pottedBalls.some(b => b >= 1 && b <= 7);
      const hasStripe = pottedBalls.some(b => b >= 9 && b <= 15);
      const hasEight = pottedBalls.includes(8);

      if (hasEight) {
        // Game Over condition handled elsewhere
        turnEnds = true;
      } else if (!oldState.activeSuit) {
        // Table open
        if (hasSolid && !hasStripe) {
          nextSuit = 'solids';
          turnEnds = false;
        } else if (hasStripe && !hasSolid) {
          nextSuit = 'stripes';
          turnEnds = false;
        } else if (hasSolid && hasStripe) {
          // Mixed pot on open table - usually player chooses or stays open? 
          // Standard rules: Shooter keeps shooting, table remains open (or assigned to first ball? Varies.)
          // Let's go with: Assign to the first ball group potted legally? 
          // Simplification: If mixed, keep open? No, usually assigns.
          // Let's stick to: If you pot a solid, you are solids.
          nextSuit = hasSolid ? 'solids' : 'stripes'; // Simplified
          turnEnds = false;
        } else {
          turnEnds = true; // Only cue ball or nothing valid?
        }
      } else {
        // Table closed
        const validPot = oldState.activeSuit === 'solids' ? hasSolid : hasStripe;
        const opponentPot = oldState.activeSuit === 'solids' ? hasStripe : hasSolid;

        if (validPot && !cueBallPotted) {
          turnEnds = false;
        } else {
          turnEnds = true;
        }
        
        if (opponentPot) {
          // Potted opponent ball - usually loss of turn but not foul unless you hit it first
          // If you hit yours first, then potted theirs -> Turn ends? Or continues if you also potted yours?
          // Standard: If you pot yours, you continue, even if you pot theirs (unless foul).
          if (validPot) turnEnds = false;
          else turnEnds = true;
        }
      }
    } else {
      turnEnds = true;
    }
  }

  return {
    foul,
    foulReason,
    turnEnds,
    nextSuit
  };
};

/**
 * Check for Win/Loss conditions
 */
const checkWinCondition = (state, turnResult, playerId) => {
  const { pottedBalls, cueBallPotted } = turnResult;
  
  if (pottedBalls.includes(8)) {
    // 8-ball potted
    
    // 1. Loss: Potted 8-ball on break
    if (turnResult.isBreak) return { winner: 'opponent', reason: '8_ball_on_break' }; // Varies, sometimes respot
    
    // 2. Loss: Potted 8-ball with foul (scratch)
    if (cueBallPotted) return { winner: 'opponent', reason: '8_ball_scratch' };
    
    // 3. Loss: Potted 8-ball before clearing suit
    // Check if player has remaining balls
    const playerSuit = state.activeSuit; // Assuming state tracks this relative to current player
    // This requires knowing which suit belongs to the player.
    // We'll handle this in the main logic where we have player context.
    
    return { check8Ball: true }; // Signal to check suit completion
  }
  
  return null;
};

module.exports = {
  getInitialState,
  validateTurn,
  checkWinCondition
};
