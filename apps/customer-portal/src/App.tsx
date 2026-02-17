import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Podoplus</h1>
          <p className="text-lg text-gray-600">Portal de Autoservicio - Gestión de Citas</p>
        </header>

        <main className="bg-white rounded-lg shadow-lg p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Bienvenido</h2>
            <p className="text-gray-600 mb-6">
              Sistema de reserva de citas para clínicas de podología. Gestiona tus citas de forma
              rápida y sencilla.
            </p>
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">📅 Mis Citas</h3>
              <p className="text-gray-600">Ver y gestionar tus citas programadas</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">➕ Nueva Cita</h3>
              <p className="text-gray-600">Reservar una nueva cita en tu sede preferida</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">👤 Mi Perfil</h3>
              <p className="text-gray-600">Actualizar información personal</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">💳 Planes</h3>
              <p className="text-gray-600">Ver planes y afiliaciones disponibles</p>
            </div>
          </section>

          <section className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> Este es el portal de autoservicio de Podoplus. Para más
              información, contacta con tu sede más cercana.
            </p>
          </section>

          <div className="mt-8 text-center">
            <button
              onClick={() => setCount((count) => count + 1)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Contador: {count}
            </button>
          </div>
        </main>

        <footer className="text-center mt-8 text-gray-600 text-sm">
          <p>&copy; 2026 Podoplus. Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
