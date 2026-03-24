import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OtpInputProps {
  onComplete: (code: string) => void
  onResend: () => void
  loading?: boolean
  error?: string
  email?: string
}

const OTP_LENGTH = 8
const RESEND_COOLDOWN = 60

export function OtpInput({ onComplete, onResend, loading, error, email }: OtpInputProps) {
  const { t } = useTranslation("auth")
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < OTP_LENGTH) {
      inputRefs.current[index]?.focus()
    }
  }, [])

  const updateDigits = useCallback(
    (newDigits: string[]) => {
      setDigits(newDigits)
      const code = newDigits.join("")
      if (code.length === OTP_LENGTH && newDigits.every((d) => d !== "")) {
        onComplete(code)
      }
    },
    [onComplete],
  )

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow single digits
      const digit = value.replace(/\D/g, "").slice(-1)
      if (!digit) return

      const newDigits = [...digits]
      newDigits[index] = digit
      updateDigits(newDigits)

      // Auto-advance to next input
      if (index < OTP_LENGTH - 1) {
        focusInput(index + 1)
      }
    },
    [digits, focusInput, updateDigits],
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (digits[index] === "") {
          // Empty box: go back to previous
          if (index > 0) {
            const newDigits = [...digits]
            newDigits[index - 1] = ""
            setDigits(newDigits)
            focusInput(index - 1)
          }
        } else {
          // Clear current box
          const newDigits = [...digits]
          newDigits[index] = ""
          setDigits(newDigits)
        }
        e.preventDefault()
      } else if (e.key === "ArrowLeft") {
        focusInput(index - 1)
        e.preventDefault()
      } else if (e.key === "ArrowRight") {
        focusInput(index + 1)
        e.preventDefault()
      }
    },
    [digits, focusInput],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
      if (pasted.length === 0) return

      const newDigits = [...digits]
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i]
      }
      updateDigits(newDigits)

      // Focus the next empty input or the last one
      const nextEmpty = newDigits.findIndex((d) => d === "")
      focusInput(nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty)
    },
    [digits, focusInput, updateDigits],
  )

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }, [])

  const handleResend = useCallback(() => {
    setCountdown(RESEND_COOLDOWN)
    setDigits(Array(OTP_LENGTH).fill(""))
    focusInput(0)
    onResend()
  }, [focusInput, onResend])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Digit boxes */}
      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            value={digit}
            disabled={loading}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            className={cn(
              "w-10 h-12 sm:w-12 sm:h-14 rounded-lg border text-center text-xl sm:text-2xl font-bold",
              "bg-background text-foreground",
              "outline-none transition-colors",
              "focus:border-brand-500 focus:ring-1 focus:ring-brand-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error
                ? "border-destructive"
                : "border-input dark:border-zinc-700",
            )}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={handleFocus}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {/* Email display */}
      {email && (
        <p className="text-sm text-muted-foreground">
          {t("otpSentTo", { email })}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      {/* Resend countdown / button */}
      <div className="mt-1">
        {countdown > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("otpResendIn", { seconds: countdown })}
          </p>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={loading}
          >
            {t("otpResend")}
          </Button>
        )}
      </div>
    </div>
  )
}
