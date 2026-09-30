# Despliegue en el servidor (Ibero)

Kan se construye desde este fork (no se usa la imagen oficial, que no trae
nuestros cambios) y corre con Docker detrás del Nginx del servidor.

```
Internet ──HTTPS──> Nginx ──> 127.0.0.1:3100  Kan (web)
                          └─> 127.0.0.1:9100  RustFS (imágenes, S3)
                     Docker interno: Postgres (sin puerto expuesto)
```

## 0. Requisitos

- Docker y Docker Compose, Nginx y Certbot en el servidor.
- Dos registros DNS **A** apuntando a la IP del servidor, por ejemplo:
  - `tablero.ejemplo.org` → la app
  - `archivos-tablero.ejemplo.org` → el almacenamiento (el navegador sube
    las imágenes directo ahí, por eso necesita su propio dominio)

## 1. Clonar

```bash
git clone https://github.com/JohnTenno/kan.git ~/kan-ibero
cd ~/kan-ibero
```

## 2. Configurar

```bash
cp .env.production.example .env
nano .env
```

Poner los dos dominios y generar cada secreto con `openssl rand -hex 32`
(`BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `S3_SECRET_ACCESS_KEY`).
Proteger el archivo: `chmod 600 .env`.

## 3. Construir y arrancar

```bash
docker compose -f docker-compose.ibero.yml up -d --build
```

La primera construcción tarda varios minutos. Revisar que todo quedó bien:

```bash
docker compose -f docker-compose.ibero.yml ps -a
docker compose -f docker-compose.ibero.yml logs migrate s3-init
curl -I http://127.0.0.1:3100
```

`migrate` y `s3-init` deben terminar con código 0; `web`, `postgres` y `s3`
deben quedar "Up".

## 4. Nginx y HTTPS

```bash
sudo cp deploy/nginx/kan.conf.example /etc/nginx/sites-available/kan
sudo nano /etc/nginx/sites-available/kan      # cambiar los dos dominios
sudo ln -s /etc/nginx/sites-available/kan /etc/nginx/sites-enabled/kan
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tablero.ejemplo.org -d archivos-tablero.ejemplo.org
```

`nginx -t` debe decir "syntax is ok" **antes** de recargar, para no afectar
los demás sitios del servidor.

## 5. Primer uso

Abrir `https://tablero.ejemplo.org/signup`, crear la cuenta y probar subir
una imagen a una tarjeta.

## Actualizar

```bash
cd ~/kan-ibero
git pull
docker compose -f docker-compose.ibero.yml up -d --build
```

Así lo desplegado coincide siempre con lo publicado en GitHub (requisito de
la AGPLv3).

## Respaldos

Base de datos (diario, por ejemplo con cron):

```bash
docker compose -f docker-compose.ibero.yml exec -T postgres \
  pg_dump -U kan kan_db | gzip > ~/respaldos/kan-$(date +%F).sql.gz
```

Imágenes y adjuntos: respaldar el volumen `kan-ibero_kan_s3_data`.
