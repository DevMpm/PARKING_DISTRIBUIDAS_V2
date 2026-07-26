# Construye todas las imagenes del proyecto DENTRO del demonio Docker de Minikube.
# Uso (desde la raiz del proyecto):
#   powershell -ExecutionPolicy Bypass -File k8s/build-images.ps1

Write-Host "==> Apuntando Docker al demonio de Minikube..." -ForegroundColor Cyan
minikube docker-env | Invoke-Expression

$images = @(
    @{ tag = "parking/zonas:latest";              context = "./ModuloZonas" },
    @{ tag = "parking/vehiculos:latest";          context = "./VehiclesNPM/vehiculos" },
    @{ tag = "parking/gestion-usuarios:latest";   context = "./gestion-usuarios" },
    @{ tag = "parking/ticket-service:latest";     context = "./ticket-service" },
    @{ tag = "parking/assignment-service:latest"; context = "./assignment-service" },
    @{ tag = "parking/audit-service:latest";      context = "./ms-auditoria" },
    @{ tag = "parking/frontend:latest";           context = "./parking-frontend" }
)

foreach ($img in $images) {
    Write-Host ("==> Construyendo {0} desde {1}" -f $img.tag, $img.context) -ForegroundColor Green
    docker build -t $img.tag $img.context
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("ERROR construyendo {0}" -f $img.tag) -ForegroundColor Red
        exit 1
    }
}

Write-Host "==> Listo. Imagenes disponibles en Minikube:" -ForegroundColor Cyan
docker images --filter "reference=parking/*"
