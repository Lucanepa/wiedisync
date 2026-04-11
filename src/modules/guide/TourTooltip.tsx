import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { TooltipRenderProps } from 'react-joyride'
import { Button } from '../../components/ui/button'

export function TourTooltip({
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
  index,
  size,
  isLastStep,
}: TooltipRenderProps) {
  const { t } = useTranslation('guide')
  const { t: tRaw } = useTranslation()
  const progress = ((index + 1) / size) * 100

  // step.title and step.content are fully-qualified i18n keys (e.g. "guide:tours.*.steps.*.title")
  const title = step.title ? tRaw(step.title as string) : ''
  const body = step.content ? tRaw(step.content as string) : ''

  return (
    <div
      {...tooltipProps}
      className="relative w-[340px] max-w-[calc(100vw-32px)] rounded-lg bg-background text-foreground shadow-xl overflow-hidden"
    >
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-muted">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #4A55A2, #FFC832)',
          }}
        />
      </div>

      <div className="p-4">
        {/* Close button */}
        <button
          {...closeProps}
          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step badge + title */}
        <div className="flex items-start gap-3 mb-2 pr-6">
          <span className="flex-shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {index + 1}
          </span>
          {title && (
            <h3 className="text-base font-semibold leading-tight">
              {title}
            </h3>
          )}
        </div>

        {/* Body */}
        {body && (
          <p className="text-sm text-muted-foreground mb-4 ml-[34px]">
            {body}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between ml-[34px]">
          <button
            {...skipProps}
            className="text-sm text-primary hover:underline underline-offset-2"
          >
            {t('tooltip.skip')}
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                {...backProps}
                variant="secondary"
                size="sm"
              >
                {t('tooltip.back')}
              </Button>
            )}
            <Button
              {...primaryProps}
              size="sm"
            >
              {isLastStep ? t('tooltip.finish') : t('tooltip.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
