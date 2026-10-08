import { WATER_LEVEL } from './water.js';

// Viking ship placement, tweakable with lil-gui in debug mode
// the model is about 4.2 long (along z), 1.5 wide and 2.5 tall, with its keel at y = 0
export const SHIP_POSITION = { x: 5.7, y: WATER_LEVEL - 0.75, z: -15.8 };
// radians around the vertical axis: about 90° turns the bow from the camera to a side view
export const SHIP_ROTATION_Y = -0.87;
export const SHIP_SCALE = 3.65;

// fake reflection of the ship: a soft dark patch on the water under it, sized for SHIP_SCALE 1
// (half width and half length of the patch, the hull is about 0.75 by 2.1)
export const SHIP_REFLECTION = { strength: 0.8, width: 1, length: 2.4 };

// slow rocking on the calm water, as subtle as the ripples (angles in radians, bob in model units)
// roll tips it side to side, pitch bow to stern, bob moves it up and down
export const SHIP_ROCKING = { roll: 0.03, pitch: 0.012, bob: 0.03, speed: 0.6 };
