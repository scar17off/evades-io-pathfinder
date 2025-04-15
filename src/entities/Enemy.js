import { Entity } from './Entity';
import { interactionWithEnemy } from '../utils/Collisions';

export class Enemy extends Entity {
  constructor(pos, type, radius, speed, angle, color, aura, auraColor, auraSize) {
    super(pos, radius, color);
    this.renderFirst = false;
    this.outline = true;
    this.type = type || 0;
    this.aura = aura;
    this.auraColor = auraColor;
    this.auraSize = this.auraStaticSize = auraSize || 0;
    this.speed = speed;
    this.angle = angle === undefined ? this.getRandomAngle() : angle;
    this.angleToVel(angle);
    this.decayed = false;
    this.repelled = false;
    this.shatterTime = 0;
    this.immune = false;
    this.isEnemy = true;
    this.able_to_kill = true;
    this.self_destruction = false;
    this.projectile_outline = true;
    this.healing = 0;
    this.minimized = 0;
    this.HarmlessEffect = 0;
    this.appearing = false;
    this.slowdown_time = 0;
    this.slowdown_amount = 1;
    this.corrosive = false;
  }
  
  getRandomAngle(){
    return Math.random() * Math.PI * 2;
  }

  update(time) {
    const timeFix = time / (1000 / 30);
    
    this.radius = this.fixedRadius * this.radiusMultiplier;
    this.auraSize = this.auraStaticSize * this.radiusMultiplier;
    this.radiusMultiplier = 1;

    if (!this.noAngleUpdate) {
      this.velToAngle();
      this.angleToVel();
    }

    if (this.healing > 0) this.healing -= time;
    if (this.minimized > 0) {
      this.radiusMultiplier *= 0.5;
      this.minimized -= time;
    }
    if (this.HarmlessEffect > 0) {
      this.HarmlessEffect -= time;
      this.Harmless = this.HarmlessEffect > 0;
      if(this.appearing){
        if(this.HarmlessEffect <= 0){
          this.appearing = false;
        }
      }
    }

    let speedMult = this.speedMultiplier;
    if (this.slowdown_time > 0) {
      this.slowdown_time = Math.max(0, this.slowdown_time - time);
      speedMult *= this.slowdown_amount;
    }
    if (this.sugar_rush > 0) {
      speedMult *= 0.05;
      this.sugar_rush -= time;
    }

    if (this.freeze > 0) {
      this.freeze = Math.max(0, this.freeze - time);
    } else {
      this.pos.x += this.vel.x * speedMult / 32 * timeFix;
      this.pos.y += this.vel.y * speedMult / 32 * timeFix;
    }

    const dim = 1 - this.friction * timeFix;
    this.vel.x *= dim;
    this.vel.y *= dim;

    this.decayed = this.repelled = false;
    this.shatterTime = Math.max(0, this.shatterTime - time);
    this.speedMultiplier = 1;
  }

  interact(player, worldPos, time) {
    this.beforeInteract(player, worldPos, time);
    interactionWithEnemy(player, this, worldPos, true, this.corrosive, this.immune);
    if (this.aura && !player.isEffectImmune()) {
      this.auraEffect(player, worldPos, time);
    }
  }

  auraEffect(player, worldPos, time) {}
  beforeInteract(player, worldPos, time) {}
} 