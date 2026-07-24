"""
Prueba end-to-end de Autenticación + Autorización (Fases 1-4).
Ejecuta:  python test_auth_authz.py
Requiere: stack docker levantado + usuario multi-rol sembrado (seed_multirole_user.py).

Imprime PASS/FAIL por cada verificación. No deja datos residuales (restaura permisos).
"""
import sys
import time
import uuid

import requests

KONG = "http://localhost:8000/api"
INTERNAL = "http://localhost:3001/api/usuarios"  # acceso directo (como los consumidores)
INTERNAL_KEY = "dev-internal-key-change-me"       # == INTERNAL_API_KEY del .env

# Usuario multi-rol de prueba (crear antes con seed_multirole_user.py)
MULTI_USER, MULTI_PASS = "mrol", "1700200015"
ROOT_USER, ROOT_PASS = "susuario", "1728143247"

ok_count = 0
fail_count = 0


def check(label, condition, extra=""):
    global ok_count, fail_count
    mark = "PASS" if condition else "FAIL"
    if condition:
        ok_count += 1
    else:
        fail_count += 1
    print(f"  [{mark}] {label}{('  -> ' + extra) if extra else ''}")


def login_raw(user, pw):
    return requests.post(f"{KONG}/usuarios/auth/login", json={"username": user, "password": pw}).json()


def get_token(user, pw, prefer):
    d = login_raw(user, pw)
    if "access_token" in d:
        return d["access_token"]
    pre = d["pre_auth_token"]
    role = next((r for r in d["roles"] if r in prefer), d["roles"][0])
    r = requests.post(f"{KONG}/usuarios/auth/select-role",
                      json={"role": role}, headers={"Authorization": f"Bearer {pre}"})
    return r.json()["access_token"]


def perm_id(name):
    # requiere psql; si no, devuelve None y se omiten los tests que lo usan
    import subprocess
    try:
        out = subprocess.run(
            ["docker", "exec", "db-usuarios", "psql", "-U", "usuarios", "-d", "usuarios",
             "-t", "-c", f"SELECT id FROM permission WHERE name='{name}';"],
            capture_output=True, text=True, timeout=15,
        )
        return out.stdout.strip() or None
    except Exception:
        return None


def role_id(name):
    import subprocess
    try:
        out = subprocess.run(
            ["docker", "exec", "db-usuarios", "psql", "-U", "usuarios", "-d", "usuarios",
             "-t", "-c", f"SELECT id FROM role WHERE name='{name}';"],
            capture_output=True, text=True, timeout=15,
        )
        return out.stdout.strip() or None
    except Exception:
        return None


def main():
    print("=" * 70)
    print("  PRUEBA AUTH + AUTHZ  (Fases 1-4)")
    print("=" * 70)

    # ---------------- FASE 1: pre-auth / selección de rol ----------------
    print("\n[FASE 1] Autenticación con selección de rol")
    d = login_raw(MULTI_USER, MULTI_PASS)
    check("login multi-rol pide selección de rol", d.get("requiresRoleSelection") is True,
          f"roles={d.get('roles')}")
    if d.get("requiresRoleSelection"):
        pre = d["pre_auth_token"]
        # rol válido -> access
        r = requests.post(f"{KONG}/usuarios/auth/select-role",
                          json={"role": d["roles"][0]}, headers={"Authorization": f"Bearer {pre}"})
        check("select-role con rol válido -> 200 + access_token",
              r.status_code == 200 and "access_token" in r.json())
        # rol ajeno -> 403
        r = requests.post(f"{KONG}/usuarios/auth/select-role",
                          json={"role": "ROL_INEXISTENTE"}, headers={"Authorization": f"Bearer {pre}"})
        check("select-role con rol ajeno -> 403", r.status_code == 403)
        # token pre-auth en endpoint normal -> 401
        r = requests.get(f"{KONG}/v1/zonas/", headers={"Authorization": f"Bearer {pre}"})
        check("token pre-auth en endpoint normal -> 401", r.status_code == 401, f"status={r.status_code}")

    # usuario de 1 solo rol entra directo (ROOT tiene 2, no sirve; probamos con el flujo general)
    # ---------------- FASE 3: endpoint interno ----------------
    print("\n[FASE 3] Endpoint interno de permisos (pull)")
    url = f"{INTERNAL}/internal/role-permissions/resolve"
    r = requests.post(url, json={"role": "ADMIN", "serviceId": "zonas-service"})
    check("sin x-internal-key -> 401", r.status_code == 401)
    r = requests.post(url, json={"role": "ADMIN", "serviceId": "zonas-service"},
                      headers={"x-internal-key": "clave-mala"})
    check("con clave incorrecta -> 401", r.status_code == 401)
    r = requests.post(url, json={"role": "ADMIN", "serviceId": "zonas-service"},
                      headers={"x-internal-key": INTERNAL_KEY})
    perms = r.json().get("permissions", []) if r.status_code == 200 else []
    check("ADMIN/zonas-service devuelve ZONAS_*", "ZONAS_READ" in perms, str(perms))
    r = requests.post(url, json={"role": "NOPE", "serviceId": "zonas-service"},
                      headers={"x-internal-key": INTERNAL_KEY})
    check("rol inexistente -> 200 []", r.status_code == 200 and r.json().get("permissions") == [])

    # ---------------- FASE 4: pull + caché + invalidación ----------------
    print("\n[FASE 4] Autorización pull en consumidores (con invalidación)")
    admin = get_token(MULTI_USER, MULTI_PASS, ("ADMIN",))
    root = get_token(ROOT_USER, ROOT_PASS, ("ROOT", "ADMIN"))
    Ha = {"Authorization": f"Bearer {admin}"}
    Hr = {"Authorization": f"Bearer {root}"}

    # ticket-service: RECAUDADOR tiene TICKETS_READ, ADMIN no
    recaud = get_token(MULTI_USER, MULTI_PASS, ("RECAUDADOR",))
    rid = str(uuid.uuid4())
    r = requests.get(f"{KONG}/v1/tickets/{rid}", headers={"Authorization": f"Bearer {recaud}"})
    check("[tickets] RECAUDADOR pasa permiso (404 no-existe)", r.status_code == 404, f"status={r.status_code}")
    r = requests.get(f"{KONG}/v1/tickets/{rid}", headers=Ha)
    check("[tickets] ADMIN sin TICKETS_READ -> 403", r.status_code == 403, f"status={r.status_code}")

    # zonas: test definitivo pull + invalidación
    ADMIN_ID = role_id("ADMIN")
    ZR = perm_id("ZONAS_READ")
    if ADMIN_ID and ZR:
        s1 = requests.get(f"{KONG}/v1/zonas/", headers=Ha).status_code
        check("[zonas] ADMIN GET -> 200 (pull)", s1 == 200, f"status={s1}")
        requests.delete(f"{KONG}/usuarios/roles/{ADMIN_ID}/permissions/{ZR}", headers=Hr)
        time.sleep(1.5)  # dar tiempo al evento de invalidación
        s2 = requests.get(f"{KONG}/v1/zonas/", headers=Ha).status_code
        check("[zonas] tras quitar ZONAS_READ, MISMO token -> 403 (pull+invalidación)", s2 == 403, f"status={s2}")
        requests.post(f"{KONG}/usuarios/roles/{ADMIN_ID}/permissions/{ZR}", headers=Hr)
        time.sleep(1.5)
        s3 = requests.get(f"{KONG}/v1/zonas/", headers=Ha).status_code
        check("[zonas] re-asignado, MISMO token -> 200 (estado restaurado)", s3 == 200, f"status={s3}")
    else:
        print("  [SKIP] tests de zonas (no se pudo consultar la BD con psql)")

    # ---------------- Resumen ----------------
    print("\n" + "=" * 70)
    print(f"  RESULTADO:  {ok_count} PASS / {fail_count} FAIL")
    print("=" * 70)
    sys.exit(1 if fail_count else 0)


if __name__ == "__main__":
    main()
