import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { ToolComponent } from '@igo2/common';
import { DrawEntityStore, DrawFeatureStore, RegionDBData } from '@igo2/geo';
import { BehaviorSubject } from 'rxjs';
import { MapState } from '../../map/map.state';
import { DownloadState } from '../download.state';
import { RegionEditorComponent } from '../region-editor/region-editor.component';
import { RegionManagerComponent } from '../region-manager/region-manager.component';
import { DownloadToolState } from './download-tool.state';

export enum Tab {
  Editor = 'Region Editor',
  Manager = 'Downloaded Regions'
}

@ToolComponent({
  name: 'download',
  title: 'igo.integration.tools.download',
  icon: 'download'
})
@Component({
  selector: 'igo-download-tool',
  templateUrl: './download-tool.component.html',
  styleUrls: ['./download-tool.component.scss']
})
export class DownloadToolComponent implements OnInit, AfterViewInit {
  @Input() geometryTypes: string[] = ['Point', 'LineString', 'Polygon'];
  public predefinedRegionsStore: DrawEntityStore = new DrawEntityStore([]);
    public allRegionsStore: DrawFeatureStore = new DrawFeatureStore([], { map: this.mapState.map });
  public drawControlIsActive$: BehaviorSubject<boolean> = new BehaviorSubject(true);
  @Input() predefinedTypes: string[] = ['type1', 'type2'];
  @Input() minBufferMeters = 0
  @Input() maxBufferMeters = 100000
  @Input() selectedPredefinedType = this.predefinedTypes[0];

  @ViewChild('editor') regionEditor: RegionEditorComponent;
  @ViewChild('manager') regionManager: RegionManagerComponent;

  constructor(
    private state: DownloadToolState,
    private downloadState: DownloadState,
    private mapState: MapState
  ) {
    this.downloadState.rightMouseClick$.subscribe((value) => {
      if (value) {
        this.selectedTabIndex = 0;
      }
    });
  }

  set selectedTabIndex(index: number) {
    this.state.selectedTabIndex = index;
  }

  get selectedTabIndex() {
    return this.state.selectedTabIndex;
  }

  ngOnInit() {
    const openedWithMouse = this.downloadState.openedWithMouse;
    if (openedWithMouse) {
      this.selectedTabIndex = 0;
    }
  }

  ngAfterViewInit() {
    this.downloadState.openedWithMouse = false;
    this.switchTab(this.selectedTabIndex);
    this.regionManager.regionToEdit$.subscribe((region: RegionDBData) => {
      this.selectedTabIndex = 0;
      this.regionEditor.updateRegion(region);
    });
  }

  onPredefinedTypeChange(predefinedType) {
    console.log(predefinedType);
  }

  onTabChange(event) {
    this.selectedTabIndex = event.index;
    this.switchTab(this.selectedTabIndex);
  }

  private switchTab(index: number) {
    switch (index) {
      case 0:
        this.regionEditor.showEditedRegionFeatures();
        break;
      case 1:
        this.regionManager.showSelectedRegionFeatures();
        break;
      default:
        break;
    }
  }
}
