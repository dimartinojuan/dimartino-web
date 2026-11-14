// Planilla "Web Di Martino | Estadísticas" (Google Sheets → Extensiones → Apps Script).
// Recibe una vez por día el resumen de la web (lo manda server/contacto.php), lo anota en dos hojas y lo manda por mail
// a la cuenta dueña de la planilla. Se publica como "Aplicación web": Ejecutar como "Yo", acceso "Cualquier usuario".
// La clave tiene que ser igual a 'planilla_clave' en dimartino-config.php (fuera de public_html).
const CLAVE = 'PONER_CLAVE';
const AZUL = '#0B3042', ROJO = '#D3282F', CREMA = '#EDEDE4';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const COL_DIA = ['Fecha', 'Día', 'Personas', 'Páginas vistas', 'Tiempo por página (min)', 'Celular %', 'Compu %',
  'Google', 'Instagram', 'Facebook', 'WhatsApp (origen)', 'Directo', 'Otros', 'Clics WhatsApp', 'Consultas', 'Teléfono',
  'Compartidas', 'Recorrido 360', 'Video'];
const COL_PROP = ['Fecha', 'Código', 'Dirección', 'Personas', 'Vistas', 'Tiempo (min)', 'Fotos vistas', 'Recorrido 360',
  'Video', 'Planos', 'Mapa', 'WhatsApp', 'Consultas', 'Compartidas', 'Teléfono', 'Ficha'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida(false);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fecha = new Date(d.fecha + 'T12:00:00-03:00');
    const o = d.origenes || {};
    const otros = Object.keys(o).filter(k => !['Google', 'Instagram', 'Facebook', 'WhatsApp', 'directo'].includes(k)).reduce((a, k) => a + o[k], 0);
    const hd = hoja(ss, 'Por día', COL_DIA);
    borrarFecha(hd, d.fecha);
    hd.appendRow([fecha, DIAS[fecha.getDay()], d.personas, d.paginas, d.segundos / 60, d.celular / 100, d.personas ? (100 - d.celular) / 100 : 0,
      o.Google || 0, o.Instagram || 0, o.Facebook || 0, o.WhatsApp || 0, o.directo || 0, otros,
      d.whatsapp, d.consultas, d.telefono, d.compartidas, d.tour, d.video]);
    const hp = hoja(ss, 'Por propiedad', COL_PROP);
    borrarFecha(hp, d.fecha);
    const filas = (d.propiedades || []).map(p => [fecha, p.codigo, p.direccion, p.personas, p.vistas, p.segundos / 60, p.fotos, p.tour,
      p.video, p.planos, p.mapa, p.whatsapp, p.consultas, p.compartidas, p.telefono,
      p.tokko ? 'https://www.dimartinoprop.com.ar/propiedades/' + p.tokko + '/' : '']);
    if (filas.length) hp.getRange(hp.getLastRow() + 1, 1, filas.length, COL_PROP.length).setValues(filas);
    formato(hd, [1], [5], [6, 7]);
    formato(hp, [1], [6], []);
    mail(d);
    return salida(true);
  } catch (err) {
    console.error(err);
    return salida(false);
  }
}

function salida(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok })).setMimeType(ContentService.MimeType.JSON);
}

// Crea la hoja con encabezados de marca si no existe.
function hoja(ss, nombre, cols) {
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setBackground(AZUL).setFontColor('#ffffff').setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
    h.setFrozenRows(1);
    h.setRowHeight(1, 42);
    const sobra = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (sobra && ss.getSheets().length > 1) ss.deleteSheet(sobra);
  }
  return h;
}

// Si se vuelve a mandar el mismo día, reemplaza las filas en vez de duplicarlas.
function borrarFecha(h, dia) {
  const n = h.getLastRow();
  if (n < 2) return;
  const vals = h.getRange(2, 1, n - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i][0];
    if (v instanceof Date && Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') === dia) h.deleteRow(i + 2);
  }
}

function formato(h, colsFecha, colsMin, colsPct) {
  const n = h.getLastRow();
  if (n < 2) return;
  colsFecha.forEach(c => h.getRange(2, c, n - 1).setNumberFormat('dd/mm/yyyy'));
  colsMin.forEach(c => h.getRange(2, c, n - 1).setNumberFormat('0.0'));
  colsPct.forEach(c => h.getRange(2, c, n - 1).setNumberFormat('0%'));
  h.getRange(2, 1, n - 1, h.getLastColumn()).setVerticalAlignment('middle');
  for (let r = 2; r <= n; r++) h.getRange(r, 1, 1, h.getLastColumn()).setBackground(r % 2 ? CREMA : '#ffffff');
  h.autoResizeColumns(1, h.getLastColumn());
}

function mail(d) {
  const para = Session.getEffectiveUser().getEmail();
  const f = new Date(d.fecha + 'T12:00:00-03:00');
  const titulo = 'Web Di Martino | ' + DIAS[f.getDay()] + ' ' + Utilities.formatDate(f, 'America/Argentina/Buenos_Aires', 'dd/MM');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const html = '<div style="font-family:Arial,sans-serif;max-width:600px;color:' + AZUL + '">'
    + '<div style="background:' + AZUL + ';color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:bold">' + esc(titulo) + '</div>'
    + '<div style="background:' + CREMA + ';padding:18px 20px;border-radius:0 0 10px 10px;white-space:pre-wrap;font-size:14px;line-height:1.5">' + esc(d.texto) + '</div>'
    + '<p style="margin-top:16px"><a href="' + url + '" style="background:' + ROJO + ';color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Ver la planilla</a></p></div>';
  MailApp.sendEmail({ to: para, subject: titulo, body: d.texto + '\n\nPlanilla: ' + url, htmlBody: html, name: 'Web Di Martino' });
}

// Para autorizar el script la primera vez (Ejecutar → probar): manda un mail de prueba y crea las hojas.
function probar() {
  const ayer = Utilities.formatDate(new Date(Date.now() - 864e5), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  doPost({ postData: { contents: JSON.stringify({ clave: CLAVE, fecha: ayer, personas: 0, paginas: 0, segundos: 0, celular: 0, origenes: {},
    whatsapp: 0, consultas: 0, telefono: 0, compartidas: 0, tour: 0, video: 0, propiedades: [], texto: 'Prueba de la planilla de estadísticas de la web.' }) } });
}
