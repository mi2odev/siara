// Minimal mock auth service

export async function login(email, password) {
  if (!email || !password) throw new Error('Missing credentials')
  // simulate network latency
  await new Promise((r) => setTimeout(r, 700))
  // simple role assignment for demo
  const role = String(email).toLowerCase().includes('admin') ? 'admin' : 'user'
  // return a mock user and token
  return { user: { id: 1, name: role === 'admin' ? 'Admin Demo' : 'Utilisateur Démo', email, role }, token: 'mock-token' }
}

export function logout() {
  // placeholder for any cleanup
}
