import { ProjectionLike } from 'ol/proj';

export interface MapGeolocationControllerOptions {
  //  todo keepPositionHistory?: boolean;
  projection: ProjectionLike;
  accuracyThreshold?: number;
  followPosition?: boolean;
  buffer?: GeolocationBuffer;
}

export interface MapGeolocationState {
  position: number[];
  projection: string;
  accuracy: number;
  altitude: number;
  altitudeAccuracy: number;
  heading: number;
  speed: number;
  enableHighAccuracy: boolean;
  timestamp: Date;
}
export interface GeolocationBuffer {
  bufferRadius?: number;
  bufferStroke?: [number, number, number, number];
  bufferFill?: [number, number, number, number];
  showBufferRadius?: boolean;
}

export enum GeolocationOverlayType {
  Position = 'position',
  PositionDirection = 'positionDirection',
  Accuracy = 'accuracy',
  Buffer = 'buffer'
}
