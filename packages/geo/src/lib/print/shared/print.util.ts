import * as olstyle from 'ol/style';
export function createFrameLayerStyle(): olstyle.Style {
    return new olstyle.Style({
        stroke: new olstyle.Stroke({
            color: 'red',
            width: 2
        }),
        fill: new olstyle.Fill({
            color: 'gold',
            opacity: 0.3
        })
    });
}