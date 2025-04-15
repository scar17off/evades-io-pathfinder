export function collisionEnemy(entity, boundary, vel, pos, radius, returnCollision) {
  const boundaryLeft = 0;
  const boundaryRight = boundary.width;
  const boundaryTop = 0;
  const boundaryBottom = boundary.height;

  // Horizontal collision
  if (pos.x - radius < boundaryLeft) {
    pos.x = boundaryLeft + radius;
    vel.x = Math.abs(vel.x);
  } else if (pos.x + radius > boundaryRight) {
    pos.x = boundaryRight - radius;
    vel.x = -Math.abs(vel.x);
  }

  // Vertical collision
  if (pos.y - radius < boundaryTop) {
    pos.y = boundaryTop + radius;
    vel.y = Math.abs(vel.y);
  } else if (pos.y + radius > boundaryBottom) {
    pos.y = boundaryBottom - radius;
    vel.y = -Math.abs(vel.y);
  }
}

export function interactionWithEnemy(player, enemy, worldPos, checkCollision, corrosive, immune) {
  if (!checkCollision) return false;

  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const radiusSum = player.radius + enemy.radius;

  if (distance < radiusSum) {
    return true;
  }

  return false;
} 