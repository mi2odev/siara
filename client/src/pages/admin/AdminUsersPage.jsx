import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ── Mock data ── */
const allUsers = [
  { id: 'U-1001', name: 'Ahmed Benali', email: 'ahmed.b@mail.dz', role: 'trusted', status: 'active', trustScore: 92, totalReports: 48, verified: 45, falseReports: 3, falseRatio: 6.3, riskScore: 'low', joinDate: '2023-06-12', lastActive: '2h ago' },
  { id: 'U-1002', name: 'Fatima Khaldi', email: 'fatima.k@mail.dz', role: 'user', status: 'active', trustScore: 88, totalReports: 32, verified: 28, falseReports: 4, falseRatio: 12.5, riskScore: 'low', joinDate: '2023-09-20', lastActive: '30m ago' },
  { id: 'U-1003', name: 'Yacine Mebarki', email: 'yacine.m@mail.dz', role: 'trusted', status: 'active', trustScore: 95, totalReports: 67, verified: 64, falseReports: 3, falseRatio: 4.5, riskScore: 'low', joinDate: '2023-02-14', lastActive: '1h ago' },
  { id: 'U-1004', name: 'Nour Lounis', email: 'nour.l@mail.dz', role: 'user', status: 'active', trustScore: 76, totalReports: 22, verified: 17, falseReports: 5, falseRatio: 22.7, riskScore: 'medium', joinDate: '2024-01-05', lastActive: '5h ago' },
  { id: 'U-1005', name: 'Amine Rahal', email: 'amine.r@mail.dz', role: 'user', status: 'warned', trustScore: 34, totalReports: 18, verified: 6, falseReports: 12, falseRatio: 66.7, riskScore: 'high', joinDate: '2024-06-18', lastActive: '12h ago' },
  { id: 'U-1006', name: 'Sara Ziani', email: 'sara.z@mail.dz', role: 'user', status: 'active', trustScore: 90, totalReports: 41, verified: 37, falseReports: 4, falseRatio: 9.8, riskScore: 'low', joinDate: '2023-04-22', lastActive: '45m ago' },
  { id: 'U-1007', name: 'Karim Djebbar', email: 'karim.d@mail.dz', role: 'user', status: 'suspended', trustScore: 12, totalReports: 25, verified: 3, falseReports: 22, falseRatio: 88.0, riskScore: 'critical', joinDate: '2024-08-01', lastActive: '3d ago' },
  { id: 'U-1008', name: 'Bilal Sahraoui', email: 'bilal.s@mail.dz', role: 'user', status: 'active', trustScore: 78, totalReports: 15, verified: 12, falseReports: 3, falseRatio: 20.0, riskScore: 'medium', joinDate: '2024-03-11', lastActive: '3h ago' },
  { id: 'U-1009', name: 'Nadia Touati', email: 'nadia.t@mail.dz', role: 'trusted', status: 'active', trustScore: 91, totalReports: 54, verified: 50, falseReports: 4, falseRatio: 7.4, riskScore: 'low', joinDate: '2023-01-30', lastActive: '20m ago' },
  { id: 'U-1010', name: 'Omar Hadj', email: 'omar.h@mail.dz', role: 'user', status: 'banned', trustScore: 5, totalReports: 30, verified: 2, falseReports: 28, falseRatio: 93.3, riskScore: 'critical', joinDate: '2024-07-15', lastActive: '14d ago' },
]

const tabs = [
  { key: 'all', label: 'All Users' },
  { key: 'active', label: 'Active' },
  { key: 'trusted', label: 'Trusted' },
  { key: 'at-risk', label: 'At Risk' },
  { key: 'suspended', label: 'Suspended / Banned' },
]

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('filter') || 'all'
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [actionModal, setActionModal] = useState(null)

  const filtered = useMemo(() => {
    let list = allUsers
    if (currentTab === 'active') list = list.filter(u => u.status === 'active')
    else if (currentTab === 'trusted') list = list.filter(u => u.role === 'trusted')
    else if (currentTab === 'at-risk') list = list.filter(u => u.riskScore === 'high' || u.riskScore === 'critical')
    else if (currentTab === 'suspended') list = list.filter(u => u.status === 'suspended' || u.status === 'banned')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
    }
    return list.sort((a, b) => a.trustScore - b.trustScore)
  }, [currentTab, search])

  const tabCounts = {
    all: allUsers.length,
    active: allUsers.filter(u => u.status === 'active').length,
    trusted: allUsers.filter(u => u.role === 'trusted').length,
    'at-risk': allUsers.filter(u => u.riskScore === 'high' || u.riskScore === 'critical').length,
    suspended: allUsers.filter(u => u.status === 'suspended' || u.status === 'banned').length,
  }

  const handleAction = (user, action) => {
    alert(`Action "${action}" applied to ${user.name}`)
    setActionModal(null)
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">User Governance</h1>
          <p className="admin-page-subtitle">Trust scoring, risk assessment and user management</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="admin-input" type="text" placeholder="Search name, email, ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220, height: 32, fontSize: 11.5 }} />
          <button className="admin-btn admin-btn-ghost">Export</button>
        </div>
      </div>

      {/* Trust Score Algorithm Info */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-card-header">
          <h3 className="admin-card-title">Trust Score Algorithm</h3>
          <span style={{ fontSize: 10, color: 'var(--admin-text-muted)', background: 'var(--admin-surface-alt)', padding: '3px 8px', borderRadius: 4 }}>v1.2</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 10 }}>
          {[
            { factor: 'Verified Reports', weight: '40%', desc: 'Reports confirmed by admin' },
            { factor: 'False Report Ratio', weight: '25%', desc: 'Inversely weighted' },
            { factor: 'Account Age', weight: '15%', desc: 'Mature accounts score higher' },
            { factor: 'Report Frequency', weight: '10%', desc: 'Consistent contributors' },
            { factor: 'Community Rating', weight: '10%', desc: 'Other users\' feedback' },
          ].map(f => (
            <div key={f.factor} style={{ padding: '8px 10px', background: 'var(--admin-surface-alt)', borderRadius: 6, border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--admin-text)' }}>{f.factor}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-primary)', margin: '4px 0' }}>{f.weight}</div>
              <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setSearchParams(t.key === 'all' ? {} : { filter: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Trust Score</th>
                <th>Reports</th>
                <th>False Ratio</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className={user.riskScore === 'critical' ? 'row-highlight' : ''}>
                  <td style={{ fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{user.id}</td>
                  <td>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 500 }}>{user.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{user.email}</div>
                    </div>
                  </td>
                  <td><span className={`admin-pill ${user.role}`}>{user.role}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="admin-progress" style={{ width: 44 }}>
                        <div className={`admin-progress-fill ${user.trustScore >= 75 ? 'success' : user.trustScore >= 40 ? 'warning' : 'danger'}`} style={{ width: `${user.trustScore}%` }}></div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: user.trustScore >= 75 ? 'var(--admin-success)' : user.trustScore >= 40 ? 'var(--admin-warning)' : 'var(--admin-danger)' }}>
                        {user.trustScore}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                    <span style={{ fontWeight: 600 }}>{user.verified}</span>
                    <span style={{ color: 'var(--admin-text-muted)' }}> / {user.totalReports}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 11, color: user.falseRatio <= 15 ? 'var(--admin-success)' : user.falseRatio <= 40 ? 'var(--admin-warning)' : 'var(--admin-danger)' }}>
                      {user.falseRatio}%
                    </span>
                  </td>
                  <td><span className={`admin-pill ${user.riskScore}`}>{user.riskScore}</span></td>
                  <td><span className={`admin-pill ${user.status}`}>{user.status}</span></td>
                  <td style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>{user.lastActive}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {user.status !== 'banned' && user.status !== 'suspended' && (
                        <>
                          <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => handleAction(user, 'warn')}>Warn</button>
                          <button className="admin-btn admin-btn-sm admin-btn-warning" onClick={() => handleAction(user, 'suspend')}>Suspend</button>
                        </>
                      )}
                      {user.status === 'suspended' && (
                        <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => handleAction(user, 'unsuspend')}>Unsuspend</button>
                      )}
                      {user.status !== 'banned' && (
                        <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleAction(user, 'ban')}>Ban</button>
                      )}
                      {user.status === 'banned' && (
                        <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => handleAction(user, 'unban')}>Unban</button>
                      )}
                      {user.role !== 'trusted' && user.trustScore >= 80 && (
                        <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => handleAction(user, 'promote')}>Promote</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>No users match filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--admin-border)', fontSize: 11, color: 'var(--admin-text-muted)' }}>
          <span>Showing {filtered.length} of {allUsers.length} users</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="admin-btn admin-btn-sm admin-btn-ghost" disabled>← Prev</button>
            <button className="admin-btn admin-btn-sm admin-btn-ghost">Next →</button>
          </div>
        </div>
      </div>
    </>
  )
}
