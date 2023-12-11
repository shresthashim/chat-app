import React from 'react'
import { BrowseRouter, Routes, Route } from 'react-router-dom'
import Chat from './pages/Chat'
import Login from './pages/Login'
const App = () => {
  return (
 <BrowseRouter>
 <Routes>
  <Route path = "/login" element={<Login />} /> 
  <Route path = "/register" element={<Register />} />
  <Route path="/" element={<Chat />} />
 </Routes>
 </BrowseRouter>

  )
}

export default App
