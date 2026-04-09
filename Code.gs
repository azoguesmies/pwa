/**
 * ═══════════════════════════════════════════════════════════════════
 *  NEXUS PWA — Google Apps Script v2.0  (CORREGIDO)
 *  Recibe datos enviados por la PWA vía GET request (query string)
 *
 *  PARÁMETROS RECIBIDOS (e.parameter):
 *    nombres     → Nombres completos
 *    direccion   → Dirección
 *    email       → Correo electrónico
 *    ciudad      → Ciudad
 *    valEasting  → UTM Este (X)
 *    valNorthing → UTM Norte (Y)
 *
 *  CÓMO IMPLEMENTAR:
 *    1. Extensions → Apps Script → pega este código → Guardar
 *    2. Implementar → Nueva implementación
 *    3. Tipo: Aplicación web
 *    4. Ejecutar como: Yo
 *    5. Acceso: Cualquier persona (anónimo)
 *    6. Implementar → Autorizar → Copiar URL
 *    7. Esa URL va en GS_URL del index.html
 *
 *  ERRORES CORREGIDOS vs v1.0:
 *    ✓ Reemplazado const global por var (compatibilidad GAS)
 *    ✓ Eliminado setBorder con color (causaba excepción fatal)
 *    ✓ sanitize() ya no borra comillas ni caracteres válidos
 *    ✓ Fecha formateada con Utilities.formatDate (sin problemas de zona)
 * ═══════════════════════════════════════════════════════════════════
 */

// ── PUNTO DE ENTRADA GET ──────────────────────────────────────────
function doGet(e) {

  // 1. Verificar que llegaron parámetros
  if (!e || !e.parameter || !e.parameter.nombres) {
    return resp('ERROR', 'Parámetros no recibidos o falta "nombres".');
  }

  try {
    // 2. Leer parámetros — nombres EXACTAMENTE iguales a columnas del Sheet
    var nombres     = clean(e.parameter.nombres     || '');
    var direccion   = clean(e.parameter.direccion   || '');
    var email       = clean(e.parameter.email       || '');
    var ciudad      = clean(e.parameter.ciudad      || '');
    var valEasting  = clean(e.parameter.valEasting  || '');
    var valNorthing = clean(e.parameter.valNorthing || '');
    var fechaHora   = Utilities.formatDate(
                        new Date(),
                        Session.getScriptTimeZone(),
                        'yyyy-MM-dd HH:mm:ss'
                      );

    // 3. Obtener la hoja
    var sheet = getSheet();

    // 4. Insertar fila con los datos
    sheet.appendRow([
      nombres,
      direccion,
      email,
      ciudad,
      valEasting,
      valNorthing,
      fechaHora
    ]);

    Logger.log('Registro guardado: ' + nombres + ' / ' + ciudad);
    return resp('OK', 'Registro guardado: ' + nombres);

  } catch (err) {
    Logger.log('doGet ERROR: ' + err.toString());
    return resp('ERROR', err.message);
  }
}


// ── SOPORTE POST (por compatibilidad) ────────────────────────────
function doPost(e) {
  return doGet(e);
}


// ── OBTENER / CREAR HOJA ─────────────────────────────────────────
function getSheet() {
  var HOJA  = 'NEXUS_Contactos';
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA);

  // Crear la hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(HOJA);
  }

  // Crear encabezados si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    var headers = [
      'nombres',
      'direccion',
      'email',
      'ciudad',
      'valEasting',
      'valNorthing',
      'fecha_registro'
    ];

    sheet.appendRow(headers);

    // Estilo encabezado (solo propiedades seguras en GAS)
    var rng = sheet.getRange(1, 1, 1, headers.length);
    rng.setBackground('#1a1a2e');
    rng.setFontColor('#00e5c0');
    rng.setFontWeight('bold');
    rng.setFontSize(11);
    rng.setHorizontalAlignment('center');

    // Congelar primera fila
    sheet.setFrozenRows(1);

    // Anchos de columna
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(4, 140);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 120);
    sheet.setColumnWidth(7, 160);

    Logger.log('Hoja y encabezados creados: ' + HOJA);
  }

  return sheet;
}


// ── LIMPIAR TEXTO ────────────────────────────────────────────────
// Solo elimina etiquetas HTML y espacios extra.
// NO elimina comillas, tildes ni caracteres especiales válidos.
function clean(val) {
  if (typeof val !== 'string') return String(val || '');
  return val.replace(/<[^>]*>/g, '').trim();
}


// ── CONSTRUIR RESPUESTA JSON ─────────────────────────────────────
function resp(status, message) {
  var payload = JSON.stringify({
    status:  status,
    message: message,
    ts:      new Date().toISOString()
  });
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}


// ── FUNCIÓN DE PRUEBA ────────────────────────────────────────────
/**
 * CÓMO PROBAR:
 *   1. Seleccionar "testInsert" en el desplegable de funciones
 *   2. Clic en ▶ Ejecutar
 *   3. Verificar que aparece una fila nueva en la hoja
 *   4. Ver "Registros de ejecución" para confirmar respuesta OK
 */
function testInsert() {
  var evento = {
    parameter: {
      nombres:     'María García López',
      direccion:   'Av. 9 de Octubre 123',
      email:       'maria.garcia@test.com',
      ciudad:      'Guayaquil',
      valEasting:  '621543',
      valNorthing: '9757820'
    }
  };

  var resultado = doGet(evento);
  Logger.log('▶ Respuesta: ' + resultado.getContent());
}


// ── LIMPIAR DATOS DE PRUEBA ──────────────────────────────────────
function limpiarHoja() {
  var HOJA  = 'NEXUS_Contactos';
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
    Logger.log('Hoja limpiada. Encabezados conservados.');
  }
}
