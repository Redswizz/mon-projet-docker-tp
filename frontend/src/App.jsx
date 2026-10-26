import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function App() {
  const [instruction, setInstruction] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_BASE_URL}/api/instruction`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des consignes')
        }
        return response.json()
      })
      .then((data) => setInstruction(data))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  return (
    <div className="container">
      <h1>Consignes</h1>
      {loading && <p>Chargement...</p>}
      {error && <p className="error">Erreur : {error}</p>}
      {instruction && (
        <div className="instruction">
          <p>{instruction.message}</p>
        </div>
      )}
    </div>
  )
}

export default App
