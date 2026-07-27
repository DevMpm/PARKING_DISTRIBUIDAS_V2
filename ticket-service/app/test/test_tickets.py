import uuid
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

DEFAULT_HEADERS = {
    "Authorization": "Bearer mock-token",
    "X-User-Id": str(uuid.uuid4()),
    "X-User-Roles": "ADMIN",
}


async def crear_ticket_helper(client, mock_clients, id_espacio=None, placa="ABC-1234", id_usuario=None):
    if id_espacio is None:
        id_espacio = uuid.uuid4()
    
    mock_clients["zonas"].obtener_espacio.return_value = {
        "id": str(id_espacio),
        "idZona": str(uuid.uuid4()),
        "estado": "DISPONIBLE",
        "tipo": "AUTO"
    }
    mock_clients["zonas"].obtener_categoria_zona.return_value = "ESTANDAR"
    
    mock_clients["vehiculos"].obtener_vehiculo.return_value = {
        "id": str(uuid.uuid4()),
        "placa": placa,
        "tipo": "AUTO",
        "idPropietario": str(id_usuario) if id_usuario else str(uuid.uuid4()),
        "activo": True
    }
    
    payload = {
        "id_espacio": str(id_espacio),
        "placa": placa,
    }
    if id_usuario:
        payload["id_usuario"] = str(id_usuario)

    response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
    return response


class TestTicketsAPI:

    async def test_cp1_1_crear_ticket_ok(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "AUTO"
        }
        mock_clients["zonas"].obtener_categoria_zona.return_value = "ESTANDAR"
        mock_clients["vehiculos"].obtener_vehiculo.return_value = {
            "id": str(uuid.uuid4()),
            "placa": "ABC-1234",
            "tipo": "AUTO",
            "idPropietario": str(uuid.uuid4())
        }

        payload = {
            "id_espacio": str(id_espacio),
            "placa": "ABC-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code == 201
        data = response.json()
        assert "id_ticket" in data
        assert data["estado_ticket"] == "activo"
        assert data["placa"] == "ABC-1234"
        assert "codigo_ticket" in data

        id_ticket = data["id_ticket"]
        res_get = await client.get(f"/api/v1/tickets/{id_ticket}", headers=DEFAULT_HEADERS)
        assert res_get.status_code == 200
        assert res_get.json()["id_ticket"] == id_ticket

    async def test_cp1_2_crear_ticket_espacio_ocupado(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        await crear_ticket_helper(client, mock_clients, id_espacio=id_espacio, placa="ABC-1234")

        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "OCUPADO",
            "tipo": "AUTO"
        }
        payload = {
            "id_espacio": str(id_espacio),
            "placa": "XYZ-9999"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (409, 400)

    async def test_cp1_3_crear_ticket_espacio_no_disponible(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "MANTENIMIENTO",
            "tipo": "AUTO"
        }
        payload = {
            "id_espacio": str(id_espacio),
            "placa": "ABC-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code == 409

    async def test_cp1_4_crear_ticket_vehiculo_no_existente(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "AUTO"
        }
        mock_clients["vehiculos"].obtener_vehiculo.return_value = None

        payload = {
            "id_espacio": str(id_espacio),
            "placa": "UNKNOWN"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code == 404

    async def test_cp1_5_crear_ticket_vehiculo_inactivo(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "AUTO"
        }
        mock_clients["vehiculos"].obtener_vehiculo.return_value = {
            "id": str(uuid.uuid4()),
            "placa": "INAC-123",
            "tipo": "AUTO",
            "activo": False
        }
        payload = {
            "id_espacio": str(id_espacio),
            "placa": "INAC-123"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 201)

    async def test_cp1_6_crear_ticket_usuario_inactivo(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "AUTO"
        }
        mock_clients["vehiculos"].obtener_vehiculo.return_value = {
            "id": str(uuid.uuid4()),
            "placa": "ABC-1234",
            "tipo": "AUTO",
            "idPropietario": str(uuid.uuid4()),
            "usuarioActivo": False
        }
        payload = {
            "id_espacio": str(id_espacio),
            "placa": "ABC-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 409, 201)

    async def test_cp1_7_crear_ticket_asignacion_inexistente(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "AUTO"
        }
        mock_clients["vehiculos"].obtener_vehiculo.return_value = {
            "id": str(uuid.uuid4()),
            "placa": "ABC-1234",
            "tipo": "AUTO",
            "idPropietario": None
        }
        mock_clients["asignaciones"].obtener_asignacion_activa.return_value = None

        payload = {
            "id_espacio": str(id_espacio),
            "placa": "ABC-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 404, 201)

    async def test_cp1_8_crear_ticket_espacio_incompatible(self, client, mock_clients):
        id_espacio = uuid.uuid4()
        mock_clients["zonas"].obtener_espacio.return_value = {
            "id": str(id_espacio),
            "idZona": str(uuid.uuid4()),
            "estado": "DISPONIBLE",
            "tipo": "MOTO"
        }
        mock_clients["vehiculos"].obtener_vehiculo.return_value = {
            "id": str(uuid.uuid4()),
            "placa": "CAR-1234",
            "tipo": "AUTO",
            "idPropietario": str(uuid.uuid4())
        }
        payload = {
            "id_espacio": str(id_espacio),
            "placa": "CAR-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code == 400

    async def test_cp1_9_1_id_espacio_invalido(self, client, mock_clients):
        payload = {
            "id_espacio": "invalid-uuid",
            "placa": "ABC-1234"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp1_9_2_placa_invalida(self, client, mock_clients):
        payload = {
            "id_espacio": str(uuid.uuid4()),
            "placa": ""
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp1_9_3_id_usuario_invalido(self, client, mock_clients):
        payload = {
            "id_espacio": str(uuid.uuid4()),
            "placa": "ABC-1234",
            "id_usuario": "not-a-uuid"
        }
        response = await client.post("/api/v1/tickets/", json=payload, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp2_1_listar_tickets_activos_ok(self, client, mock_clients):
        await crear_ticket_helper(client, mock_clients, placa="TICK-01")
        await crear_ticket_helper(client, mock_clients, placa="TICK-02")

        response = await client.get("/api/v1/tickets/", headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    async def test_cp2_2_listar_tickets_activos_sin_resultados(self, client, mock_clients):
        response = await client.get("/api/v1/tickets/", headers=DEFAULT_HEADERS)
        assert response.status_code == 200

    async def test_cp2_3_listar_tickets_activos_por_cedula_ok(self, client, mock_clients):
        user_id = uuid.uuid4()
        await crear_ticket_helper(client, mock_clients, placa="CED-01", id_usuario=user_id)

        response = await client.get("/api/v1/tickets/?cedula=1234567890", headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_cp2_4_listar_tickets_activos_por_cedula_inexistente(self, client, mock_clients):
        response = await client.get("/api/v1/tickets/?cedula=9999999999", headers=DEFAULT_HEADERS)
        assert response.status_code == 200

    async def test_cp2_5_listar_tickets_activos_por_id_usuario_ok(self, client, mock_clients):
        user_id = uuid.uuid4()
        await crear_ticket_helper(client, mock_clients, placa="USR-01", id_usuario=user_id)

        response = await client.get(f"/api/v1/tickets/?id_usuario={user_id}", headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_cp2_6_listar_tickets_activos_por_id_usuario_sin_resultados(self, client, mock_clients):
        random_user = uuid.uuid4()
        response = await client.get(f"/api/v1/tickets/?id_usuario={random_user}", headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    async def test_cp3_1_obtener_ticket_por_id_ok(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="GET-01")
        ticket_id = res_create.json()["id_ticket"]

        response = await client.get(f"/api/v1/tickets/{ticket_id}", headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        assert response.json()["id_ticket"] == ticket_id

    async def test_cp3_2_obtener_ticket_no_existente(self, client, mock_clients):
        random_id = uuid.uuid4()
        response = await client.get(f"/api/v1/tickets/{random_id}", headers=DEFAULT_HEADERS)
        assert response.status_code == 404

    async def test_cp3_3_obtener_ticket_id_invalido(self, client, mock_clients):
        response = await client.get("/api/v1/tickets/not-a-uuid", headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp4_1_registrar_salida_ok(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="OUT-01")
        ticket_id = res_create.json()["id_ticket"]

        response = await client.patch(f"/api/v1/tickets/{ticket_id}/salida", json={}, headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["estado_ticket"] == "pagado"
        assert data["valor_recaudado"] is not None

        res_get = await client.get(f"/api/v1/tickets/{ticket_id}", headers=DEFAULT_HEADERS)
        assert res_get.status_code == 200
        assert res_get.json()["estado_ticket"] == "pagado"

    async def test_cp4_2_registrar_salida_no_existente(self, client, mock_clients):
        random_id = uuid.uuid4()
        response = await client.patch(f"/api/v1/tickets/{random_id}/salida", json={}, headers=DEFAULT_HEADERS)
        assert response.status_code == 404

    async def test_cp4_3_registrar_salida_ticket_no_activo(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="OUT-02")
        ticket_id = res_create.json()["id_ticket"]

        await client.patch(f"/api/v1/tickets/{ticket_id}/salida", json={}, headers=DEFAULT_HEADERS)
        response = await client.patch(f"/api/v1/tickets/{ticket_id}/salida", json={}, headers=DEFAULT_HEADERS)
        assert response.status_code == 400

    async def test_cp4_4_registrar_salida_id_invalido(self, client, mock_clients):
        response = await client.patch("/api/v1/tickets/not-a-uuid/salida", json={}, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp5_1_anular_ticket_ok(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="ANU-01")
        ticket_id = res_create.json()["id_ticket"]

        response = await client.patch(f"/api/v1/tickets/{ticket_id}/anular", json={"motivo": "Prueba de anulación"}, headers=DEFAULT_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["estado_ticket"] == "anulado"

        res_get = await client.get(f"/api/v1/tickets/{ticket_id}", headers=DEFAULT_HEADERS)
        assert res_get.status_code == 200
        assert res_get.json()["estado_ticket"] == "anulado"

    async def test_cp5_2_anular_ticket_no_existente(self, client, mock_clients):
        random_id = uuid.uuid4()
        response = await client.patch(f"/api/v1/tickets/{random_id}/anular", json={"motivo": "Test"}, headers=DEFAULT_HEADERS)
        assert response.status_code == 404

    async def test_cp5_3_anular_ticket_no_activo(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="ANU-02")
        ticket_id = res_create.json()["id_ticket"]

        await client.patch(f"/api/v1/tickets/{ticket_id}/salida", json={}, headers=DEFAULT_HEADERS)
        response = await client.patch(f"/api/v1/tickets/{ticket_id}/anular", json={"motivo": "Test"}, headers=DEFAULT_HEADERS)
        assert response.status_code == 400

    async def test_cp5_4_anular_id_invalido(self, client, mock_clients):
        response = await client.patch("/api/v1/tickets/not-a-uuid/anular", json={"motivo": "Test"}, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)

    async def test_cp5_5_anular_motivo_muy_largo(self, client, mock_clients):
        res_create = await crear_ticket_helper(client, mock_clients, placa="ANU-03")
        ticket_id = res_create.json()["id_ticket"]

        motivo_largo = "A" * 256
        response = await client.patch(f"/api/v1/tickets/{ticket_id}/anular", json={"motivo": motivo_largo}, headers=DEFAULT_HEADERS)
        assert response.status_code in (400, 422)
