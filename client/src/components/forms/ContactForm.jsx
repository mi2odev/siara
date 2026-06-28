import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Input from '../ui/Input'
import Button from '../ui/Button'

export default function ContactForm({ onSubmit }){
  const { t } = useTranslation(['pages', 'common'])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(e){
    e.preventDefault()
    if(onSubmit) onSubmit({ name, email, message })
    setName('')
    setEmail('')
    setMessage('')
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <Input id="contact-name" label={t('contactForm.name')} value={name} onChange={(e)=>setName(e.target.value)} />
      <Input id="contact-email" label={t('contactForm.email')} value={email} onChange={(e)=>setEmail(e.target.value)} />
      <label htmlFor="contact-message" style={{display:'block',color:'var(--siara-accent)',marginBottom:6}}>{t('contactForm.message')}</label>
      <textarea id="contact-message" value={message} onChange={(e)=>setMessage(e.target.value)} className="siara-input" style={{minHeight:120}} />
      <div style={{height:12}} />
      <Button type="submit">{t('contactForm.send')}</Button>
    </form>
  )
}
