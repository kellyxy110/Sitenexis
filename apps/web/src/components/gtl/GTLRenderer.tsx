'use client'

import { type GTLState } from '@sitenexis/shared'
import { PartialTruthBanner } from './PartialTruthBanner'
import { EmptyState } from './EmptyState'
import type { EmptyStateProps } from './EmptyState'

export interface GTLResponse<T> {
  state: GTLState
  timestamp: string
  data: T | null
}

interface GTLRendererProps<T> {
  response: GTLResponse<T> | null | undefined
  loading?: boolean
  render: (data: T) => React.ReactNode
  renderPartial?: (data: T | null) => React.ReactNode
  emptyProps?: Partial<EmptyStateProps>
  partialBanner?: { message?: string; hint?: string }
}

export function GTLRenderer<T>({
  response,
  loading = false,
  render,
  renderPartial,
  emptyProps,
  partialBanner,
}: GTLRendererProps<T>) {
  if (loading || !response) {
    return (
      <div className="gtl-loading space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-white/[0.04]" />
        <div className="h-32 rounded-xl bg-white/[0.03]" />
      </div>
    )
  }

  switch (response.state) {
    case 'complete':
      return <>{render(response.data as T)}</>

    case 'partial':
      return (
        <div className="gtl-partial space-y-4">
          <PartialTruthBanner
            timestamp={response.timestamp}
            {...(partialBanner?.message != null ? { message: partialBanner.message } : {})}
            {...(partialBanner?.hint    != null ? { hint:    partialBanner.hint    } : {})}
          />
          {renderPartial
            ? renderPartial(response.data)
            : response.data != null
            ? render(response.data)
            : null}
        </div>
      )

    case 'empty':
      return (
        <EmptyState
          {...(emptyProps?.title   != null ? { title:   emptyProps.title   } : {})}
          {...(emptyProps?.message != null ? { message: emptyProps.message } : {})}
          {...(emptyProps?.action  != null ? { action:  emptyProps.action  } : {})}
          {...(emptyProps?.href    != null ? { href:    emptyProps.href    } : {})}
          {...(emptyProps?.icon    != null ? { icon:    emptyProps.icon    } : {})}
          {...(emptyProps?.compact != null ? { compact: emptyProps.compact } : {})}
        />
      )

    default:
      return null
  }
}
