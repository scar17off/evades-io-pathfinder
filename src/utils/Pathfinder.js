import { Vector } from './Vector';

// Predicts enemy positions for future simulation steps
function predictEnemyPositions(enemies, steps, boundary) {
  const predictions = [];
  for (let i = 0; i < steps; i++) {
    predictions.push([]);
  }
  
  // Clone enemies for simulation
  const simEnemies = enemies.map(e => ({
    pos: new Vector(e.pos.x, e.pos.y),
    vel: new Vector(e.vel.x, e.vel.y),
    radius: e.radius,
    speed: e.speed,
    angle: e.angle
  }));
  
  // Simulate enemy movements
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < simEnemies.length; i++) {
      const enemy = simEnemies[i];
      
      // Simulate enemy movement
      enemy.pos.x += enemy.vel.x / 32;
      enemy.pos.y += enemy.vel.y / 32;
      
      // Simulate boundary collision
      if (enemy.pos.x - enemy.radius < 0) {
        enemy.pos.x = enemy.radius;
        enemy.vel.x = Math.abs(enemy.vel.x);
      } else if (enemy.pos.x + enemy.radius > boundary.width) {
        enemy.pos.x = boundary.width - enemy.radius;
        enemy.vel.x = -Math.abs(enemy.vel.x);
      }
      
      if (enemy.pos.y - enemy.radius < 0) {
        enemy.pos.y = enemy.radius;
        enemy.vel.y = Math.abs(enemy.vel.y);
      } else if (enemy.pos.y + enemy.radius > boundary.height) {
        enemy.pos.y = boundary.height - enemy.radius;
        enemy.vel.y = -Math.abs(enemy.vel.y);
      }
      
      // Store prediction
      predictions[step].push({
        x: enemy.pos.x,
        y: enemy.pos.y,
        radius: enemy.radius,
        vel: { x: enemy.vel.x, y: enemy.vel.y }
      });
    }
  }
  
  return predictions;
}

// i love chatgpt writing the comments in a professional english tone
// Check if path is safe at a specific timestep
function isPathSafeAtTime(start, end, enemyPositions, playerRadius, safetyBuffer = 1.5, avoidCrossingPaths = false) {
  // Linear interpolation between start and end
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist === 0) return true;
  
  // Check path against each enemy
  for (const enemy of enemyPositions) {
    const totalRadius = (enemy.radius + playerRadius) * safetyBuffer;
    
    // Check if line segment intersects circle
    // Using the formula for closest point on line segment to circle center
    const t = Math.max(0, Math.min(1, ((enemy.x - start.x) * dx + (enemy.y - start.y) * dy) / (dist * dist)));
    const closestX = start.x + t * dx;
    const closestY = start.y + t * dy;
    
    const distToClosest = Math.sqrt(
      (closestX - enemy.x) * (closestX - enemy.x) + 
      (closestY - enemy.y) * (closestY - enemy.y)
    );
    
    if (distToClosest < totalRadius) {
      return false; // Collision detected
    }
    
    // If avoiding crossing paths is enabled, check if we're crossing the enemy's path
    if (avoidCrossingPaths && enemy.vel && (Math.abs(enemy.vel.x) > 0.1 || Math.abs(enemy.vel.y) > 0.1)) {
      // Get enemy movement direction
      const enemyDir = Math.atan2(enemy.vel.y, enemy.vel.x);
      // Get player movement direction
      const playerDir = Math.atan2(dy, dx);
      
      // Calculate angle between movement directions
      const angleDiff = Math.abs(
        Math.atan2(
          Math.sin(enemyDir - playerDir),
          Math.cos(enemyDir - playerDir)
        )
      );
      
      // If close to perpendicular crossing (90 degrees +/- 30)
      if (angleDiff > Math.PI/6 && angleDiff < Math.PI*5/6 && distToClosest < totalRadius * 1.5) {
        return false; // Avoid crossing paths
      }
    }
  }
  
  return true; // No collision
}

// um yes yes thank you chatgpt for commenting this ily (and deshitcoding it)
export function findPath(start, goal, enemies, options) {
  const {
    width,
    height,
    playerRadius,
    steps = 200,
    safetyBuffer = 1.5,
    lookaheadSteps = 60,
    progressiveStepSize = 120,
    allowWaiting = true,
    avoidCrossingPaths = true
  } = options;
  
  // Generate enemy position predictions
  const enemyPredictions = predictEnemyPositions(enemies, steps, { width, height });
  
  // Calculate distance to goal
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const distToGoal = Math.sqrt(dx * dx + dy * dy);
  
  // For immediate obstacle avoidance, only look at current enemy positions
  const immediateEnemyPositions = enemyPredictions[0];
  
  // If we're very close to the goal, try to go directly
  if (distToGoal < progressiveStepSize / 2) {
    if (isPathSafeAtTime(start, goal, immediateEnemyPositions, playerRadius, safetyBuffer, avoidCrossingPaths)) {
      return [goal];
    }
  }
  
  // Consider waiting if it's allowed and there's danger ahead
  if (allowWaiting) {
    // Check if waiting would improve safety
    // Look ahead a few steps to see if enemies move away
    const waitingBeneficial = checkIfWaitingIsBeneficial(
      start, goal, enemyPredictions, playerRadius, safetyBuffer, avoidCrossingPaths
    );
    
    if (waitingBeneficial) {
      // Return a path with duplicate points to signal waiting
      return [
        new Vector(start.x, start.y),
        new Vector(start.x, start.y)
      ];
    }
  }
  
  // Try to find a progressive path
  // 1. Check if direct path to intermediate goal is safe
  const ratio = Math.min(1, progressiveStepSize / distToGoal);
  const intermediateGoal = {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio
  };
  
  // Only check immediate safety for the intermediate goal
  if (isPathSafeAtTime(start, intermediateGoal, immediateEnemyPositions, playerRadius, safetyBuffer, avoidCrossingPaths)) {
    return [intermediateGoal];
  }
  
  // 2. Try to find a path that deviates slightly from the direct path
  const angleToGoal = Math.atan2(dy, dx);
  const possibleAngles = [];
  
  // Prioritize angles closer to the goal direction
  for (let i = 1; i <= 18; i++) {
    const angle = (i * 5) * (Math.PI / 180); // 5, 10, 15... degrees
    possibleAngles.push(angleToGoal + angle);
    possibleAngles.push(angleToGoal - angle);
  }
  
  // Sort angles by closeness to goal direction
  possibleAngles.sort((a, b) => {
    return Math.abs(a - angleToGoal) - Math.abs(b - angleToGoal);
  });
  
  // Try each angle to find a safe path
  for (const angle of possibleAngles) {
    const newPos = {
      x: start.x + Math.cos(angle) * progressiveStepSize,
      y: start.y + Math.sin(angle) * progressiveStepSize
    };
    
    // Ensure the point is within bounds
    newPos.x = Math.max(playerRadius, Math.min(width - playerRadius, newPos.x));
    newPos.y = Math.max(playerRadius, Math.min(height - playerRadius, newPos.y));
    
    // Check if this direction is safe for immediate movement
    if (isPathSafeAtTime(start, newPos, immediateEnemyPositions, playerRadius, safetyBuffer, avoidCrossingPaths)) {
      // Also check the safety a few timesteps ahead (but fewer than before)
      let isSafe = true;
      const shortLookahead = Math.min(5, lookaheadSteps, enemyPredictions.length); 
      
      for (let t = 1; t < shortLookahead; t++) {
        if (!isPathSafeAtTime(start, newPos, enemyPredictions[t], playerRadius, safetyBuffer, avoidCrossingPaths)) {
          isSafe = false;
          break;
        }
      }
      
      if (isSafe) {
        return [newPos];
      }
    }
  }
  
  // 3. If no good path is found, focus only on immediate avoidance
  return findSafestImmediateDirection(start, goal, immediateEnemyPositions, playerRadius, {
    width, 
    height, 
    safetyBuffer,
    progressiveStepSize,
    avoidCrossingPaths
  });
}

// Check if waiting would improve safety
function checkIfWaitingIsBeneficial(start, goal, enemyPredictions, playerRadius, safetyBuffer, avoidCrossingPaths) {
  // If we're in immediate danger, waiting won't help
  if (!isPositionSafe(start, enemyPredictions[0], playerRadius, safetyBuffer)) {
    return false;
  }
  
  // Calculate direction to goal
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const distToGoal = Math.sqrt(dx * dx + dy * dy);
  
  if (distToGoal < playerRadius * 2) {
    return false; // Already close to goal, no need to wait
  }
  
  // Look ahead to see if any dangerous situations resolve by waiting
  const lookaheadTime = Math.min(30, enemyPredictions.length);
  
  // Direction to immediate goal
  const normalizedDx = dx / distToGoal;
  const normalizedDy = dy / distToGoal;
  
  // Check a point in the direction of the goal
  const checkPoint = {
    x: start.x + normalizedDx * Math.min(100, distToGoal),
    y: start.y + normalizedDy * Math.min(100, distToGoal)
  };
  
  // Check if path becomes safe after waiting
  let currentlySafe = isPathSafeAtTime(
    start, checkPoint, enemyPredictions[0], 
    playerRadius, safetyBuffer, avoidCrossingPaths
  );
  
  for (let t = 1; t < lookaheadTime; t++) {
    const willBeSafe = isPathSafeAtTime(
      start, checkPoint, enemyPredictions[t], 
      playerRadius, safetyBuffer, avoidCrossingPaths
    );
    
    // If we transition from unsafe to safe, waiting is beneficial
    if (!currentlySafe && willBeSafe) {
      return true;
    }
    
    currentlySafe = willBeSafe;
  }
  
  return false;
}

// Check if a position is safe (not too close to any enemy)
function isPositionSafe(pos, enemyPositions, playerRadius, safetyBuffer) {
  for (const enemy of enemyPositions) {
    const dx = pos.x - enemy.x;
    const dy = pos.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < (enemy.radius + playerRadius) * safetyBuffer) {
      return false;
    }
  }
  
  return true;
}

// Find the safest immediate direction to move
function findSafestImmediateDirection(start, goal, enemies, playerRadius, options) {
  const { width, height, safetyBuffer, progressiveStepSize, avoidCrossingPaths } = options;
  
  // Analyze all possible directions
  const numDirections = 36; // Every 10 degrees
  let bestDirection = null;
  let bestScore = -Infinity;
  
  // Direction to goal
  const dxToGoal = goal.x - start.x;
  const dyToGoal = goal.y - start.y;
  const distToGoal = Math.sqrt(dxToGoal * dxToGoal + dyToGoal * dyToGoal);
  const angleToGoal = Math.atan2(dyToGoal, dxToGoal);
  
  for (let i = 0; i < numDirections; i++) {
    const angle = (i * 2 * Math.PI) / numDirections;
    
    // Create multiple candidate positions at different distances
    const candidateDistances = [
      progressiveStepSize / 4,
      progressiveStepSize / 3,
      progressiveStepSize / 2,
      progressiveStepSize
    ];
    
    for (const distance of candidateDistances) {
      const newPos = {
        x: start.x + Math.cos(angle) * distance,
        y: start.y + Math.sin(angle) * distance
      };
      
      // Check bounds
      if (newPos.x < playerRadius || newPos.x > width - playerRadius ||
          newPos.y < playerRadius || newPos.y > height - playerRadius) {
        continue;
      }
      
      // Check if path is safe
      if (!isPathSafeAtTime(start, newPos, enemies, playerRadius, safetyBuffer, avoidCrossingPaths)) {
        continue;
      }
      
      // Calculate score based on:
      // 1. Minimum distance to enemies (safety)
      // 2. Progress toward goal (efficiency)
      // 3. Angle difference from goal direction (prefer routes that don't turn away)
      
      // Safety score - minimum distance to any enemy
      let minDistToEnemy = Infinity;
      for (const enemy of enemies) {
        const dx = newPos.x - enemy.x;
        const dy = newPos.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy) - enemy.radius - playerRadius;
        minDistToEnemy = Math.min(minDistToEnemy, dist);
      }
      
      // Progress score - dot product of movement vector with direction to goal
      const moveX = newPos.x - start.x;
      const moveY = newPos.y - start.y;
      const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
      
      // Normalized dot product (-1 to 1)
      const progressScore = distToGoal > 0 ? 
        (moveX * dxToGoal + moveY * dyToGoal) / (moveDist * distToGoal) : 0;
      
      // Angle difference score
      const moveAngle = Math.atan2(moveY, moveX);
      const angleDiff = Math.abs(
        Math.atan2(
          Math.sin(moveAngle - angleToGoal),
          Math.cos(moveAngle - angleToGoal)
        )
      );
      
      // Check if we'd be moving perpendicular to enemy paths when avoidCrossingPaths is enabled
      let crossingScore = 0;
      if (avoidCrossingPaths) {
        let minCrossingAngle = Math.PI / 2; // 90 degrees (perpendicular)
        
        for (const enemy of enemies) {
          if (enemy.vel && (Math.abs(enemy.vel.x) > 0.1 || Math.abs(enemy.vel.y) > 0.1)) {
            // Get enemy movement direction
            const enemyDir = Math.atan2(enemy.vel.y, enemy.vel.x);
            // Get candidate movement direction
            const moveDir = Math.atan2(moveY, moveX);
            
            // Calculate angle between movement directions
            const crossAngle = Math.abs(
              Math.atan2(
                Math.sin(enemyDir - moveDir),
                Math.cos(enemyDir - moveDir)
              )
            );
            
            // Prefer paths that are more parallel (0) or opposite (PI) to enemy paths
            // rather than perpendicular (PI/2)
            const angleFromPerp = Math.abs(crossAngle - Math.PI/2);
            minCrossingAngle = Math.min(minCrossingAngle, angleFromPerp);
          }
        }
        
        // Convert to a score from 0 to 1
        crossingScore = minCrossingAngle / (Math.PI/2);
      }
      
      // Combined score with safety as priority
      const score = minDistToEnemy * 2 + 
                   progressScore * distance * 1.5 + 
                   (1 - angleDiff / Math.PI) * distance +
                   crossingScore * distance;
      
      if (score > bestScore) {
        bestScore = score;
        bestDirection = newPos;
      }
    }
  }
  
  if (bestDirection) {
    return [bestDirection];
  }
  
  // Last resort - find position with maximum distance from any enemy
  let maxMinDist = -Infinity;
  let safestPos = null;
  
  for (let i = 0; i < numDirections; i++) {
    const angle = (i * 2 * Math.PI) / numDirections;
    const newPos = {
      x: start.x + Math.cos(angle) * (progressiveStepSize / 5), // Very short movement
      y: start.y + Math.sin(angle) * (progressiveStepSize / 5)
    };
    
    // Check bounds
    if (newPos.x < playerRadius || newPos.x > width - playerRadius ||
        newPos.y < playerRadius || newPos.y > height - playerRadius) {
      continue;
    }
    
    // Find minimum distance to any enemy
    let minDist = Infinity;
    for (const enemy of enemies) {
      const dx = newPos.x - enemy.x;
      const dy = newPos.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy) - enemy.radius - playerRadius;
      minDist = Math.min(minDist, dist);
    }
    
    if (minDist > maxMinDist) {
      maxMinDist = minDist;
      safestPos = newPos;
    }
  }
  
  if (safestPos) {
    return [safestPos];
  }
  
  // If we really can't find any safe direction, return empty path
  return [];
} 