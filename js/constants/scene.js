import { WATER_LEVEL } from './water.js';

// Viking ship placement, tweakable with lil-gui in debug mode
// the model is about 4.2 long (along z), 1.5 wide and 2.5 tall, with its keel at y = 0
export const SHIP_POSITION = { x: 5.7, y: WATER_LEVEL - 0.75, z: -15.8 };
// radians around the vertical axis: about 90° turns the bow from the camera to a side view
export const SHIP_ROTATION_Y = -0.87;
export const SHIP_SCALE = 3.65;
