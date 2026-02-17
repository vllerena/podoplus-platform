import { useState } from 'react';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg w-full"
          >
            ☰
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {sidebarOpen && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Principal
              </h3>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                📊 Dashboard
              </a>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                📅 Citas
              </a>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                👥 Clientes
              </a>

              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-4">
                Operaciones
              </h3>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                💰 Caja
              </a>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                🛍️ Ventas
              </a>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                📦 Inventario
              </a>

              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-4">
                Configuración
              </h3>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                ⚙️ Configuración
              </a>
              <a href="#" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                👤 Usuarios
              </a>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Podoplus Admin</h1>
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">🔔</button>
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">👤</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Citas Hoy</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Clientes</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">248</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Ingresos (Hoy)</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">$2,450</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">No-Shows</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">2</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Citas Próximas</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Hora</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Cliente</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Servicio</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Estado</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">10:00 AM</td>
                      <td className="px-4 py-3">Juan García</td>
                      <td className="px-4 py-3">Limpieza Uñas</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          Confirmada
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-indigo-600 hover:text-indigo-900">Editar</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
