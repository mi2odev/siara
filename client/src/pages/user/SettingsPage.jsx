import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { changePassword, getUserSettings, updateUserSettings } from '../../services/authService'
import '../../styles/DashboardPage.css'
import '../../styles/SettingsPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const sections = [
  { key: 'profile', label: 'Profile' },
  { key: 'account', label: 'Account' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'data', label: 'Data' },
]

const DEFAULT_PROFILE = {
  name: '',
  bio: '',
  location: '',
  email: '',
  phone: '',
  language: 'French',
  memberSince: null,
}

const DEFAULT_NOTIFS = {
  emailNearby: false,
  emailSevere: false,
  emailDigest: false,
  pushRealtime: false,
  pushPredictions: false,
}

const DEFAULT_PRIVACY = {
  visibility: 'public',
  identity: 'show',
  location: 'reporting',
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout, setUser } = useContext(AuthContext)
  const userId = user?.id || null

  const [activeSection, setActiveSection] = useState('profile')
  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [saved, setSaved] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  const [profileData, setProfileData] = useState({
    ...DEFAULT_PROFILE,
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS)
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY)
  const [twoFA, setTwoFA] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const memberSinceLabel = useMemo(() => {
    if (!profileData.memberSince) {
      return 'Unknown'
    }

    const date = new Date(profileData.memberSince)
    if (Number.isNaN(date.getTime())) {
      return 'Unknown'
    }

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [profileData.memberSince])

  useEffect(() => {
    let ignore = false

    if (!userId) {
      setIsLoadingSettings(false)
      return () => {
        ignore = true
      }
    }

    ;(async () => {
      setIsLoadingSettings(true)
      setSettingsError('')

      try {
        const settings = await getUserSettings()
        if (ignore) {
          return
        }

        if (settings?.profile) {
          setProfileData({
            name: settings.profile.name || '',
            bio: settings.profile.bio || '',
            location: settings.profile.location || '',
            email: settings.profile.email || '',
            phone: settings.profile.phone || '',
            language: settings.profile.language || 'French',
            memberSince: settings.profile.memberSince || settings.profile.createdAt || null,
          })
        }

        if (settings?.notifications) {
          setNotifs((prev) => ({
            ...prev,
            ...settings.notifications,
          }))
        }

        if (settings?.privacy) {
          setPrivacy({
            visibility: settings.privacy.visibility || 'public',
            identity: settings.privacy.identity || 'show',
            location: settings.privacy.location || 'reporting',
          })
        }

        if (settings?.security) {
          setTwoFA(Boolean(settings.security.twoFactorEnabled))
        }
      } catch (error) {
        if (!ignore) {
          setSettingsError(error?.response?.data?.message || error?.message || 'Unable to load settings from server.')
        }
      } finally {
        if (!ignore) {
          setIsLoadingSettings(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [userId])

  const setSavedField = (field) => {
    setSaved(field)
    setTimeout(() => setSaved(null), 1800)
  }

  const saveSettings = async (payload) => {
    setIsSaving(true)
    setSettingsError('')

    try {
      const updated = await updateUserSettings(payload)

      if (updated?.profile) {
        setProfileData((prev) => ({
          ...prev,
          name: updated.profile.name || prev.name,
          bio: updated.profile.bio || '',
          location: updated.profile.location || '',
          email: updated.profile.email || '',
          phone: updated.profile.phone || '',
          language: updated.profile.language || prev.language,
          memberSince: updated.profile.memberSince || prev.memberSince,
        }))

        setUser({
          ...user,
          name: updated.profile.name || user?.name,
          email: updated.profile.email || user?.email,
          phone: updated.profile.phone || user?.phone,
          bio: updated.profile.bio || '',
          location: updated.profile.location || '',
        })
      }

      if (updated?.notifications) {
        setNotifs((prev) => ({ ...prev, ...updated.notifications }))
      }

      if (updated?.privacy) {
        setPrivacy({
          visibility: updated.privacy.visibility || 'public',
          identity: updated.privacy.identity || 'show',
          location: updated.privacy.location || 'reporting',
        })
      }

      if (updated?.security) {
        setTwoFA(Boolean(updated.security.twoFactorEnabled))
      }

      return true
    } catch (error) {
      setSettingsError(error?.response?.data?.message || error?.message || 'Unable to save settings.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (field) => setEditing(field)

  const handleSave = async (field, value) => {
    const nextValue = String(value || '').trim()
    setEditing(null)
    setProfileData((prev) => ({ ...prev, [field]: nextValue }))
    const ok = await saveSettings({ profile: { [field]: nextValue } })
    if (ok) {
      setSavedField(field)
    }
  }

  const toggleNotif = async (key) => {
    const nextNotifs = {
      ...notifs,
      [key]: !notifs[key],
    }
    setNotifs(nextNotifs)
    const ok = await saveSettings({ notifications: nextNotifs })
    if (ok) {
      setSavedField(key)
    }
  }

  const handlePrivacyChange = async (field, value) => {
    const nextPrivacy = {
      ...privacy,
      [field]: value,
    }
    setPrivacy(nextPrivacy)
    await saveSettings({ privacy: nextPrivacy })
  }

  const toggleTwoFactor = async () => {
    const nextValue = !twoFA
    setTwoFA(nextValue)
    await saveSettings({ security: { twoFactorEnabled: nextValue } })
  }

  const onPasswordFieldChange = (field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  const submitPasswordChange = async (event) => {
    event.preventDefault()

    const currentPassword = String(passwordForm.currentPassword || '')
    const newPassword = String(passwordForm.newPassword || '')
    const confirmPassword = String(passwordForm.confirmPassword || '')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill all password fields.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.')
      return
    }

    setIsChangingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const result = await changePassword({ currentPassword, newPassword })

      if (result?.ok) {
        setPasswordSuccess(result.message || 'Password changed successfully.')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        setPasswordError('Unable to change password right now.')
      }
    } catch (error) {
      setPasswordError(error?.response?.data?.message || error?.message || 'Unable to change password right now.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="settings-root">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}><span className="notification-badge"></span></button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {profileData.name ? profileData.name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          <h2 className="settings-nav-title">Settings</h2>
          {sections.map((section) => (
            <button
              key={section.key}
              className={`settings-nav-item${activeSection === section.key ? ' active' : ''}`}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <main className="settings-panel">
          {isLoadingSettings ? <p className="settings-muted">Loading settings...</p> : null}
          {isSaving ? <p className="settings-muted">Saving changes...</p> : null}
          {settingsError ? <p className="settings-muted" style={{ color: '#b91c1c' }}>{settingsError}</p> : null}

          {activeSection === 'profile' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Profile</h3>

              <div className="settings-row">
                <span className="settings-label">Profile Photo</span>
                <span className="settings-value">
                  <span className="settings-avatar">
                    {profileData.name ? profileData.name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                  </span>
                </span>
                <button className="settings-action">Change</button>
              </div>

              {[
                { key: 'name', label: 'Name' },
                { key: 'bio', label: 'Bio' },
                { key: 'location', label: 'Location' },
              ].map(({ key, label }) => (
                <div className="settings-row" key={key}>
                  <span className="settings-label">{label}</span>
                  {editing === key ? (
                    <input
                      className="settings-inline-input"
                      autoFocus
                      defaultValue={profileData[key]}
                      onBlur={(event) => handleSave(key, event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleSave(key, event.target.value)}
                    />
                  ) : (
                    <span className="settings-value">{profileData[key]}</span>
                  )}
                  {saved === key ? (
                    <span className="settings-saved">Saved</span>
                  ) : editing !== key ? (
                    <button className="settings-action" onClick={() => handleEdit(key)}>Edit</button>
                  ) : null}
                </div>
              ))}
            </section>
          )}

          {activeSection === 'account' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Account</h3>

              {[
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'language', label: 'Language' },
              ].map(({ key, label }) => (
                <div className="settings-row" key={key}>
                  <span className="settings-label">{label}</span>
                  {editing === key ? (
                    <input
                      className="settings-inline-input"
                      autoFocus
                      defaultValue={profileData[key]}
                      onBlur={(event) => handleSave(key, event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleSave(key, event.target.value)}
                    />
                  ) : (
                    <span className="settings-value">{profileData[key]}</span>
                  )}
                  {saved === key ? (
                    <span className="settings-saved">Saved</span>
                  ) : editing !== key ? (
                    <button className="settings-action" onClick={() => handleEdit(key)}>Edit</button>
                  ) : null}
                </div>
              ))}

              <div className="settings-row">
                <span className="settings-label">Member since</span>
                <span className="settings-value settings-muted">{memberSinceLabel}</span>
              </div>
            </section>
          )}

          {activeSection === 'security' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Security</h3>

              <div className="settings-row">
                <span className="settings-label">Password</span>
                <span className="settings-value settings-muted">Update your password securely</span>
              </div>

              <form className="settings-password-form" onSubmit={submitPasswordChange}>
                <label className="settings-password-label" htmlFor="currentPassword">Current password</label>
                <input
                  id="currentPassword"
                  type="password"
                  className="settings-password-input"
                  value={passwordForm.currentPassword}
                  onChange={(event) => onPasswordFieldChange('currentPassword', event.target.value)}
                  autoComplete="current-password"
                />

                <label className="settings-password-label" htmlFor="newPassword">New password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="settings-password-input"
                  value={passwordForm.newPassword}
                  onChange={(event) => onPasswordFieldChange('newPassword', event.target.value)}
                  autoComplete="new-password"
                />

                <label className="settings-password-label" htmlFor="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="settings-password-input"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => onPasswordFieldChange('confirmPassword', event.target.value)}
                  autoComplete="new-password"
                />

                {passwordError ? <p className="settings-password-feedback settings-password-feedback-error">{passwordError}</p> : null}
                {passwordSuccess ? <p className="settings-password-feedback settings-password-feedback-success">{passwordSuccess}</p> : null}

                <button className="settings-action" type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>

              <div className="settings-row">
                <span className="settings-label">Two-Factor Authentication</span>
                <span className="settings-value">
                  <span className={`settings-status ${twoFA ? 'on' : 'off'}`}>{twoFA ? 'Enabled' : 'Disabled'}</span>
                </span>
                <button className="settings-action" onClick={toggleTwoFactor}>{twoFA ? 'Disable' : 'Enable'}</button>
              </div>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Notifications</h3>

              <div className="settings-group">
                <h4 className="settings-group-label">Email Notifications</h4>
                {[
                  { key: 'emailNearby', label: 'Incident nearby' },
                  { key: 'emailSevere', label: 'High severity only' },
                  { key: 'emailDigest', label: 'Weekly digest' },
                ].map(({ key, label }) => (
                  <label className="settings-toggle-row" key={key}>
                    <span className="settings-toggle-label">{label}</span>
                    <button
                      className={`settings-toggle ${notifs[key] ? 'on' : 'off'}`}
                      onClick={() => toggleNotif(key)}
                      role="switch"
                      aria-checked={notifs[key]}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Push Notifications</h4>
                {[
                  { key: 'pushRealtime', label: 'Real-time alerts' },
                  { key: 'pushPredictions', label: 'AI predictions' },
                ].map(({ key, label }) => (
                  <label className="settings-toggle-row" key={key}>
                    <span className="settings-toggle-label">{label}</span>
                    <button
                      className={`settings-toggle ${notifs[key] ? 'on' : 'off'}`}
                      onClick={() => toggleNotif(key)}
                      role="switch"
                      aria-checked={notifs[key]}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </label>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'privacy' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Privacy</h3>

              <div className="settings-group">
                <h4 className="settings-group-label">Profile Visibility</h4>
                {['public', 'private'].map((value) => (
                  <label className="settings-radio-row" key={value}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={privacy.visibility === value}
                      onChange={() => handlePrivacyChange('visibility', value)}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{value === 'public' ? 'Public' : 'Private'}</span>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Report Identity</h4>
                {[
                  { value: 'show', label: 'Show name' },
                  { value: 'anonymous', label: 'Anonymous' },
                ].map(({ value, label }) => (
                  <label className="settings-radio-row" key={value}>
                    <input
                      type="radio"
                      name="identity"
                      checked={privacy.identity === value}
                      onChange={() => handlePrivacyChange('identity', value)}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{label}</span>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Location Sharing</h4>
                <p className="settings-group-hint">Control when your location is shared with the platform.</p>
                {[
                  { value: 'always', label: 'Always' },
                  { value: 'reporting', label: 'Only when reporting' },
                  { value: 'never', label: 'Never' },
                ].map(({ value, label }) => (
                  <label className="settings-radio-row" key={value}>
                    <input
                      type="radio"
                      name="location"
                      checked={privacy.location === value}
                      onChange={() => handlePrivacyChange('location', value)}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'data' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Data</h3>

              <div className="settings-row">
                <span className="settings-label">Export My Data</span>
                <span className="settings-value settings-muted">Download all your data as JSON</span>
                <button className="settings-action">Export</button>
              </div>

              <div className="settings-row">
                <span className="settings-label">Clear History</span>
                <span className="settings-value settings-muted">Remove all search & browsing history</span>
                <button className="settings-action settings-action-warn">Clear</button>
              </div>

              <div className="settings-danger-zone">
                <h4 className="settings-danger-title">Delete Account</h4>
                <p className="settings-danger-text">This action is permanent and cannot be recovered.</p>
                {!showDeleteConfirm ? (
                  <button className="settings-btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
                ) : (
                  <div className="settings-confirm-block">
                    <p className="settings-confirm-text">Are you sure? Type <strong>DELETE</strong> to confirm.</p>
                    <div className="settings-confirm-actions">
                      <input className="settings-confirm-input" placeholder="Type DELETE" />
                      <button className="settings-btn-danger">Confirm Delete</button>
                      <button className="settings-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
