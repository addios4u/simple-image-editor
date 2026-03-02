export interface PointerEvent {
  x: number;
  y: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface KeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export abstract class BaseTool {
  abstract readonly name: string;

  getCursor(): string {
    return 'default';
  }

  onPointerDown(_e: PointerEvent): void {}
  onPointerMove(_e: PointerEvent): void {}
  onPointerUp(_e: PointerEvent): void {}
  onKeyDown(_e: KeyEvent): void {}
  reset(): void {}
}
