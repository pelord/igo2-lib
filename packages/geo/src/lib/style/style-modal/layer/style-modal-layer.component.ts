import { Component, Inject, Input, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';

import { asArray as ColorAsArray } from 'ol/color';
import olStyle from 'ol/style/Style';
import { LayerMatDialogData, StyleModalData } from '../shared/style-modal.interface';

@Component({
  selector: 'igo-style-modal-layer',
  templateUrl: './style-modal-layer.component.html',
  styleUrls: ['./style-modal-layer.component.scss']
})
export class StyleModalLayerComponent implements OnInit {
  @Input() confirmFlag: boolean = false;

  public form: UntypedFormGroup;

  public styleModalData: StyleModalData;
  public linestringOnly: boolean;

  private initialValues: StyleModalData;

  private defaultValues: StyleModalData = {
    fillColor: 'rgba(255,255,255,0.4)',
    strokeColor: 'rgba(143,7,7,1)'
  };

  get layerOlStyle(): olStyle {
    const style = this.data.layer.ol.getStyle();
    return style instanceof Function ? undefined : (style as olStyle).clone();
  }

  constructor(
    public dialogRef: MatDialogRef<StyleModalLayerComponent>,
    private formBuilder: UntypedFormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: LayerMatDialogData) {
      this.buildForm();
    }

  ngOnInit() {
    this.linestringOnly = true;
    for (const feature of this.data.layer.ol.getSource().getFeatures()) {
      if (feature.getGeometry().getType() !== 'LineString') {
        this.linestringOnly = false;
      }
    }
    this.buildStyleData();

  }

  private buildForm() {
    this.form = this.formBuilder.group({
      fill: [''],
      stroke: ['']
    });
  }

  private buildStyleData() {
    this.styleModalData = {
      fillColor: this.getLayerFillColor(),
      strokeColor: this.getLayerStrokeColor()
    };
    this.initialValues ={
      fillColor: this.getLayerFillColor(),
      strokeColor: this.getLayerStrokeColor()
    };
  }

  getLayerFillColor() {
    let fillColor = this.defaultValues.fillColor;
    const style = this.layerOlStyle;
    if (style?.getFill()?.getColor()) {
      const arrayColor = style.getFill().getColor();
      fillColor = `rgba(${arrayColor[0]},${arrayColor[1]},${arrayColor[2]},${arrayColor[3]|| 0.4})`;
    }
    return fillColor;
  }

  getLayerStrokeColor() {
    let strokeColor = this.defaultValues.strokeColor;
    const style = this.layerOlStyle;
    if (style?.getStroke()?.getColor()) {
      const arrayColor = style.getStroke().getColor();
      strokeColor = `rgba(${arrayColor[0]},${arrayColor[1]},${arrayColor[2]},${arrayColor[3]|| 1})`;
    }
    return strokeColor;
  }

  setLayerFillColor(event) {
    const cAA = ColorAsArray(event);
    const s = this.layerOlStyle.clone();
    (s.getImage() as any).getFill().setColor(cAA);
    s.getFill().setColor(cAA);
    this.data.layer.ol.setStyle(s);
    this.styleModalData.fillColor = event;
  }

  setLayerStrokeColor(event) {
    const cAA = ColorAsArray(event);
    const s = this.layerOlStyle.clone();
    (s.getImage() as any).getStroke().setColor(cAA);
    s.getStroke().setColor(cAA);
    this.data.layer.ol.setStyle(s);
    this.styleModalData.strokeColor = event;
  }

  cancel() {
    this.dialogRef.close();
    this.setLayerFillColor(this.initialValues.fillColor);
    this.setLayerStrokeColor(this.initialValues.strokeColor);
  }

  confirm() {
    this.confirmFlag = true;
    this.dialogRef.close(this.styleModalData);
  }
}
