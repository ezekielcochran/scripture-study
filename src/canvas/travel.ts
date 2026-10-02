import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { switchWorkspace } from '../model/actions'
import { PORTAL_SIZE } from '../model/constants'

/** The subset of React Flow's instance API that travelling needs. */
export interface ViewportApi {
  getViewport: () => { x: number; y: number; zoom: number }
  setViewport: (v: { x: number; y: number; zoom: number }) => Promise<boolean>
  setCenter: (x: number, y: number, opts?: { zoom?: number }) => Promise<boolean>
}

/**
 * Go through a portal: switch workspaces and show the counterpart. With
 * `keepPosition`, the counterpart appears exactly where the portal was on
 * screen, so it looks as if nothing moved; otherwise it is centred.
 */
export function travelThroughPortal(portalId: string, rf: ViewportApi, opts: { keepPosition: boolean }): void {
  const { state, update } = useStore.getState()
  const portal = state.portals.find((p) => p.id === portalId)
  if (!portal) return
  const counterpart = state.portals.find((p) => p.pairId === portal.pairId && p.id !== portal.id)
  useUiStore.getState().setLinkSource(null)
  update((s) => switchWorkspace(s, portal.targetWorkspaceId), { skip: true })
  if (!counterpart) return
  if (opts.keepPosition) {
    // Same screen point for both portals: shift the viewport by their canvas offset, scaled by zoom.
    const v = rf.getViewport()
    void rf.setViewport({
      x: v.x + (portal.x - counterpart.x) * v.zoom,
      y: v.y + (portal.y - counterpart.y) * v.zoom,
      zoom: v.zoom,
    })
  } else {
    void rf.setCenter(counterpart.x + PORTAL_SIZE.width / 2, counterpart.y + PORTAL_SIZE.height / 2, { zoom: rf.getViewport().zoom })
  }
}
