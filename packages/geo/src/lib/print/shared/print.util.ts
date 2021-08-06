import * as olstyle from 'ol/style';
import * as olcolor from 'ol/color';

export function createFrameLayerStyle(color:string, alpha:number): olstyle.Style {
    return new olstyle.Style({
        stroke: new olstyle.Stroke({
            color: 'red',
            width: 2
        }),
        fill: new olstyle.Fill({
            color: colorWithalpha(color, alpha)
        })
    });
}
export function colorWithalpha(color:string, alpha: number){
    const [r, g, b] = Array.from(olcolor.asArray(color));
    return olcolor.asString([r, g, b, alpha]);
 }