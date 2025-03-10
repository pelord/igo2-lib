import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ContextService, DetailedContext } from '@igo2/context';
import { IgoMap, Layer, VectorLayer } from '@igo2/geo';
import { MapState } from '../../map.state';
import { ToolState } from '../../../tool/tool.state';

@Component({
  selector: 'igo-advanced-swipe',
  templateUrl: './advanced-swipe.component.html',
  styleUrls: ['./advanced-swipe.component.scss']
})

export class AdvancedSwipeComponent implements OnInit, OnDestroy {
  public swipe: boolean = false;
  public layerList: Layer[];
  public userControlledLayerList: Layer[];
  public form: UntypedFormGroup;
  public layers: VectorLayer[];
  public res: DetailedContext;
  public listForSwipe: Layer[];

  /**
   * Get an active map state
   */
  get map(): IgoMap {
    return this.mapState.map;
  }

  constructor(
    public mapState: MapState,
    private contextService: ContextService,
    private formBuilder: UntypedFormBuilder,
    private toolState: ToolState) {
      this.buildForm();
  }

  /**
   * Get the list of layers for swipe
   * @internal
   */
   ngOnInit() {
    this.map.layers$.subscribe(ll => this.userControlledLayerList = ll.filter(layer =>
      (!layer.baseLayer && layer.showInLayerList && layer.displayed)));
  }

  /**
   * Desactivate the swipe
   * @internal
   */
  ngOnDestroy(){
    this.swipe = false;
    this.map.swipeEnabled$.next(this.swipe);
  }

  /**
   * Build a form for choise of the layers
   */
  private buildForm() {
    this.form = this.formBuilder.group({
      layers: ['', [Validators.required]]
    });
  }

  /**
   * Activate the swipe, send a list of layers for a swipe-tool
   */
  startSwipe(toggle: boolean){
    this.swipe = toggle;
    this.map.swipeEnabled$.next(toggle);
    this.listForSwipe = [];
    for (const layer of this.form.value.layers) {
      this.listForSwipe.push(layer);
    }
    this.map.selectedFeatures$.next(this.listForSwipe);
  }

  /**
   * Restart a swipe for a new layers-list
   */
  applyNewLayers(e) {
    this.startSwipe(false); // l'approche KISS
    this.startSwipe(true);
    if (e._selected) {e._selected = false; }
    const allLayers = this.userControlledLayerList.length;
    const selectedLayers = this.form.controls.layers.value.length;
    if (selectedLayers === allLayers){
      e._selected = true;
    }
  }

  /**
   * Select all list of layers and restart a tool
   */
  selectAll(e) {
    if (e._selected) {
      this.form.controls.layers.setValue(this.userControlledLayerList);
      e._selected = true;
    }
    else {
      this.form.controls.layers.setValue([]);
    }
    this.startSwipe(false);
    this.startSwipe(true);
  }

  /**
   * Open search tool
   */
  searchEmit() {
    this.toolState.toolbox.activateTool('searchResults');
  }

  /**
   * Open catalog
   */
  catalogEmit() {
    this.toolState.toolbox.activateTool('catalog');
  }

  /**
   * Open context manager
   */
  contextEmit() {
    this.toolState.toolbox.activateTool('contextManager');
  }
}
