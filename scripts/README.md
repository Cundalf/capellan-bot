# Scripts de Mantenimiento - Capellán Bot

Esta carpeta contiene scripts de mantenimiento y administración para el Capellán Bot. Estos scripts están diseñados para ejecutarse desde la línea de comandos y no están expuestos en Discord por razones de seguridad.

## 📋 Scripts Disponibles

### `backup.ts` - Crear Backup del Sistema
```bash
bun run scripts/backup.ts
```

**Propósito:** Crear un backup completo de los datos críticos del bot.

**Incluye:**
- Base de datos vectorial (`vector-store.sqlite`)
- Perfiles de usuarios (`user-profiles.json`)
- Lista de inquisidores (`inquisidores.json`)
- Logs del bot (`bot.log`)

**Características:**
- Crea directorio con timestamp único
- Mantiene automáticamente solo los últimos 10 backups
- Genera archivo de metadatos con información del backup

### `maintenance.ts` - Optimización y Validación
```bash
bun run scripts/maintenance.ts
```

**Propósito:** Optimizar la base de datos y validar la integridad de los datos.

**Funciones:**
- **Optimización SQLite:** VACUUM, ANALYZE, REINDEX
- **Validación de perfiles:** Verificar campos requeridos y tipos de datos
- **Validación de inquisidores:** Verificar rangos y consistencia
- **Validación cruzada:** Verificar coherencia entre archivos

### `purge.ts` - Reconstruir Índice de Conocimiento
```bash
bun run scripts/purge.ts
```

**Propósito:** Eliminar completamente el índice de conocimiento y reconstruirlo desde cero.

**⚠️ ADVERTENCIA:** Esta operación es **IRREVERSIBLE**

**Cuándo usar:**
- Corrupción del índice de conocimiento
- Problemas de rendimiento en búsquedas
- Después de actualizaciones importantes del sistema
- Reset completo del conocimiento

**Proceso:**
1. Solicita confirmación (escribir "PURGAR")
2. Elimina todos los embeddings existentes
3. Limpia las tablas de documentos y vectores
4. Deja el índice listo para nuevos documentos

## 🛠️ Uso Recomendado

### Mantenimiento Regular
```bash
# Crear backup antes de cualquier mantenimiento
bun run scripts/backup.ts

# Ejecutar mantenimiento de optimización
bun run scripts/maintenance.ts
```

### Resolución de Problemas
```bash
# Si hay problemas con el índice de conocimiento
bun run scripts/purge.ts

# Después de la purga, recrear backup
bun run scripts/backup.ts
```

### Integración con Herramientas Externas

Los scripts están diseñados para integrarse fácilmente con herramientas de backup externas:

- **Cron jobs:** Para backups automáticos
- **Docker:** Para ejecución en contenedores
- **CI/CD:** Para validación en pipelines
- **Monitoreo:** Para alertas de salud del sistema

## 📁 Estructura de Archivos

```
scripts/
├── README.md          # Esta documentación
├── backup.ts          # Script de backup
├── maintenance.ts     # Script de mantenimiento
└── purge.ts          # Script de purga del índice
```

## 🔒 Consideraciones de Seguridad

- **No exponer en Discord:** Estos scripts no están disponibles como comandos de Discord
- **Permisos de archivo:** Asegurar permisos apropiados en el sistema de archivos
- **Backups regulares:** Ejecutar backups antes de operaciones destructivas
- **Validación:** Siempre validar la integridad después de operaciones críticas

## 🚨 Solución de Problemas

### Error: "Base de datos no encontrada"
- Asegurar que el bot haya sido ejecutado al menos una vez
- Verificar que la carpeta `database/` existe

### Error: "Permisos insuficientes"
- Verificar permisos de escritura en la carpeta `database/`
- Ejecutar con permisos apropiados

### Error: "Índice corrupto"
- Usar `purge.ts` para reconstruir el índice
- Restaurar desde backup si es necesario

## 📞 Soporte

Para problemas técnicos, consultar los logs del bot en `logs/bot.log` o contactar al equipo de desarrollo.
