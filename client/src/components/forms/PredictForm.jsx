import React, { useState } from 'react'
import Input from '../ui/Input'
import Button from '../ui/Button'

export default function PredictForm({ onSubmit }){
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')

  function handleSubmit(e){
    e.preventDefault()
    if(onSubmit) onSubmit({ location, date })
  }

  return (
    <form className="predict-form" onSubmit={handleSubmit}>
      <Input id="predict-location" label="Localisation" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Ville, wilaya ou coordonnées" />
      <Input id="predict-date" label="Date (optionnel)" value={date} onChange={(e)=>setDate(e.target.value)} placeholder="YYYY-MM-DD" />
      <Button type="submit">Lancer la prédiction</Button>
    </form>
  )
}
