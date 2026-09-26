import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { addLink, sameEnd } from '../model/actions'
import type { LinkEnd } from '../model/types'

/**
 * The click-to-link state machine, shared by highlights and window headers:
 * first click arms an end, a click on a different end creates the link,
 * a click on the armed end cancels.
 */
export function clickLinkEnd(end: LinkEnd): void {
  const { linkSource, setLinkSource } = useUiStore.getState()
  if (linkSource === null) {
    setLinkSource(end)
  } else if (sameEnd(linkSource, end)) {
    setLinkSource(null)
  } else {
    useStore.getState().update((s) => addLink(s, { from: linkSource, to: end }))
    setLinkSource(null)
  }
}

export function isArmed(linkSource: LinkEnd | null, end: LinkEnd): boolean {
  return linkSource !== null && sameEnd(linkSource, end)
}
