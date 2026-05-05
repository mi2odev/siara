import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const LOCALE_BY_LANGUAGE = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-DZ',
}

export function useFormatters() {
  const { i18n } = useTranslation()
  const language = String(i18n?.language || 'en').slice(0, 2)
  const locale = LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.en

  return useMemo(() => {
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
    })
    const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const numberFormatter = new Intl.NumberFormat(locale)
    const percentFormatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
    })

    const safeFormatDate = (input) => {
      if (input == null) return ''
      const date = input instanceof Date ? input : new Date(input)
      return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
    }
    const safeFormatDateTime = (input) => {
      if (input == null) return ''
      const date = input instanceof Date ? input : new Date(input)
      return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
    }
    const safeFormatNumber = (input) => {
      const n = Number(input)
      return Number.isFinite(n) ? numberFormatter.format(n) : ''
    }
    const safeFormatPercent = (input) => {
      const n = Number(input)
      return Number.isFinite(n) ? percentFormatter.format(n / 100) : ''
    }

    return {
      locale,
      formatDate: safeFormatDate,
      formatDateTime: safeFormatDateTime,
      formatNumber: safeFormatNumber,
      formatPercent: safeFormatPercent,
    }
  }, [locale])
}

export default useFormatters
