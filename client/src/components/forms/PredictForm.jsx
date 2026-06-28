import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Input from '../ui/Input'
import Button from '../ui/Button'

export default function PredictForm({ onSubmit }){
  const { t } = useTranslation(['pages', 'common'])
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')

  function handleSubmit(e){
    e.preventDefault()
    if(onSubmit) onSubmit({ location, date })
  }

  return (
    <form className="predict-form" onSubmit={handleSubmit}>
      <Input id="predict-location" label={t('predictForm.locationLabel')} value={location} onChange={(e)=>setLocation(e.target.value)} placeholder={t('predictForm.locationPlaceholder')} />
      <Input id="predict-date" label={t('predictForm.dateLabel')} value={date} onChange={(e)=>setDate(e.target.value)} placeholder="YYYY-MM-DD" />
      <Button type="submit">{t('predictForm.runPrediction')}</Button>
    </form>
  )
}
