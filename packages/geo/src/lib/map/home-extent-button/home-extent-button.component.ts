import { ConfigService } from '@igo2/core';
import { Component, Input } from '@angular/core';
import { IgoMap } from '../shared/map';
import { MapExtent } from '../shared/map.interface';
import * as olproj from 'ol/proj';
/*
Button to center the map to the home extent
*/
@Component({
  selector: 'igo-home-extent-button',
  templateUrl:'./home-extent-button.component.html',
  styleUrls: ['./home-extent-button.component.scss'],
})
export class HomeExtentButtonComponent {
  @Input() map: IgoMap;
  @Input() color: string;
  @Input() extentOverride?: MapExtent;
  @Input() centerOverride?: [number, number];
  @Input() zoomOverride?: number;

  private homeExtentButtonExtent;
  private homeExtentButtonCenter;
  private homeExtentButtonZoom;

 constructor(public configService: ConfigService) {
      this.computeHomeExtent();
  }

  computeHomeExtent() {
    this.homeExtentButtonExtent = this.extentOverride || this.configService.getConfig('homeExtentButton.homeExtButtonExtent');
    this.homeExtentButtonCenter = this.centerOverride || this.configService.getConfig('homeExtentButton.homeExtButtonCenter');
    this.homeExtentButtonZoom = this.zoomOverride || this.configService.getConfig('homeExtentButton.homeExtButtonZoom');

    // priority over extent if these 2 properties are defined;
    if (this.centerOverride && this.zoomOverride) {
      this.homeExtentButtonExtent = undefined;
    }
  }

  onToggleClick() {
    this.computeHomeExtent();
    if (this.homeExtentButtonExtent) {
      this.map.viewController.zoomToExtent(this.homeExtentButtonExtent);
    } else if (this.homeExtentButtonCenter && this.homeExtentButtonZoom) {
      const center = olproj.fromLonLat(this.homeExtentButtonCenter, this.map.viewController.olView.getProjection().getCode());
      this.map.viewController.olView.setCenter(center);
      this.map.viewController.zoomTo(this.homeExtentButtonZoom);
    }
  }
}
