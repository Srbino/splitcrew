'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Users, Edit2, Trash2, Plus, Lock } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { CURRENCY_CODES } from '@/lib/currencies';
import { LOCALES } from '@/lib/i18n';

interface UserData {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  boat_id: number;
  boat_name: string;
}

interface BoatData {
  id: number;
  name: string;
}

interface SettingsData {
  trip_name: string;
  trip_date_from: string;
  trip_date_to: string;
  base_currency: string;
  language: string;
}

async function apiCall(url: string, method = 'GET', data?: unknown) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const options: RequestInit = {
    method,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
  };
  if (data && method !== 'GET') options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  return res.json();
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'users'>('settings');

  // Settings state
  const [settings, setSettings] = useState<SettingsData>({
    trip_name: '',
    trip_date_from: '',
    trip_date_to: '',
    base_currency: 'EUR',
    language: 'en',
  });
  const [memberPassword, setMemberPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [boats, setBoats] = useState<BoatData[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBoatId, setFormBoatId] = useState(0);
  const [userSaving, setUserSaving] = useState(false);

  // Delete user
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await apiCall('/api/admin/settings');
    if (res.success) {
      setSettings({
        trip_name: res.data.trip_name,
        trip_date_from: res.data.trip_date_from,
        trip_date_to: res.data.trip_date_to,
        base_currency: res.data.base_currency,
        language: res.data.language,
      });
    }
    setSettingsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await apiCall('/api/admin/users');
    if (res.success) {
      setUsers(res.data.users);
      setBoats(res.data.boats);
    }
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, [loadSettings, loadUsers]);

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsMessage('');
    const res = await apiCall('/api/admin/settings', 'POST', { settings });
    setSettingsSaving(false);
    if (res.success) {
      setSettingsMessage('Settings saved successfully.');
      setTimeout(() => setSettingsMessage(''), 3000);
    } else {
      setSettingsMessage(res.error);
    }
  }

  async function handleChangePassword(type: 'member' | 'admin') {
    const password = type === 'member' ? memberPassword : adminPassword;
    if (!password || password.length < 4) {
      alert('Password must be at least 4 characters.');
      return;
    }
    setSettingsSaving(true);
    const res = await apiCall('/api/admin/settings', 'POST', {
      action: 'change_password',
      type,
      password,
    });
    setSettingsSaving(false);
    if (res.success) {
      if (type === 'member') setMemberPassword('');
      else setAdminPassword('');
      setSettingsMessage(`${type === 'member' ? 'Member' : 'Admin'} password updated.`);
      setTimeout(() => setSettingsMessage(''), 3000);
    } else {
      alert(res.error);
    }
  }

  function openAddUserModal() {
    setEditingUser(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormBoatId(boats[0]?.id || 0);
    setShowUserModal(true);
  }

  function openEditUserModal(user: UserData) {
    setEditingUser(user);
    setFormName(user.name);
    setFormPhone(user.phone || '');
    setFormEmail(user.email || '');
    setFormBoatId(user.boat_id);
    setShowUserModal(true);
  }

  async function handleSaveUser() {
    if (!formName.trim() || !formBoatId) return;
    setUserSaving(true);

    const payload = editingUser
      ? { action: 'edit', id: editingUser.id, name: formName.trim(), phone: formPhone.trim() || null, email: formEmail.trim() || null, boat_id: formBoatId }
      : { action: 'add', name: formName.trim(), phone: formPhone.trim() || null, email: formEmail.trim() || null, boat_id: formBoatId };

    const res = await apiCall('/api/admin/users', 'POST', payload);
    setUserSaving(false);

    if (res.success) {
      setShowUserModal(false);
      loadUsers();
    } else {
      alert(res.error);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setUserSaving(true);
    const res = await apiCall('/api/admin/users', 'POST', {
      action: 'delete',
      id: deleteUserId,
    });
    setUserSaving(false);
    if (res.success) {
      setDeleteUserId(null);
      loadUsers();
    } else {
      alert(res.error);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
      </div>

      {/* Tab navigation */}
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} /> Settings
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} /> Users
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          {settingsLoading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading settings...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Trip settings card */}
              <div className="card">
                <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Trip Settings</h3>

                  <div className="form-group">
                    <label className="form-label">Trip Name</label>
                    <input
                      className="form-control"
                      value={settings.trip_name}
                      onChange={e => setSettings({ ...settings, trip_name: e.target.value })}
                      placeholder="e.g. Croatia 2026"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        className="form-control"
                        type="date"
                        value={settings.trip_date_from}
                        onChange={e => setSettings({ ...settings, trip_date_from: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        className="form-control"
                        type="date"
                        value={settings.trip_date_to}
                        onChange={e => setSettings({ ...settings, trip_date_to: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Base Currency</label>
                      <select
                        className="form-control"
                        value={settings.base_currency}
                        onChange={e => setSettings({ ...settings, base_currency: e.target.value })}
                      >
                        {CURRENCY_CODES.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Language</label>
                      <select
                        className="form-control"
                        value={settings.language}
                        onChange={e => setSettings({ ...settings, language: e.target.value })}
                      >
                        {Object.values(LOCALES).map(loc => (
                          <option key={loc.code} value={loc.code}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {settingsMessage && (
                    <div className={`alert ${settingsMessage.includes('error') || settingsMessage.includes('Error') ? 'alert-danger' : 'alert-success'}`} style={{ marginTop: 8 }}>
                      {settingsMessage}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    style={{ marginTop: 8 }}
                  >
                    {settingsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Password card */}
              <div className="card">
                <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
                    <Lock size={16} style={{ marginRight: 6 }} />
                    Passwords
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Member Password</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-control"
                        type="password"
                        value={memberPassword}
                        onChange={e => setMemberPassword(e.target.value)}
                        placeholder="New member password"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-outline"
                        onClick={() => handleChangePassword('member')}
                        disabled={settingsSaving || !memberPassword}
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Admin Password</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-control"
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="New admin password"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-outline"
                        onClick={() => handleChangePassword('admin')}
                        disabled={settingsSaving || !adminPassword}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {usersLoading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading users...</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map(user => (
                  <div key={user.id} className="card">
                    <div className="card-body" style={{ padding: 'var(--card-pad)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={user.name} avatar={user.avatar} size="sm" userId={user.id} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                              {user.boat_name}
                              {user.phone && <> &middot; {user.phone}</>}
                              {user.email && <> &middot; {user.email}</>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => openEditUserModal(user)}
                            aria-label={`Edit ${user.name}`}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteUserId(user.id)}
                            aria-label={`Delete ${user.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* FAB - Add user */}
              <button className="fab" onClick={openAddUserModal} aria-label="Add user">
                <Plus size={24} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowUserModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveUser} disabled={userSaving}>
              {userSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Boat</label>
          <select
            className="form-control"
            value={formBoatId}
            onChange={e => setFormBoatId(Number(e.target.value))}
          >
            <option value={0}>Select boat...</option>
            {boats.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Phone (optional)</label>
          <input
            className="form-control"
            value={formPhone}
            onChange={e => setFormPhone(e.target.value)}
            placeholder="+420 123 456 789"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email (optional)</label>
          <input
            className="form-control"
            type="email"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </Modal>

      {/* Delete User Confirmation */}
      <Modal
        isOpen={deleteUserId !== null}
        onClose={() => setDeleteUserId(null)}
        title="Delete User"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteUserId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDeleteUser} disabled={userSaving}>
              {userSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <p>Are you sure you want to delete this user? This action cannot be undone.</p>
      </Modal>
    </>
  );
}
