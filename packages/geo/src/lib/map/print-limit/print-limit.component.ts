import { Component, OnInit, Input, AfterViewInit } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IgoMap } from '../shared/map';
import { PrintFormComponent } from '../../print/print-form';

@Component({
  selector: 'igo-print-limit',
  templateUrl: './print-limit.component.html',
  styleUrls: ['./print-limit.component.scss']
})
export class PrintLimitComponent implements OnInit {
 
  @Input() map: IgoMap;
  @Input() scalePrint: boolean;
  public scalePrint$$: Subscription;
  public selectedScale$$: Subscription;
  private inDragAction: boolean = false;
  private cursorOffsetX: number = 0;
  private cursorOffsetY: number = 0;
  private opacityMove: string = '0.15';
  private opacity: string = '0.3';
  private width: string = '350px';
  private height: string = '150px';

  constructor() {}

  get limit() {
    return document.getElementById('limit');
  }

  ngOnInit() {
    this.scalePrint$$ = this.map.scalePrint$.subscribe((value) =>{
      this.limit.style.width = this.width;
      this.limit.style.height = this.height;
      this.displayLimits(value);
    })
    this.selectedScale$$ = this.map.selectedScale$.subscribe((scale) => {
      if ( scale === '1:100000'){
        this.limit.style.height = this.height;}
    }) 
  }

  displayLimits(value: boolean) {
    this.limit.style.visibility = value ? 'visible' :'hidden';
    this.move();
  }

  reset() {
    this.inDragAction = false;
    this.cursorOffsetX = 0;
    this.cursorOffsetY = 0;
    this.limit.style.opacity = this.opacity;
  }

  logicDrag(event) {
    if (this.inDragAction) {
      this.adjustPosition(event);
    }
    else {
      this.reset();
    }
  }

  adjustPosition(event) {
    const totalX = event.view.innerWidth;
    const right = event.pageX - event.offsetX + parseInt(this.limit.style.width);
    const resX = totalX-right;
    const totalY = event.view.innerHeight;
    const down = event.pageY - event.offsetY + parseInt(this.limit.style.height);
    const resY = totalY - down;
    
    if (resX > 20) {
      this.limit.style.left = (event.pageX - this.cursorOffsetX) + 'px';
    }
    if (resY > 20) {
      this.limit.style.top = (event.pageY - this.cursorOffsetY) + 'px';
    }
    this.limit.style.opacity = this.opacityMove;
  }

  move() {
    this.limit.addEventListener('mousedown', (event) => {
      this.inDragAction = true;
      this.cursorOffsetX = event.offsetX;
      this.cursorOffsetY = event.offsetY;
    });
    document.addEventListener('mousemove', (event) =>{
      this.logicDrag(event);
    });
    document.addEventListener('mouseup', (event) => {
      this.reset();
    });
  }



}
