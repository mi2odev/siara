import { io } from 'socket.io-client'

import { API_ORIGIN } from '../requestMethodes'

export function createNotificationSocket(token) {
  return io(API_ORIGIN, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: token ? { token } : {},
  })
}
