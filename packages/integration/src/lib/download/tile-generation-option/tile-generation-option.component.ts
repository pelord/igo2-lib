import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatSelect } from '@angular/material/select';
import { IgoMap, TileGenerationParams, TileGenerationStrategies } from '@igo2/geo';
import { SliderGenerationParams, TileGenerationSliderComponent } from './tile-generation-sliders/tile-generation-slider.component';


@Component({
  selector: 'igo-tile-generation-option',
  templateUrl: './tile-generation-option.component.html',
  styleUrls: ['./tile-generation-option.component.scss']
})
export class TileGenerationOptionComponent implements OnInit {
  @Output() valueChange: EventEmitter<TileGenerationParams> = new EventEmitter();

  private _tileGenerationParams: TileGenerationParams = {
    startLevel: 6,
    parentLevel: 6,
    endLevel: 13,
    genMethod: TileGenerationStrategies.MIDDLE
  };


  @Input() map: IgoMap;
  @Input() minZoom: number = 2;
  @Input() maxZoom: number = 20;

  @Input() disabled: boolean = false;
  @Input()
  get parentLevel(): number {
    return this._tileGenerationParams.parentLevel;
  }

  set parentLevel(value: number) {
    this._tileGenerationParams.parentLevel = value;
    this.cdRef.detectChanges();
    if (this.generationSlider) {
      this.updateSliderParams(this.generationSlider.value);
    }
    this.emitChanges();
  }

  @ViewChild('genSlider') generationSlider: TileGenerationSliderComponent;
  @ViewChild('strategySelect') strategySelect: MatSelect;

  strategies = Object.values(TileGenerationStrategies);

  set strategy(value: TileGenerationStrategies) {
    this._tileGenerationParams.genMethod = value;
  }

  get strategy(): TileGenerationStrategies {
    return this._tileGenerationParams.genMethod;
  }

  constructor( private cdRef: ChangeDetectorRef ) { }
  ngOnInit(): void {
    this.parentLevel = 6;
  }

  private get sliderGenerationParams() {
    return {
      startLevel: this._tileGenerationParams.startLevel,
      endLevel: this._tileGenerationParams.endLevel
    };
  }

  private set sliderGenerationParams(params: SliderGenerationParams) {
    this._tileGenerationParams.startLevel = params.startLevel;
    this._tileGenerationParams.endLevel = params.endLevel;
    this.generationSlider.value = params;
  }

  get startLevel() {
    return this.sliderGenerationParams.startLevel;
  }

  get endLevel() {
    return this.sliderGenerationParams.endLevel;
  }

  get genMethod() {
    return this.strategy;
  }

  set genMethod(value: TileGenerationStrategies) {
    this.strategy = value;
  }

  private updateSliderParams(params: SliderGenerationParams) {
    this._tileGenerationParams.startLevel = params.startLevel;
    this._tileGenerationParams.endLevel = params.endLevel;
  }

  onSliderChange(sliderGenerationParams: SliderGenerationParams) {
    if (sliderGenerationParams.startLevel !== this.map.viewController.getZoom()) {
      this.map.viewController.zoomTo(sliderGenerationParams.startLevel);
    }
    this.updateSliderParams(sliderGenerationParams);
    this.emitChanges();
  }

  private updateStrategy(strategy: TileGenerationStrategies) {
    this._tileGenerationParams.genMethod = strategy;
  }

  onSelectionChange(strategy: TileGenerationStrategies) {
    this.updateStrategy(strategy);
    const newStrategy = this.strategySelect.value;
    this.strategy = newStrategy;
    this.cdRef.detectChanges();
    this.updateSliderParams(this.generationSlider.value);
    this.emitChanges();
  }

  private emitChanges() {
    this.valueChange.emit(this.tileGenerationParams);
  }

  set tileGenerationParams(params: TileGenerationParams) {
    this._tileGenerationParams = {...params};
    this.parentLevel = params.parentLevel;
    this.genMethod = params.genMethod;
    this.strategy = params.genMethod;

    this.cdRef.detectChanges();

    this.sliderGenerationParams = {
      startLevel: params.startLevel,
      endLevel: params.endLevel
    };
  }

  get tileGenerationParams(): TileGenerationParams {
    return this._tileGenerationParams;
  }
}
