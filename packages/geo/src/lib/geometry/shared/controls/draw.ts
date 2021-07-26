import OlMap from 'ol/Map';
import OlFeature from 'ol/Feature';
import OlStyle from 'ol/style';
import type { default as OlGeometryType } from 'ol/geom/GeometryType';
import OlVectorSource from 'ol/source/Vector';
import OlVectorLayer from 'ol/layer/Vector';
import OlDraw from 'ol/interaction/Draw';
import OlModify from 'ol/interaction/Modify';
import OlSnap from 'ol/interaction/Snap';
import {
  Geometry as OlGeometry,
  GeometryEvent as OlGeometryEvent
} from 'ol/geom/Geometry';
import { DrawEvent as OlDrawEvent } from 'ol/interaction/Draw';
import { unByKey } from 'ol/Observable';

import { Subject, Subscription, fromEvent, BehaviorSubject } from 'rxjs';

import { getMousePositionFromOlGeometryEvent } from '../geometry.utils';

export interface DrawControlOptions {
  geometryType: OlGeometryType | undefined;
  drawingLayerSource?: OlVectorSource;
  drawingLayer?: OlVectorLayer;
  drawingLayerStyle?: OlStyle | ((olfeature: OlFeature) => OlStyle);
  interactionStyle?: OlStyle | ((olfeature: OlFeature) => OlStyle);
  maxPoints?: number;
}

/**
 * Control to draw geometries
 */
export class DrawControl {

  /**
   * Draw start observable
   */
  public start$: Subject<OlGeometry> = new Subject();

  /**
   * Draw end observable
   */
  public end$: Subject<OlGeometry> = new Subject();

  /**
   * Geometry changes observable
   */
  public changes$: Subject<OlGeometry> = new Subject();

  private olMap: OlMap;
  private olGeometryType: OlGeometryType;
  private olDrawingLayerSource: OlVectorSource;
  private olDrawingLayer: OlVectorLayer;
  private olDrawingLayerStyle: OlStyle;
  private olInteractionStyle: OlStyle;
  private olMaxPoints: number;

  private olDrawInteraction: OlDraw;
  private olModifyInteraction: OlModify;
  private olSnapInteraction: OlSnap;

  private onDrawStartKey: string;
  private onDrawEndKey: string;
  private onDrawKey: string;

  private mousePosition: [number, number];

  private keyDown$$: Subscription;

  freehand$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(private options: DrawControlOptions) {
    this.olGeometryType = options.geometryType;
    options.drawingLayerSource ? this.olDrawingLayerSource = options.drawingLayerSource : this.olDrawingLayerSource = new OlVectorSource();
    options.drawingLayer ? this.olDrawingLayer = options.drawingLayer : this.olDrawingLayer = this.createOlDrawingLayer();
    this.olDrawingLayerStyle = options.drawingLayerStyle;
    options.interactionStyle ? this.olInteractionStyle = options.interactionStyle : this.olInteractionStyle = this.olDrawingLayerStyle;
    options.maxPoints ? this.olMaxPoints = options.maxPoints : this.olMaxPoints = undefined;
  }

  getDrawingLayerSource(): OlVectorSource {
    return this.olDrawingLayerSource();
  }

  /**
   * Add control to map
   * @param olMap OL Map
   */
  setOlMap(olMap: OlMap) {
    this.olMap = olMap;
    this.addOlInteractions();
  }

  /**
   * Remove control from map
   */
  unsetOlMap() {
    this.removeOlInteractions();
    this.olMap = undefined;
  }

  /**
   * Set geometry type
   * @param geometryType geometry type
   */
  setGeometryType(geometryType: OlGeometryType) {
    this.olGeometryType = geometryType;
  }

  /**
   * Create a drawing layer if none is defined in the options
   * @returns a vector layer
   */
  private createOlDrawingLayer(): OlVectorLayer {
    const olVectorLayer = new OlVectorLayer({
      source: this.olDrawingLayerSource,
      style: this.olDrawingLayerStyle,
      zIndex: 500
    });

    return olVectorLayer;
  }

  /**
   * Clear the drawing layer source if it wasn't defined in the options
   */
  private clearOlDrawingLayerSource() {
    if (!this.options.drawingLayer && !this.options.drawingLayerSource) {
      this.olDrawingLayerSource.clear(true);
    }
  }

  /**
   * Add interactions to the map ans set up listeners
   */
  addOlInteractions() {
    let olDrawInteraction;
    if (!this.freehand$.getValue()) {
      olDrawInteraction = new OlDraw({
        type: this.olGeometryType,
        source: this.olDrawingLayerSource,
        stopClick: true,
        style: this.olInteractionStyle,
        maxPoints: this.olMaxPoints,
        freehand: false,
        freehandCondition: () => false
      });

    } else {
      olDrawInteraction = new OlDraw({
        type: this.olGeometryType,
        source: this.olDrawingLayerSource,
        maxPoints: this.olMaxPoints,
        freehand: true
      });
    }

    this.olMap.addInteraction(olDrawInteraction);
    this.olDrawInteraction = olDrawInteraction;

    const olModifyInteraction = new OlModify({
      source: this.olDrawingLayerSource
    });
    this.olMap.addInteraction(olModifyInteraction);
    this.olModifyInteraction = olModifyInteraction;

    const olSnapInteraction = new OlSnap({
      source: this.olDrawingLayerSource
    });
    this.olMap.addInteraction(olSnapInteraction);
    this.olSnapInteraction = olSnapInteraction;

    this.onDrawStartKey = olDrawInteraction.on('drawstart', (event: OlDrawEvent) => this.onDrawStart(event));
    this.onDrawEndKey = olDrawInteraction.on('drawend', (event: OlDrawEvent) => this.onDrawEnd(event));
  }

  /**
   * Remove the draw interaction
   */
  private removeOlInteractions() {
    if (!this.olDrawInteraction) {
      return;
    }

    this.unsubscribeKeyDown();
    unByKey([this.onDrawStartKey, this.onDrawEndKey, this.onDrawKey]);
    if (this.olMap) {
      this.olMap.removeInteraction(this.olDrawInteraction);
      this.olMap.removeInteraction(this.olModifyInteraction);
      this.olMap.removeInteraction(this.olSnapInteraction);
    }

    this.olDrawInteraction = undefined;
    this.olModifyInteraction = undefined;
    this.olSnapInteraction = undefined;
  }

  /**
   * When drawing starts, clear the overlay and start watching from changes
   * @param event Draw start event
   */
  private onDrawStart(event: OlDrawEvent) {
    const olGeometry = event.feature.getGeometry();
    this.start$.next(olGeometry);
    this.clearOlDrawingLayerSource();
    this.onDrawKey = olGeometry.on('change', (olGeometryEvent: OlGeometryEvent) => {
      this.mousePosition = getMousePositionFromOlGeometryEvent(olGeometryEvent);
      this.changes$.next(olGeometryEvent.target);
    });

    this.subscribeKeyDown();
  }

  /**
   * When drawing ends, update the geometry observable and start watching from changes
   * @param event Draw end event
   */
  private onDrawEnd(event: OlDrawEvent) {
    this.unsubscribeKeyDown();
    unByKey(this.onDrawKey);
    this.end$.next(event.feature.getGeometry());
  }

  /**
   * Subscribe to key down to activate interaction options
   */
  private subscribeKeyDown() {
    this.unsubscribeKeyDown();
    this.keyDown$$ = fromEvent(document, 'keydown').subscribe((event: KeyboardEvent) => {
      // On 'u' key down, remove the last vertex
      if (event.key === 'u') {
        this.olDrawInteraction.removeLastPoint();
        return;
      }

      // On ESC key down or 'c' key down, abort drawing
      if (event.key === 'Escape' || event.key === 'c') {
        this.olDrawInteraction.abortDrawing();
        return;
      }

      // On 'f' key down, finish drawing
      if (event.key === 'f') {
        this.olDrawInteraction.finishDrawing();
        return;
      }

      // On space bar key down or 'c', pan to the current mouse position
      if (event.key === ' ') {
        this.olMap.getView().animate({
          center: this.mousePosition,
          duration: 100
        });
        return;
      }
    });
  }

  /**
   * Unsubscribe to key down
   */
  private unsubscribeKeyDown() {
    if (this.keyDown$$) {
      this.keyDown$$.unsubscribe();
      this.keyDown$$ = undefined;
    }
  }
}
