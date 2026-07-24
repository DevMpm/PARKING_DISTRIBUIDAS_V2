"""
Seed de un usuario MULTI-ROL para probar el flujo pre-auth (Fase 1).

Crea (o reutiliza) una persona -> obtiene rol CLIENTE automaticamente,
luego le asigna ADMIN y RECAUDADOR. Resultado: usuario con 3 roles activos,
que al hacer login debe recibir { requiresRoleSelection: true, pre_auth_token, roles }.

Al final prueba el flujo completo: login -> select-role -> access_token.

Ejecucion:  python seed_multirole_user.py
Requiere:   pip install requests   (y el stack docker levantado en localhost:8000)
"""
import requests

BASE = "http://localhost:8000/api"
HEADERS = {"Content-Type": "application/json"}

# Credenciales ROOT (definidas en docker-compose: super / usuario / 1728143247)
ROOT_USER = "susuario"
ROOT_PASS = "1728143247"

# Roles extra a asignar (ademas del CLIENTE automatico)
EXTRA_ROLES = ["ADMIN", "RECAUDADOR"]


def generate_valid_cedula(provincia: int, seq: int) -> str:
    """Genera una cedula ecuatoriana valida con digito verificador."""
    base = f"{provincia:02d}{seq:07d}"  # 9 digitos
    coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i, c in enumerate(coefs):
        v = int(base[i]) * c
        if v >= 10:
            v -= 9
        total += v
    check = (10 - (total % 10)) % 10
    return base + str(check)


# Persona dedicada de prueba (cedula fija -> idempotente).
# seq bajo para que el 3er digito sea <6 (requisito de cedula de persona natural)
# y distinto de los usuarios del seed general (10000..10009).
DNI = generate_valid_cedula(17, 20001)
PERSONA = {
    "firstName": "Multi",
    "lastName": "Rol",
    "dni": DNI,
    "email": "multi.rol@parking.com",
    "phone": "+593912349999",
    "nationality": "Ecuatoriano",
}


def auth_h(token):
    return {**HEADERS, "Authorization": f"Bearer {token}"}


def login_raw(username, password):
    """Devuelve el JSON completo del login (puede ser par de tokens o pre-auth)."""
    res = requests.post(f"{BASE}/usuarios/auth/login",
                        json={"username": username, "password": password})
    return res.status_code, (res.json() if res.headers.get("content-type", "").startswith("application/json") else res.text)


def get_access_token(username, password, prefer=("ROOT", "ADMIN")):
    """Login que resuelve automaticamente el pre-auth eligiendo un rol admin.

    Devuelve un access_token utilizable, o None si falla.
    """
    code, data = login_raw(username, password)
    if code != 200:
        return None
    # Caso 1 rol: par de tokens directo
    if isinstance(data, dict) and "access_token" in data:
        return data["access_token"]
    # Caso >1 rol: pre-auth -> elegir rol
    if isinstance(data, dict) and data.get("requiresRoleSelection"):
        roles = data["roles"]
        chosen = next((r for r in prefer if r in roles), roles[0])
        sr = requests.post(f"{BASE}/usuarios/auth/select-role",
                           json={"role": chosen}, headers=auth_h(data["pre_auth_token"]))
        if sr.status_code == 200 and "access_token" in sr.json():
            return sr.json()["access_token"]
    return None


def main():
    print("=" * 64)
    print("  SEED USUARIO MULTI-ROL - prueba flujo pre-auth")
    print("=" * 64)

    # 1) Login ROOT (resuelve pre-auth automaticamente si ROOT es multi-rol)
    print("\n[1] Login como ROOT...")
    root_token = get_access_token(ROOT_USER, ROOT_PASS)
    if not root_token:
        print("  [X] No se pudo autenticar ROOT.")
        return
    h = auth_h(root_token)
    print("  [OK] ROOT autenticado")

    # 2) Crear persona (auto rol CLIENTE) o reutilizar si ya existe
    print(f"\n[2] Creando persona de prueba (DNI {DNI})...")
    res = requests.post(f"{BASE}/usuarios/personas", json=PERSONA)
    user_id = None
    username = None
    if res.status_code == 201:
        d = res.json()
        user_id = d["user"]["id"]
        username = d["user"]["username"]
        print(f"  [OK] Persona creada -> user: {username} (pwd: {DNI})")
    elif res.status_code == 409:
        print("  [!!] Ya existe, reutilizando...")
        pr = requests.get(f"{BASE}/usuarios/personas/dni/{DNI}", headers=h)
        if pr.status_code == 200:
            pd = pr.json()
            user_id = pd["user"]["id"]
            username = pd["user"]["username"]
            print(f"  [OK] Reutilizado -> user: {username}")
    if not user_id:
        print(f"  [X] No se pudo obtener el usuario: {res.status_code} {res.text[:150]}")
        return

    # 3) Asignar roles extra
    print("\n[3] Asignando roles extra...")
    for role in EXTRA_ROLES:
        r = requests.post(f"{BASE}/usuarios/roleusers",
                          json={"id_user": user_id, "role_name": role}, headers=h)
        if r.status_code in (200, 201):
            print(f"  [OK] {username} -> {role}")
        elif r.status_code == 409:
            print(f"  [=] {username} ya tenia {role}")
        else:
            print(f"  [!!] {username} -> {role}: {r.status_code} {r.text[:100]}")

    # 4) Probar login -> debe pedir seleccion de rol
    print("\n[4] Probando login del usuario multi-rol...")
    code, data = login_raw(username, DNI)
    if code != 200:
        print(f"  [X] Login fallo ({code}): {str(data)[:150]}")
        return

    if isinstance(data, dict) and data.get("requiresRoleSelection"):
        roles = data["roles"]
        pre = data["pre_auth_token"]
        print(f"  [OK] Login devolvio pre-auth. Roles disponibles: {roles}")
        print(f"       pre_auth_token (recortado): {pre[:40]}...")

        # 5) select-role con el primer rol
        chosen = roles[0]
        print(f"\n[5] POST /auth/select-role con rol '{chosen}'...")
        sr = requests.post(f"{BASE}/usuarios/auth/select-role",
                           json={"role": chosen}, headers=auth_h(pre))
        if sr.status_code == 200 and "access_token" in sr.json():
            print(f"  [OK] access_token emitido para rol unico '{chosen}'.")
        else:
            print(f"  [X] select-role fallo: {sr.status_code} {sr.text[:150]}")

        # 5b) rol ajeno debe dar 403
        print("\n[5b] Verificando rechazo de rol ajeno...")
        bad = requests.post(f"{BASE}/usuarios/auth/select-role",
                            json={"role": "ROL_INEXISTENTE"}, headers=auth_h(pre))
        print(f"  -> status esperado 403, obtenido: {bad.status_code}")
    else:
        print("  [!!] El login NO pidio seleccion de rol.")
        print("       Probable causa: el contenedor gestion-usuarios corre codigo VIEJO.")
        print("       Reconstruye:  docker compose up -d --build gestion-usuarios")
        print(f"       Respuesta recibida: {str(data)[:150]}")

    print("\n" + "=" * 64)
    print(f"  USUARIO DE PRUEBA:  {username}   /   {DNI}")
    print(f"  ROLES: CLIENTE + {' + '.join(EXTRA_ROLES)}")
    print("=" * 64)


if __name__ == "__main__":
    main()
