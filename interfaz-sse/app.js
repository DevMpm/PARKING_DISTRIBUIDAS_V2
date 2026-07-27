// Todo pasa por Kong (único punto de entrada público, puerto 8000)
const BASE_URL = 'http://localhost:8000';
const LOGIN_URL = `${BASE_URL}/api/usuarios/auth/login`;
const API_ESPACIOS = `${BASE_URL}/api/v1/espacios/`;
const SSE_URL = `${BASE_URL}/sse/espacios`;

const loginForm = document.getElementById('loginForm');
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const container = document.getElementById('espaciosContainer');
const totalSpan = document.getElementById('totalEspacios');
const lastUpdateSpan = document.getElementById('lastUpdate');
const indicator = document.getElementById('indicator');
const statusText = document.getElementById('statusText');
const eventLog = document.getElementById('eventLog');

let accessToken = sessionStorage.getItem('access_token') || null;
let eventSource = null;

const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleString('es-ES', { hour12: false });
};

const setConnectionStatus = (connected) => {
    if (connected) {
        indicator.className = 'w-3 h-3 bg-green-500 rounded-full inline-block';
        statusText.textContent = 'Conectado';
    } else {
        indicator.className = 'w-3 h-3 bg-red-500 rounded-full inline-block';
        statusText.textContent = 'Desconectado';
    }
};

const logEvento = (tipo, data) => {
    const linea = document.createElement('div');
    linea.textContent = `[${formatDate(new Date())}] ${tipo} -> ${JSON.stringify(data)}`;
    eventLog.prepend(linea);
};

// ---------- Autenticación ----------

const login = async (username, password) => {
    const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        throw new Error('Credenciales inválidas');
    }
    const data = await response.json();
    return data.access_token;
};

const mostrarDashboard = () => {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
};

const mostrarLogin = () => {
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
};

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    try {
        accessToken = await login(username, password);
        sessionStorage.setItem('access_token', accessToken);
        mostrarDashboard();
        await iniciarDashboard();
    } catch (err) {
        console.error(err);
        loginError.textContent = err.message || 'No se pudo iniciar sesión';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    accessToken = null;
    sessionStorage.removeItem('access_token');
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    mostrarLogin();
});

// ---------- Espacios ----------

const fetchEspacios = async () => {
    try {
        const response = await fetch(API_ESPACIOS, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error al obtener espacios:', error);
        return null;
    }
};

const renderizarEspacios = (espacios) => {
    if (!espacios || espacios.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-xl">No hay espacios disponibles</p>
            </div>
        `;
        totalSpan.textContent = '0 espacios';
        return;
    }

    const html = espacios.map((esp) => {
        const estadoClass = `bg-${esp.estado.toLowerCase()}`;
        return `
            <div class="espacio-card ${estadoClass} rounded-lg shadow p-4 flex flex-col">
                <div class="font-bold text-lg text-gray-800">${esp.codigo || 'Sin código'}</div>
                <div class="text-sm text-gray-600">Zona: ${esp.nombreZona || 'N/A'}</div>
                <div class="text-sm text-gray-600">Tipo: ${esp.tipo || 'N/A'}</div>
                <div class="mt-2 flex items-center justify-between">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full
                        ${esp.estado === 'DISPONIBLE' ? 'bg-green-200 text-green-800' :
                          esp.estado === 'OCUPADO' ? 'bg-red-200 text-red-800' :
                          esp.estado === 'RESERVADO' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-gray-200 text-gray-800'}">
                        ${esp.estado}
                    </span>
                    <span class="text-xs text-gray-400">ID: ${esp.id.slice(0, 8)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    totalSpan.textContent = `${espacios.length} espacios`;
    lastUpdateSpan.textContent = formatDate(new Date());
};

const cargarEspacios = async () => {
    const data = await fetchEspacios();
    if (data) {
        renderizarEspacios(data);
        setConnectionStatus(true);
    } else {
        setConnectionStatus(false);
    }
};

// ---------- SSE ----------
// El backend manda el tipo de evento en la línea "event:" (created,
// salida_registrada, anulado), por lo que 'onmessage' NO se dispara para
// ellos: hay que escuchar cada tipo explícitamente con addEventListener.

const manejarEventoEspacio = (tipo) => (event) => {
    let payload;
    try {
        payload = JSON.parse(event.data);
    } catch (e) {
        console.error('Error al parsear evento SSE:', e);
        return;
    }
    console.log('SSE recibido:', tipo, payload);
    logEvento(tipo, payload);
    // Recargamos todos los espacios para reflejar el cambio de estado
    cargarEspacios();
};

const conectarSSE = () => {
    const source = new EventSource(SSE_URL);

    source.onopen = () => {
        console.log('SSE: conexión establecida');
        setConnectionStatus(true);
    };

    source.addEventListener('created', manejarEventoEspacio('created'));
    source.addEventListener('salida_registrada', manejarEventoEspacio('salida_registrada'));
    source.addEventListener('anulado', manejarEventoEspacio('anulado'));

    source.onerror = (error) => {
        console.error('SSE error:', error);
        setConnectionStatus(false);
        source.close();
        setTimeout(() => {
            if (accessToken) {
                eventSource = conectarSSE();
            }
        }, 5000);
    };

    return source;
};

const iniciarDashboard = async () => {
    await cargarEspacios();
    eventSource = conectarSSE();
    setInterval(cargarEspacios, 30000);
};

(() => {
    if (accessToken) {
        mostrarDashboard();
        iniciarDashboard();
    } else {
        mostrarLogin();
    }
})();
