import { Enemy } from './Enemy';

export const entityTypes = ["normal"];

export class Normal extends Enemy {
  constructor(pos, radius, speed, angle) {
    super(pos, entityTypes.indexOf("normal"), radius, speed, angle, "#939393");
  }
} 