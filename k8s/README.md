# Despliegue en Kubernetes — carpeta `k8s/`

Manifiestos para desplegar el sistema de parqueadero en Minikube.
Guía completa y explicada: [`../GUIA_KUBERNETES.md`](../GUIA_KUBERNETES.md).

## Contenido

| Archivo | Qué crea |
|---------|----------|
| `00-namespace.yaml` | Namespace `parking-ns` |
| `01-config.yaml` | ConfigMap (variables comunes) + Secret (JWT, API key) |
| `02-databases.yaml` | 6 PostgreSQL (Deployment + Service + PVC) |
| `03-rabbitmq.yaml` | RabbitMQ |
| `04-kong.yaml` | Kong (API Gateway) — requiere el ConfigMap `kong-config` |
| `05-microservices.yaml` | 6 microservicios |
| `06-frontend.yaml` | Frontend React |
| `07-ingress.yaml` | Ingress público (`parking.local`) |

## Pasos (desde la raíz del proyecto)

### 1. Iniciar Minikube y habilitar Ingress
```powershell
minikube start --driver=docker --cpus=4 --memory=6144
minikube addons enable ingress
```

### 2. Construir las imágenes dentro de Minikube
```powershell
# Apuntar Docker al demonio de Minikube (solo esta terminal)
minikube docker-env | Invoke-Expression

# Construir todas las imágenes
docker build -t parking/zonas:latest ./ModuloZonas
docker build -t parking/vehiculos:latest ./VehiclesNPM/vehiculos
docker build -t parking/gestion-usuarios:latest ./gestion-usuarios
docker build -t parking/ticket-service:latest ./ticket-service
docker build -t parking/assignment-service:latest ./assignment-service
docker build -t parking/audit-service:latest ./ms-auditoria
docker build -t parking/frontend:latest ./parking-frontend
```
> Atajo: `powershell -ExecutionPolicy Bypass -File k8s/build-images.ps1`

### 3. Editar los valores sensibles
Abre `k8s/01-config.yaml` y reemplaza los placeholders (`INTERNAL_API_KEY`,
`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`) con los valores reales de tu archivo `.env`.

### 4. Aplicar los manifiestos
```powershell
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-config.yaml
kubectl apply -f k8s/02-databases.yaml
kubectl apply -f k8s/03-rabbitmq.yaml

# ConfigMap de Kong generado desde el kong.yml real del proyecto:
kubectl create configmap kong-config --from-file=kong.yml=./kong.yml -n parking-ns

kubectl apply -f k8s/04-kong.yaml
kubectl apply -f k8s/05-microservices.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-ingress.yaml
```

### 5. Verificar
```powershell
kubectl get pods -n parking-ns -w
kubectl get all -n parking-ns
```

### 6. Acceder
```powershell
minikube ip   # copia la IP y añádela en C:\Windows\System32\drivers\etc\hosts:
#   <IP>   parking.local
```
Navegar a **http://parking.local**

Si el Ingress no responde, usa port-forward:
```powershell
kubectl port-forward -n parking-ns svc/frontend 8000:80   # http://localhost:8000
kubectl port-forward -n parking-ns svc/kong 8080:8000      # http://localhost:8080/api/...
```

## Actualizar un servicio tras cambiar código
```powershell
minikube docker-env | Invoke-Expression
docker build -t parking/<servicio>:latest ./<carpeta>
kubectl rollout restart deploy/<servicio> -n parking-ns
```

## Limpiar
```powershell
kubectl delete namespace parking-ns
kubectl delete configmap kong-config -n parking-ns   # (si el namespace ya fue borrado, se elimina con él)
```
