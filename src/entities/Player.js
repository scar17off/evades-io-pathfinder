import { Entity } from './Entity';
import { Vector } from '../utils/Vector';

export class Player extends Entity {
  constructor(pos, radius, color) {
    super(pos, radius, color);
    this.outline = true;
    this.speedMultiplier = 1;
    this.immune = false;
    this.isPlayer = true;
    this.alive = true;
    this.targetPos = null;
    this.path = [];
    this.reachedWaypoint = false;
    this.waypointThreshold = 5;
    this.pathSwitchCooldown = 0;
    this.allowWaiting = true;
    this.isWaiting = false;
    this.waitTimeout = 0;
  }

  setTarget(target) {
    this.targetPos = target;
  }

  setPath(path) {
    if (path && path.length > 0) {
      if (path.length > 1) {
        const firstPoint = path[0];
        const dx = firstPoint.x - this.pos.x;
        const dy = firstPoint.y - this.pos.y;
        const distToFirst = Math.sqrt(dx * dx + dy * dy);

        if (distToFirst < this.waypointThreshold * 2) {
          path.shift();
        }
      }

      this.path = path.map(p => {
        if (p instanceof Vector) return p;
        return new Vector(p.x, p.y);
      });

      this.isWaiting = false;
      if (this.allowWaiting && this.path.length > 1) {
        for (let i = 1; i < this.path.length; i++) {
          if (Math.abs(this.path[i].x - this.path[i - 1].x) < 0.1 &&
            Math.abs(this.path[i].y - this.path[i - 1].y) < 0.1) {
            this.isWaiting = true;
            break;
          }
        }
      }
    }
    this.reachedWaypoint = false;
  }

  followPath(deltaTime) {
    if (this.path.length === 0) return false;
    if (this.pathSwitchCooldown > 0) {
      this.pathSwitchCooldown -= deltaTime;
    }

    const waypoint = this.path[0];
    const isWaitingPoint = this.path.length > 1 &&
      Math.abs(waypoint.x - this.path[1].x) < 0.1 &&
      Math.abs(waypoint.y - this.path[1].y) < 0.1;

    if (isWaitingPoint && this.allowWaiting) {
      const dx = waypoint.x - this.pos.x;
      const dy = waypoint.y - this.pos.y;
      const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);

      if (distanceToWaypoint < this.waypointThreshold) {
        this.isWaiting = true;
        this.speed = 0;
        this.pos.x = waypoint.x;
        this.pos.y = waypoint.y;
        this.path.shift();
        this.reachedWaypoint = true;
        return this.path.length > 0;
      } else {
        this.angle = Math.atan2(dy, dx);
        this.angleToVel();
        this.isWaiting = false;
      }
    } else {
      const dx = waypoint.x - this.pos.x;
      const dy = waypoint.y - this.pos.y;
      const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);

      if (distanceToWaypoint < this.waypointThreshold) {
        this.path.shift();
        this.reachedWaypoint = true;
        this.pathSwitchCooldown = 100;
        this.isWaiting = false;
        return this.path.length > 0;
      }
      
      this.angle = Math.atan2(dy, dx);
      this.angleToVel();
      this.isWaiting = false;
    }
    return true;
  }

  update(deltaTime) {
    if (this.path.length > 0) {
      this.followPath(deltaTime);
    }
    super.update(deltaTime);
  }
}