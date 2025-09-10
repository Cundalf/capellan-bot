# 🕊️ Bot Capellán de Warhammer 40k

## 📋 Descripción del Proyecto

Un bot de Discord que simula un **Capellán de los Adeptus Astartes** en el universo de Warhammer 40k. Utiliza inteligencia artificial (OpenAI) con sistema RAG (Retrieval Augmented Generation) para:

- 🔍 **Detectar herejía** en mensajes usando conocimiento real del lore
- 📖 **Generar sermones diarios** basados en doctrina imperial  
- 📥 **Expandir conocimiento** descargando automáticamente contenido del Lexicanum
- 👁️ **Sistema de Inquisidores** para administración temática
- 🧠 **Base vectorial SQLite** para búsqueda semántica inteligente
- 🏆 **Sistema de gamificación** con puntos de pureza/corrupción y rankings
- ⚡ **Desarrollado en Bun + TypeScript** para máximo rendimiento

## 🎯 Funcionalidades Principales

### ✅ **Comandos para Todos los Usuarios**
- `!capellan herejia [mensaje]` - Análisis de herejía con IA contextual
- `!capellan sermon [tema]` - Sermones inspiradores personalizados
- `!capellan bendicion [@usuario]` - Bendiciones imperiales entre usuarios
- `!capellan credo` - Recitar credos y oraciones del 40k
- `!capellan buscar [término]` - Búsqueda inteligente en documentos sagrados
- `!capellan fuentes [página]` - Lista de todas las fuentes de conocimiento
- `!capellan ranking [subcomando]` - Ver rankings, perfiles y logros
- `!capellan imperio [subcomando]` - **NUEVO**: Guía completa del sistema de gamificación
- `!capellan help` - Ayuda contextual completa

### ✅ **Comandos de Inquisidor (Administradores)**
- `!capellan agregar [URL/texto]` - Agregar conocimiento desde webs o texto
- `!capellan penitencia [@usuario] [horas] [razón]` - Asignar penitencias (múltiples activas)
- `!capellan penitencia remover [@usuario|pen_id]` - **NUEVO**: Remover por usuario o ID específico
- `!capellan penitencia lista` - **NUEVO**: Ver todas las penitencias activas con IDs
- `!capellan inquisidor [subcomando]` - Gestión de administradores
- `!capellan stats` - **ACTUALIZADO**: Solo para Inquisidores (era público)
- `!capellan purgar` - Reconstruir completamente el índice RAG

### 🚫 **Comandos Administrativos Removidos por Seguridad**
Los comandos de "Inquisidor Supremo" han sido **completamente eliminados de Discord** por razones de seguridad. 
Todas las operaciones administrativas ahora se ejecutan mediante **scripts de Bun** y **cron jobs automatizados**.

**Razones del cambio:**
- 🔒 **Seguridad mejorada**: Ningún comando destructivo accesible desde Discord
- 💰 **Control de costos**: Prevenir uso accidental de recursos
- ⚡ **Automatización**: Tareas críticas ejecutadas automáticamente
- 📋 **Auditabilidad**: Logs detallados de todas las operaciones administrativas

## 🛡️ Sistema de Seguridad y Control de Costos

### **🕐 Rate Limiting para Comandos de IA**
- **Límite**: 3 comandos de IA por usuario cada 60 segundos
- **Comandos afectados**: `herejia`, `sermon`, `conocimiento`, `buscar`, `purga`
- **Exención**: Los Inquisidores no tienen límites de rate limiting
- **Feedback**: Mensajes claros sobre tiempo restante para próximo comando

### **🔄 Control de Tareas de IA**
- **Una tarea de IA global** a la vez para prevenir sobrecarga de OpenAI
- **Mensajes informativos** cuando el Capellán está ocupado atendiendo otro usuario
- **Limpieza automática** de tareas bloqueadas después de 5 minutos
- **Seguimiento en tiempo real** de todas las operaciones activas

### **⚡ Sistema de Penitencias Mejorado**
- **Múltiples penitencias** activas por usuario simultáneamente
- **IDs únicos** para seguimiento preciso de cada penitencia
- **Protección de Inquisidores**: No pueden asignarse penitencias entre sí
- **Gestión granular**: Remover penitencias específicas por ID
- **Historial completo** de todas las penitencias (activas e inactivas)

### **🔒 Seguridad Administrativa Completa**
- **Comandos Discord eliminados**: Todos los comandos administrativos removidos de Discord
- **Solo scripts Bun**: Operaciones críticas ejecutables solo desde línea de comandos
- **Cron jobs automatizados**: Tareas de mantenimiento programadas automáticamente
- **Logs detallados**: Todas las operaciones administrativas son auditables
- **Acceso físico requerido**: Solo quien tenga acceso al servidor puede ejecutar comandos administrativos

## 🏆 Sistema de Gamificación Imperial

### **Rangos de Fe (9 niveles)**
| Rango | Puntos Netos | Emoji | Descripción |
|-------|-------------|--------|-------------|
| Herético | < -100 | 💀 | Alma corrupta por el Caos |
| Sospechoso | -100 a -50 | ❓ | Bajo vigilancia inquisitorial |
| Ciudadano | -50 a 50 | 👤 | Ciudadano imperial común |
| Fiel | 50 a 150 | 🙏 | Servidor devoto del Emperador |
| Devoto | 150 a 300 | ✨ | Fe inquebrantable demostrada |
| Piadoso | 300 a 500 | 👼 | Ejemplo de virtud imperial |
| Santo | 500 a 750 | 😇 | Bendecido por Su Divina Gracia |
| Mártir | 750 a 1000 | ⚡ | Dispuesto al sacrificio supremo |
| Servo del Emperador | > 1000 | 👑 | Elegido del Trono Dorado |

### **Puntos de Pureza (+)**
- **+8** Recitar el Credo Imperial
- **+15** Recibir bendición de otro usuario
- **+5** Otorgar bendición a otro usuario
- **+3** Recibir un sermón del Capellán
- **+10** Cada 100 mensajes enviados (participación activa)
- **+25** Desbloquear un logro
- **+5** Fe demostrada (análisis PURA_FE)
- **+2** Comportamiento ejemplar (SOSPECHOSO positivo)

### **Puntos de Corrupción (-)**
- **-5** Herejía menor detectada
- **-15** Herejía mayor detectada  
- **-30** Herejía extrema detectada
- **-20** Penitencia asignada por Inquisidor

### **Sistema de Logros** 🏅
1. **Primeros Pasos** 👶 - Envía tu primer mensaje
2. **Servo Fiel** 🕊️ - Alcanza 100 puntos de pureza
3. **Cazador de Herejías** 🔍 - Detecta 10 herejías
4. **Oyente Devoto** 📖 - Recibe 25 sermones
5. **Miembro Activo** 💬 - Envía 1000 mensajes
6. **Alma Pura** ✨ - Alcanza 500 puntos de pureza
7. **Bendecido por el Emperador** 👑 - Alcanza rango de Santo+

## 🚀 Instalación y Configuración

### **Requisitos Previos**
- **[Bun](https://bun.sh/)** 1.0+ (runtime principal)
- **[wkhtmltopdf](https://wkhtmltopdf.org/)** (conversión PDF)
- **Discord Bot Token** - [Discord Developer Portal](https://discord.com/developers/applications)
- **OpenAI API Key** - [OpenAI Platform](https://platform.openai.com/api-keys)
- **Sistema**: 2GB+ RAM, 10GB+ storage

### **Instalación Rápida**

#### 1. **Instalar Bun**
```bash
# Windows
irm bun.sh/install.ps1 | iex

# macOS/Linux  
curl -fsSL https://bun.sh/install | bash
```

#### 2. **Instalar wkhtmltopdf**
```bash
# Ubuntu/Debian
sudo apt-get install wkhtmltopdf

# macOS
brew install wkhtmltopdf

# Windows: Descargar desde https://wkhtmltopdf.org/downloads.html
```

#### 3. **Configurar el Proyecto**
```bash
# Clonar e instalar
git clone <repository-url> capellan-bot
cd capellan-bot
bun install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus tokens
```

#### 4. **Variables de Entorno (.env)**
```env
# Discord
DISCORD_TOKEN=tu_discord_bot_token

# OpenAI  
OPENAI_API_KEY=tu_openai_api_key

# Configuración (Opcional)
AUTO_HERESY_DETECTION_CHANCE=0.2
MAX_DAILY_EMBEDDINGS=1000
LOG_LEVEL=info
```

#### 5. **Ejecutar el Bot**
```bash
# Desarrollo (con hot reload)
bun run dev

# Producción
bun run build
bun run start
```

### **Configuración de Discord**

1. **Crear Bot**: Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. **Permisos necesarios**: Send Messages, Embed Links, Read Message History, Add Reactions
3. **Invitar al servidor** con los permisos correctos
4. **Primer uso**: `!capellan inquisidor supremo` (solo si no hay Inquisidores)

## 🎮 Guía de Uso

### **Para Usuarios Nuevos**
1. **Únete al servidor** donde está el bot
2. **Escribe tu primer mensaje** (automáticamente crea tu perfil)
3. **Aprende el sistema** con el nuevo comando guía:
   ```
   !capellan imperio           # Resumen completo del sistema
   !capellan imperio rangos    # Todos los rangos explicados
   !capellan imperio puntos    # Cómo ganar y perder puntos
   !capellan imperio penitencias  # Sistema de castigos
   ```
4. **Prueba comandos básicos**:
   ```
   !capellan help
   !capellan credo
   !capellan ranking perfil
   ```

### **Gamificación Automática**
- **Mensajes normales** = Puntos por participación
- **Auto-detección de herejía** = Análisis automático de palabras sospechosas
- **Bendiciones entre usuarios** = Interacción social recompensada
- **Sistema de logros** = Metas automáticas desbloqueables

### **Para Inquisidores**
```bash
# Gestión de usuarios (Sistema mejorado de penitencias)
!capellan penitencia @hereje 24 Blasfemia contra el Emperador
!capellan penitencia lista                    # Ver todas las penitencias activas
!capellan penitencia remover @hereje          # Remover todas las penitencias de un usuario
!capellan penitencia remover pen_abc123       # Remover penitencia específica por ID
!capellan inquisidor nominar @usuario_fiel

# Gestión de conocimiento
!capellan agregar https://wh40k.lexicanum.com/wiki/Emperor
!capellan agregar texto [texto del lore]
!capellan stats                              # Ahora solo para Inquisidores
```

### **Limitaciones de Rate Limiting**
- **Usuarios normales**: 3 comandos de IA por minuto
- **Inquisidores**: Sin limitaciones (acceso prioritario)
- **Cola global**: Solo 1 tarea de IA a la vez para prevenir saturación

## 🏗️ Arquitectura Técnica

### **Stack Tecnológico**
- **Runtime**: Bun (JavaScript/TypeScript ultrarrápido)
- **Lenguaje**: TypeScript moderno con tipos estrictos
- **Base de Datos**: SQLite + sqlite-vec (vectores)
- **IA**: OpenAI GPT-4 + text-embedding-3-small
- **Discord**: discord.js v14.22.1

### **Estructura del Proyecto**
```
src/
├── commands/           # Comandos modulares (24+ comandos)
│   ├── imperio-command.ts    # NUEVO: Sistema de ayuda de gamificación
│   └── ...otros comandos...
├── services/          # Servicios core expandidos
│   ├── rate-limiter.ts       # NUEVO: Control de límites de API
│   ├── ai-task-manager.ts    # NUEVO: Gestión de tareas de IA
│   ├── command-manager.ts    # ACTUALIZADO: Integra rate limiting
│   ├── gamification-service.ts # ACTUALIZADO: Múltiples penitencias
│   └── ...otros servicios...
├── types/            # Definiciones TypeScript actualizadas
├── utils/            # Utilidades y configuración
└── events/           # Sistema de eventos (auto-herejía)

database/             # Base de datos y archivos persistentes
├── vector-store.sqlite    # Embeddings y metadata
├── inquisidores.json     # Administradores del sistema
├── user-profiles.json    # Perfiles con múltiples penitencias
├── wh40k-documents/      # PDFs y documentos descargados
└── backups/             # Backups automáticos

logs/                 # Logs del sistema (separados de datos)
└── bot.log              # Log principal del bot
```

## 🔧 Comandos de Desarrollo

```bash
# Desarrollo
bun run dev              # Hot reload automático
bun run type-check       # Verificar tipos TypeScript
bun run build           # Compilar para producción

# Mantenimiento  
bun run setup           # Crear estructura de directorios
bun run clean           # Limpiar archivos compilados
```

## 🎭 Temática Warhammer 40k

### **Vocabulario Implementado**
- **Inquisidores** = Administradores del bot
- **Herejía** = Contenido problemático detectado
- **Pureza/Corrupción** = Sistema de puntos morales
- **Penitencia** = Castigo temporal por mala conducta
- **Servo-skull** = Referencias técnicas del bot

### **Frases Características**
- "El Emperador Protege" - Frase de protección
- "Ave Imperator!" - Saludo imperial  
- "Por el Trono Dorado!" - Grito de batalla
- "¡HEREJÍA!" - Respuesta a contenido problemático
- "Los espíritus de la máquina me fallan" - Errores técnicos

### **Fuentes de Conocimiento Priorizadas**
1. **Lexicanum** - Wiki oficial más precisa
2. **Warhammer Community** - Contenido oficial GW
3. **r/40kLore** - Discusiones de comunidad  
4. **Codex digitales** - Libros de reglas oficiales

## 📊 Estadísticas del Sistema

### **Capacidades RAG**
- **Documentos**: Ilimitados (dependiente de storage)
- **Búsqueda**: <50ms con sqlite-vec optimizado
- **Contexto**: Hasta 8000 tokens por consulta
- **Precisión**: Embeddings de OpenAI text-embedding-3-small

### **Performance Gamificación**
- **Usuarios**: Escalable a 10,000+ usuarios
- **Tracking**: Tiempo real con persistencia SQLite
- **Rankings**: Cálculo dinámico eficiente
- **Backups**: Automáticos semanales + manuales
- **Rate Limiting**: Control de costos de API en memoria
- **Penitencias**: Soporte eficiente para múltiples penitencias por usuario

## ⚙️ Mantenimiento y Monitoreo

### **Logs Estructurados**
```bash
# Ver logs en tiempo real
tail -f database/bot.log

# Buscar errores específicos  
grep "ERROR" database/bot.log | tail -20
```

### **Comandos de Admin**
```bash
# Solo para Inquisidores Supremos
!capellan admin backup      # Backup completo
!capellan admin cleanup     # Limpieza automática  
!capellan admin stats       # Panel de control
!capellan admin maintenance # Optimización BD
```

### **Cron Jobs Automáticos**
- **06:00 diario** - Sermones programados (configurable)
- **03:00 diario** - Limpieza de penitencias expiradas
- **02:00 domingo** - Backup automático semanal

## 🐛 Solución de Problemas

### **Bot No Responde**
- ✅ Verificar `DISCORD_TOKEN` en `.env`
- ✅ Bot tiene permisos en el servidor  
- ✅ Bun está ejecutándose correctamente

### **Errores de OpenAI**
- ✅ Verificar `OPENAI_API_KEY` válida
- ✅ Cuenta tiene créditos disponibles
- ✅ No se excedieron límites de API

### **Problemas de PDF**
- ✅ `wkhtmltopdf` instalado y en PATH
- ✅ URL es de dominio permitido
- ✅ Suficiente espacio en disco

### **Base de Datos Corrupta**
```bash
# Opción 1: Reconstruir índice (pierde embeddings)
!capellan purgar

# Opción 2: Restaurar backup
!capellan admin backup  # crear backup actual
# Luego restaurar manualmente desde database/backups/
```

## 🔄 Actualizaciones

```bash
# Actualizar dependencias
bun update

# Actualizar código fuente
git pull origin main
bun install
bun run build

# Reiniciar servicio
bun run start
```

## 📞 Soporte y Contribución

### **Reportar Issues**
- **GitHub Issues** para bugs y feature requests
- **Incluir logs** relevantes en reportes
- **Describir pasos** para reproducir problemas

### **Contribuir al Proyecto**
1. Fork el repositorio
2. Crear branch: `git checkout -b feature/nueva-funcionalidad`  
3. Seguir convención de commits
4. Crear Pull Request con descripción detallada

### **Para Content Creators (Inquisidores)**
- Identificar fuentes de lore faltantes
- Usar `!capellan agregar [URL]` para expandir conocimiento
- Reportar respuestas incorrectas del bot
- Sugerir nuevas mecánicas de gamificación

## 📝 Changelog Recientes

### **v2.1.0 - Sistema de Seguridad y Control de Costos**
- ✅ **Rate Limiting**: 3 comandos de IA por minuto para usuarios normales
- ✅ **Control de Tareas**: Solo 1 operación de IA simultánea globalmente
- ✅ **Stats Restringido**: Comando `!capellan stats` ahora solo para Inquisidores
- ✅ **Múltiples Penitencias**: Usuarios pueden tener varias penitencias activas
- ✅ **Protección de Inquisidores**: No pueden asignarse penitencias entre sí
- ✅ **Comando Imperio**: Guía completa del sistema de gamificación
- ✅ **Seguridad Admin**: Comandos destructivos removidos (reset, restore)
- ✅ **Gestión por ID**: Remover penitencias específicas por identificador único

### **Próximas Mejoras Planificadas**
- 🔄 Dashboard web para administración
- 🔄 Sistema de notificaciones Discord
- 🔄 API REST para estadísticas
- 🔄 Integración con bases de datos externas

---

**¡En el nombre del Emperador, que este bot sirva para purificar la galaxia de toda herejía!**

**Ave Imperator!** 🕊️⚡👑

---

*Desarrollado con Bun + TypeScript • Powered by OpenAI GPT-4 • Warhammer 40k Universe © Games Workshop*