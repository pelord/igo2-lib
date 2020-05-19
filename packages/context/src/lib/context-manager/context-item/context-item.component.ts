import { BehaviorSubject } from 'rxjs';
import { Component, Input, Output, EventEmitter, Renderer2, ElementRef, ChangeDetectionStrategy } from '@angular/core';

import { AuthService } from '@igo2/auth';
import { TypePermission } from '../shared/context.enum';
import { DetailedContext } from '../shared/context.interface';

@Component({
  selector: 'igo-context-item',
  templateUrl: './context-item.component.html',
  styleUrls: ['./context-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextItemComponent {
  public typePermission = TypePermission;
  public color = 'primary';
  public focusedCls = 'igo-context-item-focused';

  @Input()
  get context(): DetailedContext {
    return this._context;
  }
  set context(value: DetailedContext) {
    this._context = value;
  }
  private _context: DetailedContext;

  @Input()
  get selectedContext(): DetailedContext {
    return this._selectedContext;
  }
  set selectedContext(value: DetailedContext) {
    this._selectedContext = value;
  }
  private _selectedContext: DetailedContext;

  @Input()
  get default(): boolean {
    return this._default;
  }
  set default(value: boolean) {
    this._default = value;
  }
  private _default = false;

  @Input()
  get activeContext() {
    return this._activeContext;
  }
  set activeContext(value) {
    if (value) {
      this._activeContext = value;
      if (this.context && value.id === this.context.id) {
        this.contextTool$.next(true);
        this.renderer.addClass(this.elRef.nativeElement, this.focusedCls);
      } else {
        this.renderer.removeClass(this.elRef.nativeElement, this.focusedCls);
      }
    }
  }
  private _activeContext;

  get selectedActiveContext() {
    if (this.context && this.selectedContext) {
      return this.context.id === this.selectedContext.id;
    } else {
      return false;
    }
  }

  contextTool$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  @Output() edit = new EventEmitter<DetailedContext>();
  @Output() delete = new EventEmitter<DetailedContext>();
  @Output() save = new EventEmitter<DetailedContext>();
  @Output() clone = new EventEmitter<DetailedContext>();
  @Output() favorite = new EventEmitter<DetailedContext>();
  @Output() managePermissions = new EventEmitter<DetailedContext>();
  @Output() manageTools = new EventEmitter<DetailedContext>();
  @Output() action = new EventEmitter<DetailedContext>();

  constructor(public auth: AuthService, private renderer: Renderer2, private elRef: ElementRef) {}

  favoriteClick(context) {
    if (this.auth.authenticated) {
      this.favorite.emit(context);
    }
  }

  toggleContextTool() {
    this.contextTool$.next(!this.contextTool$.getValue());
    if (this.contextTool$.getValue() === true) {
      this.renderer.addClass(this.elRef.nativeElement, this.focusedCls);
      console.log(this.elRef.nativeElement);
    } else {
      this.renderer.removeClass(this.elRef.nativeElement, this.focusedCls);
    }
    this.action.emit(this.context);
  }
}
