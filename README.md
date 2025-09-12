# 🕊️ Bot Capellán de Warhammer 40k

## 📋 Descripción

Bot de Discord temático de Warhammer 40k que simula un Capellán. Utiliza OpenAI con sistema RAG para detectar herejía, generar sermones y mantener un sistema de gamificación con puntos de pureza/corrupción.

## 🎯 Funcionalidades Principales

### **Comandos para Usuarios**
- `!capellan herejia [mensaje]` - Análisis de herejía con doctrina imperial
- `!capellan sermon [tema]` - Sermones basados en textos sagrados
- `!capellan preguntar [pregunta]` - **NUEVO**: Pregunta general sobre lore 40k
- `!capellan buscar [término]` - Búsqueda en documentos específicos
- `!capellan bendicion [@usuario]` - Bendiciones entre usuarios
- `!capellan credo` - Credos y oraciones
- `!capellan ranking` - Rankings y perfiles
- `!capellan imperio` - Guía del sistema de gamificación
- `!capellan help` - Ayuda

### **Comandos para Inquisidores (Administradores)**
- `!capellan agregar [URL/texto]` - Agregar conocimiento
- `!capellan penitencia` - Gestionar penitencias
- `!capellan inquisidor` - Gestión de administradores
- `!capellan stats` - Estadísticas del sistema
- `!capellan purgar` - Reconstruir índice RAG

### **Sistema RAG Especializado**
El bot utiliza **colecciones especializadas de documentos**:
- **Análisis de herejía**: Usa únicamente doctrina imperial y textos sobre el Caos
- **Sermones**: Accede a oraciones, vidas de santos y devociones diarias  
- **Búsqueda**: Consulta lore general y documentos agregados por usuarios
- **Preguntas generales**: Busca en todas las colecciones disponibles

### **Compatibilidad con Slash Commands**
Todos los comandos están disponibles como:
- **Comandos tradicionales**: `!capellan comando`
- **Slash commands**: `/comando` (ej: `/preguntar`, `/herejia`)

## 🛡️ Seguridad y Control

- **Rate Limiting**: 3 comandos de IA por minuto para usuarios
- **Protección de costos**: Control de tareas concurrentes
- **Sistema de penitencias**: Múltiples penitencias por usuario
- **Comandos administrativos**: Ejecutados mediante scripts seguros

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

## 🚀 Instalación

### **Requisitos**
- [Bun](https://bun.sh/) 1.0+
- [wkhtmltopdf](https://wkhtmltopdf.org/)
- Discord Bot Token
- OpenAI API Key

### **Pasos de Instalación**

```bash
# 1. Clonar el repositorio
git clone <repository-url> capellan-bot
cd capellan-bot

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus tokens

# 4. Ejecutar
bun run dev  # desarrollo
bun run start # producción
```

## 🎮 Uso

- Escribe `!capellan help` para ver todos los comandos
- Usa `!capellan imperio` para aprender sobre la gamificación
- Los administradores pueden usar comandos de Inquisidor

## 🏗️ Stack Técnico

- **Runtime**: Bun + TypeScript
- **Base de Datos**: SQLite + vectores con colecciones especializadas
- **IA**: OpenAI GPT-4 + embeddings (text-embedding-3-small)
- **Discord**: discord.js v14 + slash commands
- **Documentos Base**: Inicialización automática del lore fundamental

## 🎭 Temática Warhammer 40k

El bot utiliza terminología de Warhammer 40k (Inquisidores para administradores, herejía para contenido problemático, sistema de pureza/corrupción) con fuentes de conocimiento del Lexicanum y contenido oficial.

### **Documentos Base Incluidos**
El bot incluye automáticamente una extensa biblioteca de textos fundamentales del lore:

#### **📜 Análisis de Herejía**
- **Imperial Creed**: Los cinco pilares inquebrantables, dogmas de pureza, clasificación completa de herejías (Grado Delta/Gamma/Alpha)
- **Chaos Heresies**: Guía detallada de corrupción por los Cuatro Poderes Ruinosos, signos físicos de corrupción, protocolo de purificación
- **Lectitio Divinitatus**: El texto sagrado fundamental de la fe imperial

#### **⚔️ Textos Sagrados y Sermones** 
- **Battle Prayers**: Oraciones de guerra, bendiciones de armas, letanías de combate, liturgias de venganza
- **Daily Devotions**: Devociones matutinas y vespertinas, exámenes de conciencia, mantras de meditación
- **Saint Lives**: Vidas de santos imperiales, martirologios, ejemplos de fe inquebrantable

#### **🏛️ Lore General**
- **Emperor Lore**: Historia completa desde su nacimiento en Anatolia hasta su entronización, la Gran Cruzada, la Herejía de Horus
- **Imperium Overview**: Estructura del Imperio, los cinco Segmentums, Adeptus y organizaciones principales
- **Space Marines Basics**: Fundamentos de los Adeptus Astartes, proceso de creación, cultura de capítulos
- **Liturgicum Imperialis**: Manual completo del Capellán Imperial con ritos de guerra, exorcismos y cuidado del alma




---

**¡En el nombre del Emperador, que este bot sirva para purificar la galaxia de toda herejía!**

**Ave Imperator!** 🕊️⚡👑

---

*Desarrollado con Bun + TypeScript • Powered by OpenAI GPT-4 • Warhammer 40k Universe © Games Workshop*