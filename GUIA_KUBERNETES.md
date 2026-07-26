# Guía de Implementación de Kubernetes — Proyecto Parqueadero ESPE

> **Universidad de las Fuerzas Armadas ESPE — Aplicaciones Distribuidas**
> Despliegue del sistema de parqueadero (microservicios) en un clúster local de **Kubernetes** usando **Minikube** y **kubectl** en Windows 11.
>
> Esta guía adapta el método de la práctica del docente (Minikube → Namespace → Deployment → Service → Ingress) a la arquitectura real de este proyecto.

---

## 1. Objetivo

Desplegar de forma orquestada, sobre un clúster local de Kubernetes con Minikube, todos los componentes del sistema:

| Capa | Componentes |
|------|-------------|
| **Frontend** | `parking-frontend` (React + Vite) |
| **API Gateway** | `kong` (único punto de entrada público) |
| **Microservicios** | `zonas` (Spring Boot), `vehiculos` (NestJS), `gestion-usuarios` (NestJS/Auth), `ticket-service` (Python/FastAPI), `assignment-service` (Node), `audit-service` (NestJS) |
| **Mensajería** | `rabbitmq` |
| **Bases de datos** | 6 × PostgreSQL (`db-zonas`, `db-vehiculos`, `db-usuarios`, `db-tickets`, `db-asignaciones`, `db-audit`) |

---

## 2. Arquitectura sobre Kubernetes

```
                         Internet / Navegador
                                  │
                                  ▼
                        ┌───────────────────┐
                        │   Ingress NGINX   │  parking.local
                        └─────────┬─────────┘
                                  │
                    ┌─────────────┴───────────────┐
                    ▼                             ▼
             ┌────────────┐               ┌──────────────┐
             │  frontend  │               │   kong :8000 │  (API Gateway)
             └────────────┘               └──────┬───────┘
                                                 │  (enruta /api/...)
        ┌──────────┬──────────┬──────────┬───────┴────┬──────────────┐
        ▼          ▼          ▼          ▼            ▼              ▼
     zonas    vehiculos  gestion-   ticket-     assignment-    audit-
     :8080    :3000      usuarios   service     service        service
                         :3001      :8002       :3002          :3003
        │          │          │          │            │              │
        ▼          ▼          ▼          ▼            ▼              ▼
    db-zonas  db-vehiculos db-usuarios db-tickets db-asignaciones db-audit
       (PostgreSQL — cada uno con su PersistentVolumeClaim)

                    RabbitMQ (mensajería / auditoría) — usado por todos
```

> **Nota clave:** en Kubernetes, cada `Service` es accesible por DNS interno con su **nombre**
> (`nombre-servicio.namespace.svc.cluster.local`). Para **reutilizar tal cual las variables de
> entorno** del `docker-compose.yml` (que usan `http://kong:8000`, `http://gestion-usuarios:3001`,
> `db-zonas:5432`, etc.), en esta guía los `Service` de Kubernetes se nombran **exactamente igual**
> que los servicios de Docker Compose. Así el DNS coincide y no hay que reescribir URLs internas.

---

## 3. Requisitos previos

1. **Windows 11** Home, Pro o Enterprise.
2. **Virtualización habilitada** en la BIOS (VT-x o AMD-V).
3. Un hipervisor / motor de contenedores: **Docker Desktop** con **WSL 2** (recomendado para este proyecto).
4. **PowerShell como administrador**.

### Requisitos mínimos de hardware
Este proyecto es grande (≈13 pods). Se recomienda asignar más recursos que el mínimo del PDF:

- **4 CPU o más**
- **6–8 GB de memoria libre** (mínimo 4 GB)
- **20 GB de espacio libre** en disco
- Conexión a Internet (para descargar imágenes base)

---

## 4. Instalación de Minikube y kubectl

### 4.1 Instalar Minikube

```bash
winget install Kubernetes.minikube
```
o con Chocolatey:
```bash
choco install minikube
```

### 4.2 Instalar kubectl (cliente de Kubernetes)

```bash
winget install -e --id Kubernetes.kubectl
```
o con Chocolatey:
```bash
choco install kubernetes-cli -y
```

### 4.3 Verificar las instalaciones

```bash
minikube version
kubectl version --client
```

---

## 5. Iniciar el clúster

Con Docker Desktop / WSL 2 en ejecución, inicie Minikube con recursos suficientes para el proyecto:

```bash
minikube start --driver=docker --cpus=4 --memory=6144
```

Verificar el nodo:

```bash
kubectl get nodes
```
Salida esperada: el nodo `minikube` en estado **Ready**.

### 5.1 Habilitar el Ingress Controller

El sistema se expondrá por medio de un Ingress, por lo que hay que habilitar el addon:

```bash
minikube addons enable ingress
```

Verificar que el controlador está corriendo:

```bash
kubectl get pods -n ingress-nginx
```

(Opcional) Abrir el dashboard web para monitorear el despliegue:

```bash
minikube dashboard
```

---

## 6. Construir las imágenes dentro de Minikube

A diferencia de la práctica del PDF (que usa una imagen pública ya publicada en Docker Hub),
este proyecto compila sus microservicios desde el código fuente. La forma más simple en local
es **construir las imágenes directamente en el demonio Docker de Minikube**, para no tener que
publicarlas en un registro.

Desde la raíz del proyecto (`PARKING_DISTRIBUIDAS_V2`), ejecute:

```bash
# Apunta tu Docker al demonio interno de Minikube (solo afecta a esta terminal PowerShell)
minikube docker-env | Invoke-Expression

# Construir cada microservicio (usa los Dockerfile existentes de cada carpeta)
docker build -t parking/zonas:latest ./ModuloZonas
docker build -t parking/vehiculos:latest ./VehiclesNPM/vehiculos
docker build -t parking/gestion-usuarios:latest ./gestion-usuarios
docker build -t parking/ticket-service:latest ./ticket-service
docker build -t parking/assignment-service:latest ./assignment-service
docker build -t parking/audit-service:latest ./ms-auditoria
```

> **Importante:** como las imágenes ya están en el demonio de Minikube, en los Deployments se usa
> `imagePullPolicy: IfNotPresent` para que Kubernetes **no intente descargarlas** de un registro externo.

### 6.1 Dockerfile del frontend (crear si no existe)

`parking-frontend` es una app React + Vite y **no tiene Dockerfile**. Cree uno para servir el build con NGINX:

`parking-frontend/Dockerfile`
```dockerfile
# Etapa 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: servir con NGINX
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback para React Router
RUN printf 'server {\n listen 80;\n location / {\n  root /usr/share/nginx/html;\n  try_files $uri $uri/ /index.html;\n }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Luego constrúyalo dentro de Minikube:
```bash
docker build -t parking/frontend:latest ./parking-frontend
```

---

## 7. Estructura de manifiestos

Cree una carpeta `k8s/` en la raíz del proyecto con los manifiestos. Orden sugerido:

```
k8s/
├── 00-namespace.yaml
├── 01-config.yaml          # ConfigMap + Secret con las variables de entorno
├── 02-databases.yaml       # 6 PostgreSQL (Deployment + Service + PVC)
├── 03-rabbitmq.yaml        # RabbitMQ (Deployment + Service)
├── 04-kong.yaml            # ConfigMap con kong.yml + Deployment + Service
├── 05-microservices.yaml   # 6 microservicios (Deployment + Service)
├── 06-frontend.yaml        # Frontend (Deployment + Service)
└── 07-ingress.yaml         # Ingress NGINX (entrada pública)
```

---

## 8. Manifiestos

### 8.1 Namespace — `k8s/00-namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: parking-ns
```

### 8.2 Configuración (ConfigMap + Secret) — `k8s/01-config.yaml`

Centraliza las variables de entorno compartidas (equivalente al `.env`). Los valores sensibles
(claves JWT, API keys) van en un `Secret`.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: parking-config
  namespace: parking-ns
data:
  # Mensajería (el host apunta al Service "rabbitmq")
  RABBITMQ_HOST: "rabbitmq"
  RABBITMQ_PORT: "5672"
  RABBITMQ_USER: "guest"
  RABBITMQ_PASSWORD: "guest"
  RABBITMQ_QUEUE: "audit_queue"
  RABBITMQ_EXCHANGE: "audit_exchange"
  RABBITMQ_ROUTING_KEY: "audit.event"
  AUTHZ_EXCHANGE: "authz_exchange"
  # Gateway y claves públicas (el host apunta al Service "kong")
  KONG_URL: "http://kong:8000"
  PUBLIC_KEY_URL: "http://gestion-usuarios:3001/api/auth/public-key"
---
apiVersion: v1
kind: Secret
metadata:
  name: parking-secret
  namespace: parking-ns
type: Opaque
stringData:
  INTERNAL_API_KEY: "REEMPLAZAR_CON_TU_VALOR"
  JWT_PRIVATE_KEY: "REEMPLAZAR_CON_TU_CLAVE_PRIVADA"
  JWT_PUBLIC_KEY: "REEMPLAZAR_CON_TU_CLAVE_PUBLICA"
```

> ⚠️ Ajusta los valores de `RABBITMQ_*`, `AUTHZ_EXCHANGE`, `PUBLIC_KEY_URL`, `INTERNAL_API_KEY`
> y las claves JWT según tu archivo `.env` real.

### 8.3 Bases de datos PostgreSQL — `k8s/02-databases.yaml`

Cada base tiene su **Deployment**, su **Service** (ClusterIP, puerto interno 5432) y su
**PersistentVolumeClaim** para conservar los datos. Se muestra el patrón completo para `db-zonas`
y luego se replica cambiando nombre, usuario, password y base.

```yaml
# ─────────── db-zonas ───────────
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-zonas-pvc
  namespace: parking-ns
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db-zonas
  namespace: parking-ns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: db-zonas
  template:
    metadata:
      labels:
        app: db-zonas
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - { name: POSTGRES_USER, value: "postgres" }
            - { name: POSTGRES_PASSWORD, value: "12345" }
            - { name: POSTGRES_DB, value: "test" }
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: db-zonas-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: db-zonas          # ← DNS interno: db-zonas:5432
  namespace: parking-ns
spec:
  selector:
    app: db-zonas
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP
```

**Replique el bloque anterior para las 5 bases restantes** con estos valores:

| Nombre | POSTGRES_USER | POSTGRES_PASSWORD | POSTGRES_DB |
|--------|---------------|-------------------|-------------|
| `db-zonas` | `postgres` | `12345` | `test` |
| `db-vehiculos` | `vehiculos` | `vehiculos` | `vehiculos` |
| `db-usuarios` | `usuarios` | `usuarios` | `usuarios` |
| `db-tickets` | `postgres` | `postgres` | `tickets` |
| `db-asignaciones` | `asignaciones` | `asignaciones` | `asignaciones` |
| `db-audit` | `audit` | `audit` | `auditoria` |

Para cada una, cambia el nombre en `PersistentVolumeClaim`, `Deployment`, `Service`, las `labels`
(`app: db-xxx`), el `claimName` y las tres variables `POSTGRES_*`.

### 8.4 RabbitMQ — `k8s/03-rabbitmq.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: parking-ns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
        - name: rabbitmq
          image: rabbitmq:3-management-alpine
          env:
            - { name: RABBITMQ_DEFAULT_USER, value: "guest" }
            - { name: RABBITMQ_DEFAULT_PASS, value: "guest" }
          ports:
            - containerPort: 5672    # AMQP
            - containerPort: 15672   # Panel web
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq          # ← DNS interno: rabbitmq:5672
  namespace: parking-ns
spec:
  selector:
    app: rabbitmq
  ports:
    - { name: amqp, port: 5672, targetPort: 5672 }
    - { name: mgmt, port: 15672, targetPort: 15672 }
  type: ClusterIP
```

### 8.5 Kong (API Gateway) — `k8s/04-kong.yaml`

Kong usa configuración declarativa (`kong.yml`). En Docker Compose se monta como volumen;
en Kubernetes se inyecta mediante un **ConfigMap** generado desde el archivo real:

```bash
kubectl create configmap kong-config \
  --from-file=kong.yml=./kong.yml \
  -n parking-ns \
  --dry-run=client -o yaml > k8s/kong-configmap.yaml
```

Y el Deployment + Service de Kong (`k8s/04-kong.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong
  namespace: parking-ns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kong
  template:
    metadata:
      labels:
        app: kong
    spec:
      containers:
        - name: kong
          image: kong:latest
          env:
            - { name: KONG_DATABASE, value: "off" }
            - { name: KONG_DECLARATIVE_CONFIG, value: "/opt/kong/kong.yml" }
            - { name: KONG_PROXY_ACCESS_LOG, value: "/dev/stdout" }
            - { name: KONG_ADMIN_ACCESS_LOG, value: "/dev/stdout" }
            - { name: KONG_PROXY_ERROR_LOG, value: "/dev/stderr" }
            - { name: KONG_ADMIN_ERROR_LOG, value: "/dev/stderr" }
            - { name: KONG_ADMIN_LISTEN, value: "0.0.0.0:8001" }
            - { name: KONG_UNTRUSTED_LUA_SANDBOX_REQUIRES, value: "resty.http,cjson.safe" }
          ports:
            - containerPort: 8000
            - containerPort: 8001
          volumeMounts:
            - name: kong-config
              mountPath: /opt/kong
      volumes:
        - name: kong-config
          configMap:
            name: kong-config
---
apiVersion: v1
kind: Service
metadata:
  name: kong             # ← DNS interno: kong:8000
  namespace: parking-ns
spec:
  selector:
    app: kong
  ports:
    - { name: proxy, port: 8000, targetPort: 8000 }
    - { name: admin, port: 8001, targetPort: 8001 }
  type: ClusterIP
```

### 8.6 Microservicios — `k8s/05-microservices.yaml`

Patrón para **cada** microservicio: un `Deployment` (con las variables de entorno tomadas del
ConfigMap/Secret) y un `Service` con el mismo nombre que en Docker Compose. Ejemplo completo con
`gestion-usuarios`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gestion-usuarios
  namespace: parking-ns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gestion-usuarios
  template:
    metadata:
      labels:
        app: gestion-usuarios
    spec:
      containers:
        - name: gestion-usuarios
          image: parking/gestion-usuarios:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3001
          env:
            - { name: PORT, value: "3001" }
            - { name: DB_HOST, value: "db-usuarios" }
            - { name: DB_PORT, value: "5432" }
            - { name: DB_USUARIO, value: "usuarios" }
            - { name: DB_CONTRASENA, value: "usuarios" }
            - { name: DB_NOMBRE, value: "usuarios" }
            - { name: ROOT_USER_NAME, value: "super" }
            - { name: ROOT_USER_LASTNAME, value: "usuario" }
            - { name: ROOT_USER_DNI, value: "1728143247" }
            - name: JWT_PRIVATE_KEY
              valueFrom: { secretKeyRef: { name: parking-secret, key: JWT_PRIVATE_KEY } }
            - name: JWT_PUBLIC_KEY
              valueFrom: { secretKeyRef: { name: parking-secret, key: JWT_PUBLIC_KEY } }
            - name: INTERNAL_API_KEY
              valueFrom: { secretKeyRef: { name: parking-secret, key: INTERNAL_API_KEY } }
          envFrom:
            - configMapRef: { name: parking-config }   # inyecta las RABBITMQ_*, AUTHZ_EXCHANGE, etc.
          resources:
            requests: { cpu: "50m", memory: "128Mi" }
            limits:   { cpu: "500m", memory: "512Mi" }
---
apiVersion: v1
kind: Service
metadata:
  name: gestion-usuarios     # ← DNS interno: gestion-usuarios:3001
  namespace: parking-ns
spec:
  selector:
    app: gestion-usuarios
  ports:
    - port: 3001
      targetPort: 3001
  type: ClusterIP
```

**Repita el patrón para los demás microservicios** con estos datos (las variables de entorno
completas están en tu `docker-compose.yml`; use `envFrom` para las comunes y `env` para las
específicas de cada uno):

| Microservicio | Imagen | Puerto | Base de datos | Variables DB específicas |
|---------------|--------|--------|---------------|--------------------------|
| `zonas` | `parking/zonas:latest` | 8080 | `db-zonas` | `SPRING_DATASOURCE_URL=jdbc:postgresql://db-zonas:5432/test`, `SPRING_DATASOURCE_USERNAME=postgres`, `SPRING_DATASOURCE_PASSWORD=12345` |
| `vehiculos` | `parking/vehiculos:latest` | 3000 | `db-vehiculos` | `DB_HOST=db-vehiculos`, `DB_PORT=5432`, `DB_USUARIO=vehiculos`, `DB_CONTRASENA=vehiculos`, `DB_NOMBRE=vehiculos` |
| `gestion-usuarios` | `parking/gestion-usuarios:latest` | 3001 | `db-usuarios` | (ejemplo de arriba) |
| `ticket-service` | `parking/ticket-service:latest` | 8002 | `db-tickets` | `DB_HOST=db-tickets`, `DB_PORT=5432`, `DB_NAME=tickets`, `DB_USER=postgres`, `DB_PASSWORD=postgres` |
| `assignment-service` | `parking/assignment-service:latest` | 3002 | `db-asignaciones` | `DB_HOST=db-asignaciones`, `DB_PORT=5432`, `DB_USUARIO=asignaciones`, `DB_CONTRASENA=asignaciones`, `DB_NOMBRE=asignaciones` |
| `audit-service` | `parking/audit-service:latest` | 3003 | `db-audit` | `DB_HOST=db-audit`, `DB_PORT=5432`, `DB_USER=audit`, `DB_PASSWORD=audit`, `DB_NAME=auditoria` |

> Las URLs internas de servicio a servicio (`http://kong:8000/...`, `http://gestion-usuarios:3001/...`)
> **funcionan sin cambios** porque los `Service` de Kubernetes tienen los mismos nombres.

### 8.7 Frontend — `k8s/06-frontend.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: parking-ns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: parking/frontend:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: parking-ns
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

> Si el frontend consume la API desde el navegador (no desde dentro del clúster), configura su
> URL base para que apunte a `http://parking.local/api` (a través del Ingress) y no a `http://kong:8000`,
> ya que el navegador del usuario no resuelve nombres internos del clúster.

### 8.8 Ingress — `k8s/07-ingress.yaml`

El Ingress es el único punto de entrada público. Enruta el tráfico del navegador: la raíz al
**frontend** y las rutas `/api` al **Kong** (que a su vez distribuye a cada microservicio).

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: parking-ingress
  namespace: parking-ns
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
    - host: parking.local
      http:
        paths:
          # Todo lo que empiece por /api va a Kong
          - path: /(api/.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: kong
                port:
                  number: 8000
          # El resto va al frontend
          - path: /(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

---

## 9. Desplegar todo

Desde la raíz del proyecto, aplique los manifiestos en orden:

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-config.yaml
kubectl apply -f k8s/02-databases.yaml
kubectl apply -f k8s/03-rabbitmq.yaml
kubectl apply -f k8s/kong-configmap.yaml
kubectl apply -f k8s/04-kong.yaml
kubectl apply -f k8s/05-microservices.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-ingress.yaml
```

O todo de una vez (respetando dependencias, aplique primero `00` y `01`):

```bash
kubectl apply -f k8s/
```

---

## 10. Verificar el despliegue

```bash
# Ver todos los pods y su estado (espera a que estén Running / Ready)
kubectl get pods -n parking-ns -w

# Ver todo de un vistazo
kubectl get all -n parking-ns

# Ver el ingress
kubectl get ingress -n parking-ns

# Revisar logs de un servicio (ej. gestión de usuarios)
kubectl logs -n parking-ns deploy/gestion-usuarios
```

### 10.1 Configurar el dominio local

```bash
# Obtener la IP de Minikube (CMD/PowerShell como admin)
minikube ip

# Editar el archivo hosts como administrador
notepad C:\Windows\System32\drivers\etc\hosts

# Añadir la línea (reemplaza <IP> por la que devolvió "minikube ip"):
# <IP>   parking.local
```

Luego acceda desde el navegador a: **http://parking.local**

> En Windows con el driver Docker, a veces el Ingress no es directamente alcanzable por la IP de
> Minikube. Si `parking.local` no responde, ejecute en una terminal aparte:
> ```bash
> minikube tunnel
> ```
> y use `127.0.0.1 parking.local` en el archivo hosts.

---

## 11. Alternativa: acceso por port-forward

Si tiene problemas con el Ingress/DNS/hosts, puede exponer cualquier servicio directamente:

```bash
# Frontend
kubectl port-forward -n parking-ns svc/frontend 8000:80
#  → http://localhost:8000

# API Gateway (Kong)
kubectl port-forward -n parking-ns svc/kong 8080:8000
#  → http://localhost:8080/api/...

# Panel de RabbitMQ
kubectl port-forward -n parking-ns svc/rabbitmq 15672:15672
#  → http://localhost:15672  (guest / guest)
```

---

## 12. Comandos útiles y solución de problemas

| Situación | Comando |
|-----------|---------|
| Ver por qué un pod no arranca | `kubectl describe pod <pod> -n parking-ns` |
| Ver logs en vivo | `kubectl logs -f deploy/<servicio> -n parking-ns` |
| Reiniciar un despliegue | `kubectl rollout restart deploy/<servicio> -n parking-ns` |
| Escalar réplicas | `kubectl scale deploy/<servicio> --replicas=2 -n parking-ns` |
| Entrar a un contenedor | `kubectl exec -it deploy/<servicio> -n parking-ns -- sh` |
| Reconstruir una imagen y recargarla | `docker build -t parking/<svc>:latest ./<carpeta>` (con `minikube docker-env` activo) + `rollout restart` |

**Errores frecuentes:**

- **`ImagePullBackOff` / `ErrImagePull`** → la imagen no está en Minikube. Verifica que
  construiste con `minikube docker-env` activo y que el Deployment usa `imagePullPolicy: IfNotPresent`.
- **Un microservicio en `CrashLoopBackOff`** → suele ser que su base de datos o RabbitMQ aún no
  está lista. Kubernetes reintenta solo; revisa logs con `kubectl logs`. Puedes añadir
  `readinessProbe`/`initContainers` para ordenar el arranque.
- **`502 Bad Gateway` en el Ingress** → el Service destino aún no tiene pods `Ready`.

### Limpiar todo

```bash
kubectl delete namespace parking-ns     # borra todos los recursos del proyecto
minikube delete --all                   # borra el clúster completo
```

---

## 13. Checklist de entrega

- [ ] Minikube y kubectl instalados y verificados.
- [ ] Clúster iniciado con recursos suficientes (`--cpus=4 --memory=6144`).
- [ ] Addon `ingress` habilitado.
- [ ] 6 imágenes de microservicios + imagen del frontend construidas en Minikube.
- [ ] Namespace `parking-ns` creado.
- [ ] ConfigMap y Secret aplicados con los valores reales del `.env`.
- [ ] 6 bases de datos PostgreSQL con sus PVC en estado `Running`.
- [ ] RabbitMQ y Kong desplegados.
- [ ] 6 microservicios + frontend desplegados y `Ready`.
- [ ] Ingress creado y `parking.local` en el archivo `hosts`.
- [ ] Aplicación accesible desde `http://parking.local` (o vía `port-forward`).

---

### Tabla de referencia: Tipos de Service en Kubernetes

| Tipo | Qué hace | Uso en este proyecto |
|------|----------|----------------------|
| **ClusterIP** | IP interna del clúster, solo accesible dentro | Bases de datos, microservicios, RabbitMQ, Kong |
| **NodePort** | Puerto estático en el nodo (30000–32767) | Alternativa rápida para exponer sin Ingress |
| **LoadBalancer** | Balanceador externo (cloud) | Producción en AWS/GCP/Azure |
| **Ingress** (recurso) | Enrutamiento HTTP/HTTPS por host y ruta | Entrada pública única (`parking.local`) |
```
