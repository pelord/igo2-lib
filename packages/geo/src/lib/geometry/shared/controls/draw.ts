import OlMap from 'ol/Map';
import OlFeature from 'ol/Feature';
import * as OlStyle from 'ol/style';
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
  layerSource?: OlVectorSource;
  layer?: OlVectorLayer;
  layerStyle?: OlStyle | ((olfeature: OlFeature) => OlStyle); // Style of drawn features
  interactionStyle?: OlStyle | ((olfeature: OlFeature) => OlStyle);  // Style while drawing features
  maxPoints?: number;
}

/**
 * Control to draw geometries
 */
export class DrawControl {
  /**
   * Drawing start observable
   */
  public start$: Subject<OlGeometry> = new Subject();

  /**
   * Drawing end observable
   */
  public end$: Subject<OlGeometry> = new Subject();

  /**
   * Geometry changes observable
   */
  public changes$: Subject<OlGeometry> = new Subject();

  /**
   * Freehand mode observable
   */
  public freehand$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  private olMap: OlMap;
  private drawingGeometryType: OlGeometryType;
  private drawingLayerSource: OlVectorSource;
  private drawingLayer: OlVectorLayer;
  private drawingLayerStyle: OlStyle | ((olfeature: OlFeature) => OlStyle);
  private drawingInteractionStyle: OlStyle | ((olfeature: OlFeature) => OlStyle);
  private drawingMaxPoints: number;

  private olDrawInteraction: OlDraw;
  private olSnapInteraction: OlSnap;
  private olModifyInteraction: OlModify;

  private drawingStartKey: string;
  private drawingEndKey: string;
  private drawingKey: string;

  private mousePosition: [number, number];

  private keyDown$$: Subscription;

  /**
   * Returns geometry type from options
   * @internal
   */
  get geometryType(): OlGeometryType | undefined {
    return this.options.geometryType;
  }

  /**
   * Returns OL drawing layer source from options
   * @internal
   */
  get layerSource(): OlVectorSource {
    return this.options.layerSource;
  }

  /**
   * Returns OL drawing layer from options
   * @internal
   */

  get layer(): OlVectorLayer {
    return this.options.layer;
  }

  /**
   * Returns layer style from options
   * @internal
   */
  get layerStyle(): OlStyle | ((olfeature: OlFeature) => OlStyle) {
    return this.options.layerStyle;
  }

  /**
   * Returns OL drawing style from options
   * @internal
   */
  get interactionStyle(): OlStyle | ((olfeature: OlFeature) => OlStyle) {
    return this.options.interactionStyle;
  }

  /**
   * Returns max number of points for a given drawing from options
   * @internal
   */
  get maxPoints(): number {
    return this.options.maxPoints;
  }

  constructor(private options: DrawControlOptions) {
    this.drawingGeometryType = this.geometryType;
    this.layerSource ? this.drawingLayerSource = this.layerSource : new OlVectorSource();
    this.drawingLayerStyle = this.layerStyle;
    this.layer ? this.drawingLayer = this.layer : this.drawingLayer = this.createDrawingLayer();
    this.drawingInteractionStyle = this.interactionStyle;
    this.maxPoints ? this.drawingMaxPoints = this.maxPoints : this.drawingMaxPoints = undefined;
  }

  getDrawingLayerSource(): OlVectorSource {
    console.log('getDrawingLayerSource')
    return this.drawingLayerSource;
  }

  setDrawingGeometryType(geometryType: OlGeometryType) {
    console.log('setDrawingGeometryType')
    this.drawingGeometryType = geometryType;
  }

  setOlMap(olMap: OlMap | undefined) {
    console.log('setOlMap')
    this.olMap = olMap;
  }

  /**
   * Add control to map
   * @param olMap OL Map
   */
  setInteractions() {
    console.log('setInteractions')
    this.removeInteractions();
    this.addInteractions();
  }

  /**
   * Remove control from map
   */
  unsetOlMap() {
    console.log('unsetOlMap')
    this.clearDrawingLayerSource();
    this.clearDrawingLayer();
    this.removeInteractions();
    this.olMap = undefined;
  }

  /**
   * Create a drawing layer (if none is specified in options)
   */
  private createDrawingLayer(): OlVectorLayer {
    console.log('crateDrawingLayer')
    return new OlVectorLayer({
      source: this.drawingLayerSource,
      style: this.drawingLayerStyle,
      zIndex: 500
    });
  }

  /**
   * Clear the OL drawing layer if it wasn't given in the options of of layer source and layer style weren't given
   */
  private clearDrawingLayer() {
    console.log('clearDreawingLayer')
    if (this.olMap && !this.layer) {
      this.olMap.removeLayer(this.drawingLayer);
    }
  }

  /**
   * Clear the OL drawing layer source if it wasn't defined in the options
   */
  private clearDrawingLayerSource() {
    console.log('clearDrawingLayerSource')
    if (!this.layerSource && !this.layer) {
      this.drawingLayerSource.clear(true);
    }
  }

  /**
   * Add interactions to the map an set up some listeners
   */
  addInteractions() {
    console.log('addInteractions')
    //Initialize drawing interaction
    const olDrawInteraction = new OlDraw({
      type: this.drawingGeometryType,
      source: this.drawingLayerSource,
      stopClick: true,
      maxPoints: this.drawingMaxPoints,
      style: this.drawingInteractionStyle,
      freehand: false,
      freehandCondition: () => false
    });
    console.log(olDrawInteraction);
    this.olMap.addInteraction(olDrawInteraction);

    // Listen to when starting and ending drawing and corresponding methods
    this.drawingStartKey = olDrawInteraction.on('drawstart', (event: OlDrawEvent) => this.onDrawStart(event));
    this.drawingEndKey = olDrawInteraction.on('drawend', (event: OlDrawEvent) => this.onDrawEnd(event));

    // Initiate drawing, modify, snapping and select interactions
    const olModifyInteraction = new OlModify({
      source: this.drawingLayerSource
    });
    this.olMap.addInteraction(olModifyInteraction)

    const olSnapInteraction = new OlSnap({
      source: this.drawingLayerSource
    });
    this.olMap.addInteraction(olSnapInteraction)

    this.olDrawInteraction = olDrawInteraction;
    this.olSnapInteraction = olSnapInteraction;
    this.olModifyInteraction = olModifyInteraction;
  }

  /**
   * Remove the interactions
   */
  private removeInteractions() {
    console.log('removeInteractions')
    this.unsubscribeKeyDown();
    unByKey([this.drawingStartKey, this.drawingEndKey, this.drawingKey]);
    if (this.olMap) {
      this.olMap.removeInteraction(this.olDrawInteraction);
      this.olMap.removeInteraction(this.olSnapInteraction);
      this.olMap.removeInteraction(this.olModifyInteraction);
    }

    this.olDrawInteraction = undefined;
    this.olSnapInteraction = undefined;
    this.olModifyInteraction = undefined;
  }

  /**
   * When drawing starts, clear the overlay and start watching from changes
   * @param event Draw start event
   */
  private onDrawStart(event: OlDrawEvent) {
    console.log('onDrawStart')
    const olGeometry = event.feature.getGeometry();
    this.start$.next(olGeometry);
    this.clearDrawingLayerSource();
    this.drawingKey = olGeometry.on('change', (olGeometryEvent: OlGeometryEvent) => {
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
    console.log('onDrawEnd')
    this.unsubscribeKeyDown();
    unByKey(this.drawingKey);
    this.end$.next(event.feature.getGeometry());
  }

  /**
   * Subscribe to key down for certain actions
   */
  private subscribeKeyDown() {
    console.log('subscribeKeyDown')
    this.unsubscribeKeyDown();
    this.keyDown$$ = fromEvent(document, 'keydown').subscribe(
      (event: KeyboardEvent) => {
        // On 'u' key down, remove the last vertex
        if (event.key === 'u') {
          this.olDrawInteraction.removeLastPoint();
          return;
        }

        // On space bar key down, pan to the current mouse position
        if (event.key === ' ') {
          this.olMap.getView().animate({
            center: this.mousePosition,
            duration: 100
          });
          return;
        }

        // On ESC or 'c' key down, abort drawing
        if (event.key === 'Escape' || event.key === 'c') {
          this.olDrawInteraction.abortDrawing();
          return;
        }

        // On 'f' key down, finish drawing
        if (event.key === 'f') {
          this.olDrawInteraction.finishDrawing();
          return;
        }
      }
    );
  }

  /**
   * Unsubscribe to key down
   */
  private unsubscribeKeyDown() {
    console.log('unsubscibeKeyDown')
    if (this.keyDown$$ !== undefined) {
      this.keyDown$$.unsubscribe();
      this.keyDown$$ = undefined;
    }
  }
}
