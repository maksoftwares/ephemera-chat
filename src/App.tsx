import { useEffect, useState } from 'react'
import type { RoomDescriptor } from './types'
import {
  createRoomDescriptor,
  navigateHome,
  navigateToRoom,
  parseRoomHash,
} from './lib/roomLink'
import { Landing } from './components/Landing'
import { RoomScreen } from './components/RoomScreen'
import './App.css'

const readRoute = (): RoomDescriptor | null => parseRoomHash()

function App() {
  const [room, setRoom] = useState<RoomDescriptor | null>(() => readRoute())
  const [invalidLink, setInvalidLink] = useState(
    () => Boolean(window.location.hash) && !readRoute(),
  )

  useEffect(() => {
    const onRouteChange = (): void => {
      const next = readRoute()
      setRoom(next)
      setInvalidLink(Boolean(window.location.hash) && !next)
    }

    window.addEventListener('hashchange', onRouteChange)
    return () => window.removeEventListener('hashchange', onRouteChange)
  }, [])

  const createRoom = (): void => navigateToRoom(createRoomDescriptor())

  if (!room) {
    return (
      <Landing
        invalidLink={invalidLink}
        onCreateRoom={createRoom}
        onJoinRoom={navigateToRoom}
      />
    )
  }

  return (
    <RoomScreen
      key={`${room.roomId}:${room.secret}`}
      room={room}
      onHome={navigateHome}
      onNewRoom={createRoom}
    />
  )
}

export default App
