import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 👈 main.jsx와 App.jsx가 둘 다 src 폴더 안에 있을 때
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
