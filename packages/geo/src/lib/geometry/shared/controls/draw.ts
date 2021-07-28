import OlMap from 'ol/Map';
import OlFeature from 'ol/Feature';
import OlStyle from 'ol/style';
import type { default as OlGeometryType } from 'ol/geom/GeometryType';
import OlVectorSource from 'ol/source/Vector';
import OlDraw from 'ol/interaction/Draw';
import OlModify from 'ol/interaction/Modify';
import OlSnap from 'ol/interaction/Snap';
import {
  Geometry as OlGeometry,
  GeometryEvent as OlGeometryEvent
} from 'ol/geom/Geometry';
import {
  DrawEvent as OlDrawEvent,
  createRegularPolygon as OlCreateRegularPolygon } from 'ol/interaction/Draw';
import { ModifyEvent as OlModifyEvent } from 'ol/interaction/Modify';
import { unByKey } from 'ol/Observable';

import { Subject, Subscription, fromEvent, BehaviorSubject } from 'rxjs';

import { getMousePositionFromOlGeometryEvent } from '../geometry.utils';

export interface DrawControlOptions {
  geometryType: OlGeometryType | undefined;
  drawingLayerSource?: OlVectorSource;
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

  public modifyChanges$: Subject<OlGeometry> = new Subject();

  private olMap: OlMap;
  private olGeometryType: OlGeometryType;
  private olDrawingLayerSource: OlVectorSource;
  private olDrawingLayerStyle: OlStyle;
  private olInteractionStyle: OlStyle;
  private olMaxPoints: number;

  private olDrawInteraction: OlDraw;
  private olModifyInteraction: OlModify;
  private olSnapInteraction: OlSnap;

  private onDrawStartKey: string;
  private onDrawEndKey: string;
  private onDrawChangeKey: string;
  private onModifyChangeKey: string;

  private mousePosition: [number, number];

  private keyDown$$: Subscription;

  freehand$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(private options: DrawControlOptions) {
    this.olGeometryType = options.geometryType;
    options.drawingLayerSource ? this.olDrawingLayerSource = options.drawingLayerSource : this.olDrawingLayerSource = new OlVectorSource();
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
   * Clear the drawing layer source if it wasn't defined in the options
   */
  private clearOlDrawingLayerSource() {
    if (!this.options.drawingLayerSource) {
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
        geometryFunction: this.olGeometryType === 'Circle' ? OlCreateRegularPolygon(1000) : undefined,
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
        geometryFunction: this.olGeometryType === 'Circle' ? OlCreateRegularPolygon(1000) : undefined,
        maxPoints: this.olMaxPoints,
        freehand: true
      });
    }

    // Add Draw interaction
    this.olMap.addInteraction(olDrawInteraction);
    this.olDrawInteraction = olDrawInteraction;

    // Add Modify interaction
    let olModifyInteraction = new OlModify({
      source: this.olDrawingLayerSource
    });
    this.olMap.addInteraction(olModifyInteraction);
    this.olModifyInteraction = olModifyInteraction;

    // Add Snap interaction
    const olSnapInteraction = new OlSnap({
      source: this.olDrawingLayerSource
    });
    this.olMap.addInteraction(olSnapInteraction);
    this.olSnapInteraction = olSnapInteraction;

    this.onDrawStartKey = olDrawInteraction.on('drawstart', (event: OlDrawEvent) => this.onDrawStart(event));
    this.onDrawEndKey = olDrawInteraction.on('drawend', (event: OlDrawEvent) => this.onDrawEnd(event));
    this.onModifyChangeKey = olModifyInteraction.on('modifyend', (event: OlModifyEvent) => this.onModifyGeom(event));
  }

  /**
   * Remove interactions
   */
  removeOlInteractions() {
    if (!this.olDrawInteraction) {
      return;
    }

    this.unsubscribeKeyDown();
    unByKey([this.onDrawStartKey, this.onDrawEndKey, this.onDrawChangeKey]);
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
    //this.clearOlDrawingLayerSource();
    this.onDrawChangeKey = olGeometry.on('change', (olGeometryEvent: OlGeometryEvent) => {
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
    unByKey(this.onDrawChangeKey);
    console.log(event.feature.getGeometry())
    this.end$.next(event.feature.getGeometry());
  }

  private onModifyGeom(event: OlModifyEvent) {
    this.modifyChanges$.next(event.features);
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
