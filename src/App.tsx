import { useState } from 'react'

import { GuestHomePage } from '@/pages/GuestHomePage'
import { LoginPage } from '@/pages/LoginPage'

type Screen = 'login' | 'guest'

function App() {
  const [screen, setScreen] = useState<Screen>('login')

  if (screen === 'guest') {
    return <GuestHomePage onLogin={() => setScreen('login')} />
  }

  return <LoginPage onGuest={() => setScreen('guest')} />
}

export default App
