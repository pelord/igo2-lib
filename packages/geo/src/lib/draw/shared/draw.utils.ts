import * as OlStyle from 'ol/style';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlPolygon from 'ol/geom/Polygon';
import OlCircle from 'ol/geom/Circle';
import OlOverlay from 'ol/Overlay';
import { olColor as OlColor } from 'ol/color';
import {
  updateOlGeometryMidpoints,
  updateOlGeometryCenter
} from '../../measure/shared/measure.utils';


/**
 * Create a style for the drawing layer
 * @param fillColor the fill color of the geometry (ex. 'rgba(255,0,0,1)')
 * @param strokeColor the stroke color of the geometry (ex. 'rgba(255,0,0,1)')
 * @param label the label of the geometry
 * @returns OL Style
 */
export function createDrawingLayerStyle(fillColor?: OlColor, strokeColor?: OlColor, label?: string): OlStyle.Style {
  let olStyle: OlStyle.Style;
  olStyle = new OlStyle.Style({
    stroke: new OlStyle.Stroke({
      color: strokeColor ? strokeColor : 'rgba(25,118,210,1)',
      width: 2
    }),

    fill: new OlStyle.Fill({
      color: fillColor ? fillColor : 'rgba(255,255,255,0.4)'
    }),

    text: new OlStyle.Text({
      text: label ? label : ''
    }),

    image: new OlStyle.Circle({
      radius: 5,
      stroke: new OlStyle.Stroke({
        color: strokeColor ? strokeColor : 'rgba(25,118,210,1)',
        width: 2
      }),

      fill: new OlStyle.Fill({
        color: fillColor ? fillColor : 'rgba(255,255,255,0.4)'
      })
    })
  });

  return olStyle;
}

/**
 * Add an OL overlay at each midpoint and return an array of those overlays
 * @param olGeometry OL Geometry
 * @returns OL overlays
 */
export function updateOlTooltipsDrawAtMidpoints(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle): OlOverlay[] {
  let olMidpoints;
  if (olGeometry instanceof OlPoint) {
    const olMidpointPoint = new OlPoint(olGeometry.flatCoordinates);
    olMidpoints = new Array(1);
    olMidpoints[0] = olMidpointPoint;
    olGeometry.setProperties({_midpoints: olMidpoints}, true);
  } else if (olGeometry instanceof OlCircle) {
    const olMidpointPoint = new OlPoint(olGeometry.getCenter());
    olMidpoints = new Array(1);
    olMidpoints[0] = olMidpointPoint;
    olGeometry.setProperties({_midpoints: olMidpoints}, true);
  } else  {
    olMidpoints = updateOlGeometryMidpoints(olGeometry);
  }
  const olTooltips = olMidpoints.map((olMidpoint: OlPoint) => {
    let olTooltip = olMidpoint.get('_tooltip');
    if (olTooltip === undefined) {
      olTooltip = createOlTooltipDrawAtPoint(olMidpoint);
    } else {
      olTooltip.setPosition(olMidpoint.flatCoordinates);
    }
    return olTooltip;
  });
  return olTooltips;
}

/**
 * Add an OL overlay at the center of a geometry and return that overlay
 * @param olGeometry OL Geometry
 * @returns OL overlay
 */
export function updateOlTooltipDrawAtCenter(olGeometry: OlLineString | OlPolygon): OlOverlay {
  const olCenter = updateOlGeometryCenter(olGeometry);
  let olTooltip = olCenter.get('_tooltip');
  if (olTooltip === undefined) {
    olTooltip = createOlTooltipDrawAtPoint(olCenter);
  } else {
    olTooltip.setPosition(olCenter.flatCoordinates);
  }
  return olTooltip;
}

/**
 * Create an OL overlay at a point and bind the overlay to the point
 * @param olPoint OL Point
 * @returns OL overlay
 */
export function createOlTooltipDrawAtPoint(olPoint: OlPoint): OlOverlay {
  const olTooltip = new OlOverlay({
    element: document.createElement('div'),
    offset: [-30, -10],
    className: [
      'igo-map-tooltip',
      'igo-map-tooltip-draw'
    ].join(' '),
    stopEvent: false
  });
  olTooltip.setPosition(olPoint.flatCoordinates);
  olPoint.set('_tooltip', olTooltip);

  return olTooltip;
}
