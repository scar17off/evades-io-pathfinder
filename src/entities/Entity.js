import { Vector } from '../utils/Vector';
import { collisionEnemy } from '../utils/Collisions';

// a lot of this code was stolen from https://github.com/Pifary-dev/ravel/tree/main
// i really love them
export class Entity {
  constructor(pos, radius, color) {
    this.pos = pos;
    this.radius = this.fixedRadius = radius;
    this.color = color;
    this.vel = new Vector(0, 0);
    this.outline = false;
    this.speedMultiplier = this.radiusMultiplier = 1;
    this.angle = this.speed = this.friction = 0;
    this.weak = false;
    this.renderFirst = true;
    this.Harmless = false;
    this.immune = true;
    this.wall_push = true;
    this.isEnemy = false;
    this.toRemove = false;
    this.no_collide = false;
    this.returnCollision = false;
    this.projectile_outline = true;
    this.able_to_kill = true;
    this.freeze = 0;
    this.sugar_rush = 0;
    this.useRealVel = false;
    this.realVel = new Vector(0, 0);
    this.noAngleUpdate = false;
  }

  angleToVel(angle = this.angle) {
    const target = this.useRealVel ? this.realVel : this.vel;
    target.x = Math.cos(angle) * this.speed || 0;
    target.y = Math.sin(angle) * this.speed || 0;
  }

  velToAngle() {
    const source = this.useRealVel ? this.realVel : this.vel;
    this.angle = Math.atan2(source.y, source.x);
    if (!this.useRealVel) {
      this.speed = Math.hypot(source.x, source.y);
    }
  }

  update(time) {
    const timeFix = time / (1000 / 30);
    
    if (!this.noAngleUpdate) {
      this.velToAngle();
      this.angleToVel();
    }
    
    this.radius = this.fixedRadius * this.radiusMultiplier;
    this.radiusMultiplier = 1;
    
    const speedMult = this.speedMultiplier;
    
    if (this.freeze > 0) {
      this.freeze = Math.max(0, this.freeze - time);
    } else {
      this.pos.x += this.vel.x * speedMult / 32 * timeFix;
      this.pos.y += this.vel.y * speedMult / 32 * timeFix;
    }
    
    if (this.sugar_rush > 0) {
      this.speedMultiplier *= 0.05;
      this.sugar_rush -= time;
    }
    
    const dim = 1 - this.friction;
    this.vel.x *= dim;
    this.vel.y *= dim;
    
    this.speedMultiplier = 1;
  }

  collide(boundary) {
    collisionEnemy(this, boundary, this.vel, this.pos, this.radius, this.returnCollision);
  }

  behavior(time, area, offset, players) {}
  interact(player, worldPos) {}
  isHarmless(){
    return this.Harmless || this.disabled || this.clownHarm || this.healing > 0; 
  }
} 