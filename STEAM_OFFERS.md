# 🔥 Sistema de Ofertas Steam Warhammer

Este sistema permite al Bot Capellán detectar automáticamente ofertas de juegos de Warhammer en Steam y notificar en un canal específico de Discord.

## ⚙️ Configuración

### Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env`:

```env
# OBLIGATORIO: ID del canal donde se enviarán las notificaciones
STEAM_OFFERS_CHANNEL_ID=1234567890123456789

# OPCIONAL: Intervalo de verificación en horas (default: 3)
STEAM_OFFERS_CHECK_INTERVAL=3

# OPCIONAL: Descuento mínimo para notificar (default: 10%)
MIN_DISCOUNT_PERCENT=10
```

### Cómo obtener el ID del canal

1. En Discord, habilita el **Modo Desarrollador** en Configuración > Avanzado > Modo desarrollador
2. Haz clic derecho en el canal donde quieres recibir notificaciones
3. Selecciona **Copiar ID**
4. Pega el ID en la variable `STEAM_OFFERS_CHANNEL_ID`

## 🤖 Funcionamiento Automático

### Verificación Programada
- **Chequeo inicial** inmediato al arrancar el bot (después de 5 segundos)
- **Verificaciones regulares** cada 3 horas (configurable)
- Solo notifica ofertas **nuevas** o con **descuentos significativamente mejores**
- Sistema anti-spam inteligente evita notificaciones duplicadas
- **Protección contra reinicios**: Evita notificaciones duplicadas si el bot se reinicia dentro de 1 hora

### Filtrado Warhammer
El sistema busca juegos que contengan estas palabras clave:
- `warhammer 40k`, `warhammer40k`, `warhammer 40000`
- `space marine`, `space marines`
- `adeptus mechanicus`, `adeptus astartes`, `adeptus custodes`
- `imperial guard`, `astra militarum`
- `chaos space marines`
- Facciones específicas: `blood angels`, `dark angels`, `ultramarines`, etc.
- Juegos conocidos: `dawn of war`, `battlefleet gothic`, `vermintide`, `darktide`
- Y muchos más términos relacionados con Warhammer 40K y Age of Sigmar

### Sistema de Tracking
- **Base de datos local**: `./database/tracked-offers.json`
- **Prevención de duplicados**: No notifica la misma oferta múltiples veces
- **Limpieza automática**: Remueve ofertas expiradas después de 24 horas
- **Detección de mejoras**: Notifica si un descuento aumenta significativamente
- **Protección contra reinicios**: 
  - Persiste el timestamp de la última verificación
  - Si se reinicia dentro de 1 hora, asume que las ofertas ya fueron notificadas
  - Migra automáticamente formatos antiguos de datos
  - Cooldown de 6 horas entre notificaciones de la misma oferta

## 📨 Formato de Notificaciones

### Embeds Ricos
Cada notificación incluye:
- **Embed principal** con resumen de ofertas encontradas
- **Embeds individuales** para cada juego (máximo 4 por mensaje)
- **Embed de resumen** si hay más de 4 ofertas

### Información por Juego
- Nombre del juego con enlace directo a Steam
- Precio original (tachado) y precio con descuento
- Porcentaje de descuento destacado
- Imagen del juego
- Descripción corta
- Fecha de lanzamiento
- Colores temáticos según el descuento:
  - 🔴 Rojo: ≥50% descuento
  - 🟠 Naranja: ≥25% descuento  
  - 🟢 Verde: <25% descuento

### Mensajes Temáticos del Capellán
- `🕊️ El Emperador sonríe sobre esta oferta` (≥75% descuento)
- `⚔️ Una oportunidad digna de un Astartes` (≥50% descuento)
- `🛡️ El Emperador bendice este descuento` (≥25% descuento)
- `Por el Emperador` (descuentos menores)

## 🔧 Administración

### Estados del Sistema
Para verificar el estado del sistema de ofertas:
```javascript
// En el código del bot
const stats = bot.getSteamOffersService().getStats();
console.log(stats);
```

### Flujo de Inicio
1. **Bot arranca** → Carga ofertas tracked desde archivo
2. **5 segundos después** → Chequeo inicial de ofertas (si está configurado)
3. **Cada X horas** → Verificaciones programadas automáticas

### Archivos Importantes
- `./database/tracked-offers.json` - Base de datos de ofertas tracked (nuevo formato con timestamp)
- `./logs/` - Logs detallados del sistema

### Mantenimiento
- El sistema es **completamente automático**
- Los archivos de tracking se mantienen automáticamente
- **Compatibilidad**: Migra automáticamente formatos de datos antiguos
- Los logs proporcionan información detallada para debugging

## 🚀 Beneficios

### Para Usuarios
- ✅ **Notificaciones automáticas** de ofertas Warhammer
- ✅ **Formato atractivo** con toda la información necesaria
- ✅ **Enlaces directos** a Steam para compra inmediata
- ✅ **Sin spam** - solo ofertas realmente nuevas

### Para Administradores
- ✅ **Configuración simple** via variables de entorno
- ✅ **Sin comandos manuales** - todo automatizado
- ✅ **Sistema robusto** con manejo de errores
- ✅ **Logs completos** para monitoreo
- ✅ **Integración perfecta** con el tema del Bot Capellán

## 📊 Ejemplo de Notificación

```
⚔️ ¡OFERTAS DEL EMPERADOR EN STEAM! ⚔️

🔥 3 ofertas de Warhammer detectadas

El Emperador bendice a sus fieles con descuentos en su arsenal digital.

[EMBED: Warhammer 40,000: Dawn of War II]
💰 Precio: $19.99 $4.99
🔥 Descuento: 75%
💱 Moneda: USD
📖 Comando una fuerza de élite de Space Marines...
🕊️ El Emperador sonríe sobre esta oferta

[Más embeds para otros juegos...]
```

## ⚠️ Limitaciones

- **Rate Limiting**: Steam API tiene límites, el sistema respeta estos límites
- **Disponibilidad regional**: Las ofertas pueden variar por región
- **Precisión del filtrado**: Algunos juegos no-Warhammer podrían colarse si usan términos similares
- **Embeds por mensaje**: Máximo 10 embeds por mensaje de Discord

## 🛠️ Solución de Problemas

### No llegan notificaciones
1. Verificar que `STEAM_OFFERS_CHANNEL_ID` está configurado correctamente
2. Verificar que el bot tiene permisos para escribir en el canal
3. Revisar logs para errores de la Steam API

### Muchas notificaciones
1. Aumentar `MIN_DISCOUNT_PERCENT` para filtrar mejor
2. Verificar que el archivo `tracked-offers.json` no está corrupto

### Canal no encontrado
- Verificar que el ID del canal es correcto
- Verificar que el bot está en el servidor correcto
- Verificar permisos del bot en el canal

---

*🕊️ Por la gloria del Emperador, que estas ofertas fortalezcan tu arsenal digital.*