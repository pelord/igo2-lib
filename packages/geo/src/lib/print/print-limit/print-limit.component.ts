import { Component, OnInit, Input, AfterViewInit } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IgoMap } from '../../map/shared/map';
import { PrintFormComponent } from '../print-form';

@Component({
  selector: 'igo-print-limit',
  templateUrl: './print-limit.component.html',
  styleUrls: ['./print-limit.component.scss']
})
export class PrintLimitComponent implements OnInit {

  public height = '250px';  

  @Input() scalePrint: boolean;
  constructor() {}

  ngOnInit() {
    console.log('on developpe une autre branche');
    this.displayLimits(this.scalePrint);
  }

  displayLimits(value: boolean) {
    let limit = document.getElementById('limit');
    limit.style.visibility = value ? 'visible' :'hidden';
  }


}
