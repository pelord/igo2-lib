import { olColor as OlColor } from 'ol/color';
import { Injectable } from '@angular/core';

import * as OlStyle from 'ol/style';
import OlPoint from 'ol/geom/Point';
import { transform } from 'ol/proj';
import { MapService } from '../../map/shared/map.service';

@Injectable({
    providedIn: 'root'
  })
export class DrawStyleService {
  private fillColor: string = 'rgba(255,255,255,0.4)';
  private strokeColor: string = 'rgba(25,118,210,1)';
  private strokeWidth: number = 2;
  private drawCount: number = 1;
  private toggleLabel: boolean = true;
  private icon: string;

  constructor(
    private mapService: MapService
  ) {}

  getFillColor(): OlColor {
    return this.fillColor;
  }

  setFillColor(fillColor: OlColor) {
    this.fillColor = fillColor;
  }

  getStrokeColor(): OlColor {
    return this.strokeColor;
  }

  setStrokeColor(strokeColor: OlColor) {
    this.strokeColor = strokeColor;
  }

  getStrokeWidth(): number {
    return this.strokeWidth;
  }

  setStrokeWidth(strokeWidth: number) {
    this.strokeWidth = strokeWidth;
  }

  getDrawCount(): number {
    return this.drawCount;
  }

  incrementDrawCount() {
    this.drawCount = this.drawCount + 1;
  }

  getToggleLabel() {
    return this.toggleLabel;
  }

  switchLabel() {
    this.toggleLabel = !this.toggleLabel;
  }

  setIcon(icon: string) {
    this.icon = icon;
  }

  getIcon() {
    return this.icon;
  }

  createDrawLayerStyle(feature, resolution, showLabels?: boolean, icon?: string): OlStyle.Style {
    let style: OlStyle.Style;

    let labelOffset: boolean = false;
    const proj: string = this.mapService.getMap().ol.getView().getProjection().getCode();
    const geom = feature.getGeometry();

    if (geom instanceof OlPoint) {
      labelOffset = !labelOffset;
    }
    /**
    if (feature.get('radius') !== undefined) {
      const coordinates = transform(feature.getGeometry().flatCoordinates, proj, 'EPSG:4326');

      style = {
        text: new OlStyle.Text({
          text: showLabels ? feature.get('draw') : '',
          stroke: new OlStyle.Stroke({
            color: 'white',
            width: 0.75
          }),
          fill: new OlStyle.Fill({
            color: 'black'
          }),
          font: '20px sans-serif',
          overflow: true
        }),
        image: new OlStyle.Circle({
          radius: feature.get('radius') / Math.cos((Math.PI / 180) * coordinates[1]) / resolution,
          stroke: new OlStyle.Stroke({
            color: this.strokeColor
          }),
          fill: new OlStyle.Fill({
            color: this.fillColor
          })
        })
      }

      return style;

      }*/ if (icon) {
        style = new OlStyle.Style({
          text: new OlStyle.Text({
            text: showLabels ? feature.get('draw') : '',
            offsetY: -26,
            stroke: new OlStyle.Stroke({
              color: 'white',
              width: 0.75
            }),
            fill: new OlStyle.Fill({
              color: 'black'
            }),
            font: '20px sans-serif',
            overflow: true
          }),
          stroke: new OlStyle.Stroke({
            color: this.strokeColor,
            width: 2
          }),
          fill:  new OlStyle.Fill({
            color: this.fillColor
          }),
          image: new OlStyle.Icon({
            src: icon
          })
        })
        return style;

      } else {
        style = new OlStyle.Style({
          text: new OlStyle.Text({
            text: showLabels ? feature.get('draw') : '',
            stroke: new OlStyle.Stroke({
              color: 'white',
              width: 0.75
            }),
            fill: new OlStyle.Fill({
              color: 'black'
            }),
            font: '20px sans-serif',
            overflow: true,
            offsetY: labelOffset ? -15 : 0
          }),
          stroke: new OlStyle.Stroke({
            color: this.strokeColor,
            width: 2
          }),
          fill:  new OlStyle.Fill({
            color: this.fillColor
          }),
          image: new OlStyle.Circle({
            radius: 5,
            stroke: new OlStyle.Stroke({
              color: this.strokeColor
            }),
            fill: new OlStyle.Fill({
              color: this.fillColor
            })
          })
        })
        return style;
      }
    }
}
