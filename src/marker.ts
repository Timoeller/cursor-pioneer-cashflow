import markerSDK, { type MarkerSdk } from '@marker.io/browser'

export const markerWidget: Promise<MarkerSdk> = markerSDK.loadWidget({
  project: '6aff03bb61116fac9f9dd60d',
})

// A failed load must not surface as an unhandled rejection. Callers still observe it.
markerWidget.catch(() => undefined)
