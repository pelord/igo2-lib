import { Component } from '@angular/core';

/*
Button to center to initial the map extent
*/

@Component({
  selector: 'igo-center-button',
  templateUrl: './center-button.component.html',
  styleUrls: ['./center-button.component.scss']
})

export class CenterButtonComponent {

  constructor(public centerButton: CenterButton) {}
}
