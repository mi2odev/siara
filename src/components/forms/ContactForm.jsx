import React, { useState } from 'react'
import Input from '../ui/Input'
import Button from '../ui/Button'

export default function ContactForm({ onSubmit }){
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
      <Input id="contact-name" label="Nom" value={name} onChange={(e)=>setName(e.target.value)} />
      <Input id="contact-email" label="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
      <label htmlFor="contact-message" style={{display:'block',color:'var(--siara-accent)',marginBottom:6}}>Message</label>
      <textarea id="contact-message" value={message} onChange={(e)=>setMessage(e.target.value)} className="siara-input" style={{minHeight:120}} />
      <div style={{height:12}} />
      <Button type="submit">Envoyer</Button>
    </form>
  )
}
