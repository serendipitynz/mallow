export interface ModalEntry {
  covered: boolean;
}

/** The modal that owns the keyboard: the innermost one that is not covered.
 *  Mount order alone is not the paint order — Settings opened from the menu
 *  while an update dialog is already showing mounts last and sits underneath. */
export function keyboardOwner(stack: readonly ModalEntry[]): ModalEntry | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i].covered) {
      return stack[i];
    }
  }
  return undefined;
}
