import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../contexts/AuthContext'
import FeedSidebarNav from './FeedSidebarNav'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/NewsPage.css'
import './LeftNavLayout.css'

/**
 * LeftNavLayout — wraps a standalone page so it gets the same left sidebar
 * (profile card + shared FeedSidebarNav) every other main page has, with the
 * page's own content rendered in the main column. Keeps the left side
 * consistent across the app without duplicating markup per page.
 *
 * Props:
 *   - activeKey : which FeedSidebarNav item to highlight (optional)
 *   - children  : the page's existing content (rendered in the main column)
 */
export default function LeftNavLayout({ activeKey, children }) {
  const navigate = useNavigate()
  const { t } = useTranslation(['pages', 'common'])
  const { user } = useContext(AuthContext)

  const displayName = user?.name || user?.email || t('leftNavLayout.defaultUser')
  const avatarUrl = getUserAvatarUrl(user)
  const initials = getInitialsFromName(displayName)

  return (
    <div className="lnl-root">
      <div className="lnl-grid">
        <aside className="sidebar-left lnl-sidebar">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="profile-avatar-large"
                  loading="lazy"
                />
              ) : (
                <span className="profile-avatar-large lnl-avatar-initials">{initials}</span>
              )}
            </div>
            <div className="profile-info">
              <p className="profile-name">{displayName}</p>
              <p className="profile-bio">{t('leftNavLayout.profileBio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>
                {t('leftNavLayout.viewProfile')}
              </button>
            </div>
          </div>

          <FeedSidebarNav activeKey={activeKey} />
        </aside>

        <main className="lnl-main">{children}</main>
      </div>
    </div>
  )
}
