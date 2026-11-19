<?php
// Recibe las consultas de la web y las carga en Tokko como contacto (aparecen en Consultas).
// La clave de Tokko NO va en este archivo: se lee de un archivo de configuración fuera de la carpeta pública,
// por ejemplo /home/USUARIO/dimartino-config.php con:  <?php return ['tokko_key' => 'CLAVE', 'telegram_token' => 'TOKEN_DEL_BOT', 'telegram_chat' => 'ID_DEL_CHAT', 'planilla_url' => 'URL_DEL_SCRIPT', 'planilla_clave' => 'CLAVE'];
// (los dos datos de Telegram son opcionales: si están, cada consulta también avisa por Telegram)
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
function salir($ok, $codigo = 200) { http_response_code($codigo); echo json_encode(['ok' => $ok]); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(false, 405);
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen && !preg_match('#^https://(www\.)?dimartinoprop\.com\.ar$#', $origen)) salir(false, 403);

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos)) salir(false, 400);
if (!empty($datos['website'])) salir(true); // trampa para robots: se ignora en silencio

$limpio = fn($v, $max) => mb_substr(trim(strip_tags((string)($v ?? ''))), 0, $max);

require __DIR__ . '/estadisticas.php';
$esOficina = !empty($datos['oficina']);
$esRobot = (bool)preg_match('/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i', $_SERVER['HTTP_USER_AGENT'] ?? '');
$propPost = preg_match('/^\d{1,12}$/', (string)($datos['prop'] ?? '')) ? (string)$datos['prop'] : '';
$evento = $datos['evento'] ?? '';

// Prueba de la planilla: manda a la planilla el resumen del día pedido (o de ayer). Solo con la clave de la planilla.
if ($evento === 'probar_planilla') {
  $k = is_array($cfg) ? ($cfg['planilla_clave'] ?? '') : '';
  if ($k === '' || !hash_equals($k, (string)($datos['clave'] ?? ''))) salir(false, 403);
  $dia = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($datos['dia'] ?? '')) ? $datos['dia'] : date('Y-m-d', strtotime('-1 day'));
  $datosDia = null; textoResumen($dirVisitas, $dia, $datosDia);
  salir(enviarPlanilla($cfg, $datosDia));
}

// "Mi lista" por mail: la persona pone su mail y el servidor le manda las propiedades que guardó (solo propiedades
// de la web, por número, para que no se pueda usar para mandar otra cosa). También avisa a la inmobiliaria por Telegram.
if ($evento === 'lista_mail') {
  // Diagnóstico: con la clave de la planilla en "depurar", muestra los errores de PHP.
  if (is_array($cfg) && !empty($cfg['planilla_clave']) && hash_equals((string)$cfg['planilla_clave'], (string)($datos['depurar'] ?? ''))) { ini_set('display_errors', '1'); error_reporting(E_ALL); }
  $mail = trim((string)($datos['email'] ?? ''));
  if (!filter_var($mail, FILTER_VALIDATE_EMAIL) || strlen($mail) > 120) salir(false, 400);
  $ids = array_slice(array_values(array_unique(array_filter(array_map('strval', (array)($datos['ids'] ?? [])), fn($x) => preg_match('/^\d{1,12}$/', $x)))), 0, 30);
  if (!$ids) salir(false, 400);
  // Límite: 5 envíos por hora por conexión y 100 por día en total.
  $tmp = sys_get_temp_dir();
  $marcaIp = $tmp . '/dm_lista_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
  $veces = array_filter(explode(',', (string)@file_get_contents($marcaIp)), fn($t) => (int)$t > time() - 3600);
  if (count($veces) >= 5) salir(false, 429);
  $marcaDia = $tmp . '/dm_lista_dia_' . date('Ymd');
  $hoy = (int)@file_get_contents($marcaDia);
  if ($hoy >= 100) salir(false, 429);
  $catalogo = [];
  foreach ((json_decode((string)@file_get_contents(__DIR__ . '/data/properties.json'), true)['properties'] ?? []) as $p) $catalogo[(string)$p['id']] = $p;
  $props = array_values(array_filter(array_map(fn($id) => $catalogo[$id] ?? null, $ids)));
  if (!$props) salir(false, 400);
  $h = fn($t) => htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8');
  $precio = function ($p) {
    foreach ($p['operations'] ?? [] as $o) foreach ($o['prices'] ?? [] as $pr) if (!empty($pr['price']))
      return ($pr['currency'] === 'USD' ? 'US$ ' : '$ ') . number_format($pr['price'], 0, ',', '.') . (($o['operation_type'] ?? '') === 'Rent' ? '/mes' : '');
    return 'Consultar';
  };
  $sitio = 'https://www.dimartinoprop.com.ar/';
  // Colores del manual de marca y tipografía de la web (Poppins donde el programa de mail la acepte).
  $AZUL = '#0B3042'; $ROJO = '#D3282F'; $GRIS = '#BCBEC0'; $CREMA = '#EDEDE4';
  $fuente = "font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;";
  $waNum = '5492323678107';
  $tarjetas = ''; $plano = '';
  foreach ($props as $i => $p) {
    $url = $sitio . ($p['path'] ?? 'propiedades/' . $p['id'] . '/');
    $tipo = $p['type']['label'] ?? 'Propiedad';
    $nombre = trim($tipo . ' | ' . ($p['address'] ?? ''));
    $zona = $p['location']['name'] ?? '';
    $foto = $p['photos'][0]['image'] ?? '';
    $op = (($p['operations'][0]['operation_type'] ?? '') === 'Rent') ? 'Alquiler' : 'Venta';
    $rasgos = [];
    if (!empty($p['suite_amount'])) $rasgos[] = $p['suite_amount'] . ' dorm.';
    if (!empty($p['bathroom_amount'])) $rasgos[] = $p['bathroom_amount'] . ($p['bathroom_amount'] == 1 ? ' baño' : ' baños');
    if (!empty($p['roofed_surface'])) $rasgos[] = round($p['roofed_surface']) . ' m² cubiertos';
    elseif (!empty($p['surface'])) $rasgos[] = round($p['surface']) . ' m² de terreno';
    $consulta = 'https://wa.me/' . $waNum . '?text=' . rawurlencode('Hola, quiero consultar por ' . $nombre . ($zona ? ', ' . $zona : '') . ":\n" . $url);
    $tarjetas .= '<tr><td style="padding:0 0 18px">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border-collapse:separate">'
      . ($foto ? '<tr><td><a href="' . $h($url) . '"><img src="' . $h($foto) . '" width="556" alt="' . $h($nombre) . '" style="display:block;width:100%;max-width:556px;height:auto;border:0;border-radius:14px 14px 0 0"></a></td></tr>' : '')
      . '<tr><td style="padding:16px 20px 20px;' . $fuente . '">'
      . '<span style="display:inline-block;background:' . $ROJO . ';color:#ffffff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px">' . $op . '</span>'
      . '<div style="margin-top:9px;font-size:16px;font-weight:700;color:' . $AZUL . ';line-height:1.3"><a href="' . $h($url) . '" style="color:' . $AZUL . ';text-decoration:none">' . $h($nombre) . '</a></div>'
      . '<div style="margin-top:6px;font-size:22px;font-weight:800;color:' . $AZUL . '">' . $h($precio($p)) . '</div>'
      . ($rasgos ? '<div style="margin-top:4px;font-size:13px;color:' . $AZUL . '">' . $h(implode(' · ', $rasgos)) . '</div>' : '')
      . ($zona ? '<div style="margin-top:2px;font-size:12px;color:#8f9194">' . $h($zona) . '</div>' : '')
      . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>'
      . '<td style="padding-right:8px"><a href="' . $h($url) . '" style="display:inline-block;background:' . $AZUL . ';color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:999px;text-decoration:none;' . $fuente . '">Ver ficha</a></td>'
      . '<td><a href="' . $h($consulta) . '" style="display:inline-block;background:#ffffff;color:' . $AZUL . ';border:1.5px solid ' . $AZUL . ';font-size:13px;font-weight:700;padding:9px 18px;border-radius:999px;text-decoration:none;' . $fuente . '">Consultar</a></td>'
      . '</tr></table></td></tr></table></td></tr>';
    $plano .= ($i + 1) . ') ' . $nombre . ($zona ? ', ' . $zona : '') . ' | ' . $precio($p) . "\n" . $url . "\n\n";
  }
  $n = count($props);
  $wa = 'https://wa.me/' . $waNum . '?text=' . rawurlencode("Hola, quiero consultar por estas propiedades de mi lista:\n" . trim($plano));
  $html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"><title>Tu lista de propiedades</title></head>'
    . '<body style="margin:0;padding:0;background:' . $CREMA . '">'
    . '<div style="display:none;max-height:0;overflow:hidden">Las ' . $n . ' propiedades que guardaste en la web de Di Martino Propiedades.</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . $CREMA . '"><tr><td align="center" style="padding:24px 12px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:596px">'
    // Encabezado: azul con el logo y la línea roja de la web
    . '<tr><td style="background:' . $AZUL . ';border-radius:16px 16px 0 0;padding:22px 24px"><a href="' . $sitio . '"><img src="' . $sitio . 'assets/logo-nav.png" width="190" height="30" alt="Di Martino Propiedades" style="display:block;width:190px;height:auto;border:0"></a></td></tr>'
    . '<tr><td style="background:' . $ROJO . ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>'
    // Título
    . '<tr><td style="background:#ffffff;padding:26px 24px 22px;border-radius:0 0 16px 16px;' . $fuente . '">'
    . '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' . $ROJO . '">Mi lista</div>'
    . '<div style="margin-top:6px;font-size:24px;font-weight:800;color:' . $AZUL . ';line-height:1.2">Las propiedades que guardaste</div>'
    . '<div style="margin-top:8px;font-size:14px;color:' . $AZUL . ';line-height:1.5">' . ($n === 1 ? 'Acá tenés la propiedad que guardaste' : 'Acá tenés las ' . $n . ' propiedades que guardaste') . ' en nuestra web, con su ficha para ver todas las fotos, el recorrido y la ubicación.</div>'
    . '</td></tr>'
    // Tarjetas
    . '<tr><td style="background:' . $CREMA . ';padding:20px 0 2px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $tarjetas . '</table></td></tr>'
    // Llamado a la acción
    . '<tr><td style="background:' . $AZUL . ';padding:26px 24px;text-align:center;border-radius:16px 16px 0 0;' . $fuente . '">'
    . '<div style="font-size:19px;font-weight:800;color:#ffffff">¿Querés verlas en persona?</div>'
    . '<div style="margin-top:6px;font-size:14px;color:' . $GRIS . '">Escribinos y coordinamos una visita.</div>'
    . '<a href="' . $h($wa) . '" style="display:inline-block;margin-top:16px;background:' . $ROJO . ';color:#ffffff;font-size:15px;font-weight:700;padding:13px 26px;border-radius:999px;text-decoration:none;' . $fuente . '">Consultar por WhatsApp</a>'
    . '</td></tr>'
    // Pie
    . '<tr><td style="background:' . $ROJO . ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>'
    . '<tr><td style="background:' . $AZUL . ';border-radius:0 0 16px 16px;padding:22px 24px;' . $fuente . 'font-size:13px;color:' . $GRIS . ';line-height:1.7">'
    . '<img src="' . $sitio . 'assets/logo-nav.png" width="140" alt="Di Martino Propiedades" style="display:block;width:140px;height:auto;border:0;margin-bottom:12px">'
    . 'Lavalle 889, Luján<br>Oficina: <a href="tel:+542323426040" style="color:#ffffff;text-decoration:none">(02323) 426040</a> · WhatsApp: <a href="https://wa.me/' . $waNum . '" style="color:#ffffff;text-decoration:none">2323-678107</a><br>'
    . '<a href="' . $sitio . '" style="color:#ffffff;text-decoration:none;font-weight:700">dimartinoprop.com.ar</a> · <a href="https://www.instagram.com/dimartinopropiedades/" style="color:#ffffff;text-decoration:none">Instagram</a>'
    . '</td></tr>'
    . '<tr><td style="padding:14px 10px 0;text-align:center;' . $fuente . 'font-size:11px;color:#8f9194">Recibiste este mail porque pediste tu lista desde la web de Di Martino Propiedades.</td></tr>'
    . '</table></td></tr></table></body></html>';
  $texto = "Tu lista de propiedades | Di Martino Propiedades\n\n" . $plano . "Consultas por WhatsApp: 2323-678107\nLavalle 889, Luján · (02323) 426040\n";
  $limite = '=_dm' . bin2hex(random_bytes(8));
  $cabeceras = "From: Di Martino Propiedades <info@dimartinoprop.com.ar>\r\nReply-To: info@dimartinoprop.com.ar\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$limite\"";
  $cuerpo = "--$limite\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($texto))
    . "--$limite\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$limite--";
  $asunto = '=?UTF-8?B?' . base64_encode('Tu lista de propiedades | Di Martino') . '?=';
  if (!function_exists('mail')) salir(false, 501); // el hosting no permite mandar mails desde PHP
  $ok = @mail($mail, $asunto, $cuerpo, $cabeceras); // DonWeb no permite el parámetro -f
  if ($ok) {
    $veces[] = time(); @file_put_contents($marcaIp, implode(',', $veces)); @file_put_contents($marcaDia, (string)($hoy + 1));
    if (!$esOficina) anotar($dirVisitas, ['m', '', count($props)]);
    $tk = is_array($cfg) ? ($cfg['telegram_token'] ?? '') : ''; $chat = is_array($cfg) ? ($cfg['telegram_chat'] ?? '') : '';
    if ($tk !== '' && $chat !== '' && !$esOficina) {
      $tg = curl_init('https://api.telegram.org/bot' . $tk . '/sendMessage');
      curl_setopt_array($tg, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => ['chat_id' => $chat, 'disable_web_page_preview' => 'true',
        'text' => "Alguien se mandó su lista por mail\nMail: " . $mail . "\n\n" . trim($plano)], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
      curl_exec($tg); curl_close($tg);
    }
  }
  salir($ok);
}

// Página vista, salida de la página (tiempo y qué miró) y compartir. La web no los manda desde los equipos de la oficina.
if (in_array($evento, ['visita', 'salida', 'compartir'], true)) {
  if (!$esOficina && !$esRobot) {
    if ($evento === 'visita') anotar($dirVisitas, ['v', $propPost, $limpio($datos['origen'] ?? 'directo', 40) ?: 'directo', preg_match('/Mobi|Android|iPhone|iPad/i', $_SERVER['HTTP_USER_AGENT'] ?? '') ? 'm' : 'd']);
    elseif ($evento === 'compartir') anotar($dirVisitas, ['x', $propPost, $limpio($datos['medio'] ?? '', 30)]);
    else anotar($dirVisitas, array_merge(['s', $propPost], array_map(fn($k) => max(0, min(3600, (int)($datos[$k] ?? 0))), ['seg', 'fotos', 'ampliadas', 'tour', 'video', 'planos', 'mapa', 'descripcion', 'compartir', 'telefono', 'email'])));
  }
  if ($evento === 'visita') resumenDiario($dirVisitas, $cfg);
  salir(true);
}

// Aviso de clic en un botón de WhatsApp: no carga nada en Tokko, solo avisa por Telegram (si está configurado).
if (($datos['evento'] ?? '') === 'whatsapp') {
  $marcaWa = sys_get_temp_dir() . '/dm_wa_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
  if (file_exists($marcaWa) && time() - filemtime($marcaWa) < 10) salir(true);
  @touch($marcaWa);
  if (!$esOficina) anotar($dirVisitas, ['w', propDe(($datos['texto'] ?? '') . ' ' . ($datos['url'] ?? ''))]);
  $tk = is_array($cfg) ? ($cfg['telegram_token'] ?? '') : '';
  $chat = is_array($cfg) ? ($cfg['telegram_chat'] ?? '') : '';
  if ($tk !== '' && $chat !== '') {
    $pagina = filter_var($datos['url'] ?? '', FILTER_VALIDATE_URL) ?: '';
    $aviso = "Alguien tocó WhatsApp en la web\n" . $limpio($datos['texto'] ?? '', 300) . ($pagina ? "\n\nDesde: " . $pagina : '');
    $ctx = is_array($datos['ctx'] ?? null) ? $datos['ctx'] : null;
    if ($ctx) {
      $o = strtolower($limpio((string)($ctx['origen'] ?? ''), 40));
      $nombres = ['google' => 'Google', 'instagram' => 'Instagram', 'facebook' => 'Facebook', 'whatsapp' => 'WhatsApp', 'wa.me' => 'WhatsApp', 'zonaprop' => 'Zonaprop', 'mercadolibre' => 'Mercado Libre', 'argenprop' => 'Argenprop', 'lujanprop' => 'LujanProp', 'bing' => 'Bing', 'directo' => 'directo (link guardado o escrito)'];
      $o = ['ig' => 'instagram', 'fb' => 'facebook'][$o] ?? $o;
      $origen = $o;
      foreach ($nombres as $k => $v) if (strpos($o, $k) !== false) { $origen = $v; break; }
      $seg = max(0, min(86400, (int)($ctx['seg'] ?? 0)));
      $lin = "\n\nLlegó desde: " . ($origen !== '' ? $origen : '¿?') . ' · ' . (!empty($ctx['celular']) ? 'celular' : 'compu');
      $lin .= "\nEn la web: " . max(1, (int)($ctx['paginas'] ?? 1)) . ' pág. · ' . intdiv($seg, 60) . ':' . str_pad((string)($seg % 60), 2, '0', STR_PAD_LEFT) . ' min';
      if ((int)($ctx['fotos'] ?? 0) > 1) $lin .= ' · ' . (int)$ctx['fotos'] . ' fotos';
      $vistas = [];
      foreach (array_slice(is_array($ctx['props'] ?? null) ? $ctx['props'] : [], 0, 6) as $pv) if (is_array($pv)) $vistas[] = trim($limpio((string)($pv['c'] ?? ''), 12) . ' ' . $limpio((string)($pv['t'] ?? ''), 45));
      if ($vistas) $lin .= "\nVio:\n• " . implode("\n• ", array_filter($vistas));
      $aviso .= $lin;
    }
    $tg = curl_init('https://api.telegram.org/bot' . $tk . '/sendMessage');
    curl_setopt_array($tg, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => ['chat_id' => $chat, 'text' => $aviso, 'disable_web_page_preview' => 'true'], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
    curl_exec($tg);
    curl_close($tg);
  }
  salir(true);
}
$nombre = $limpio($datos['nombre'] ?? '', 120);
$telefono = $limpio($datos['telefono'] ?? '', 40);
$email = filter_var($datos['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '';
$mensaje = $limpio($datos['mensaje'] ?? '', 2000);
$tipo = $limpio($datos['tipo'] ?? 'Consulta', 60);
$url = filter_var($datos['url'] ?? '', FILTER_VALIDATE_URL) ?: '';
$propiedad = preg_match('/^\d{1,12}$/', (string)($datos['propiedad'] ?? '')) ? (int)$datos['propiedad'] : 0;
if ($nombre === '' || $telefono === '') salir(false, 422);

// Límite simple: una consulta cada 20 segundos por IP.
$marca = sys_get_temp_dir() . '/dm_contacto_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
if (file_exists($marca) && time() - filemtime($marca) < 20) salir(false, 429);
@touch($marca);

$config = @include dirname(__DIR__) . '/dimartino-config.php';
$clave = is_array($config) ? ($config['tokko_key'] ?? '') : '';
if ($clave === '') salir(false, 500);

$cuerpo = [
  'name' => $nombre,
  'cellphone' => $telefono,
  'email' => $email,
  'text' => trim($tipo . "\n" . $mensaje . ($url ? "\n" . $url : '')),
  'tags' => ['Web Di Martino', $tipo],
];
if ($propiedad) $cuerpo['properties'] = [$propiedad];

$ch = curl_init('https://www.tokkobroker.com/api/v1/webcontact/?key=' . urlencode($clave));
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($cuerpo),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 20,
]);
curl_exec($ch);
$estado = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if (!$esOficina) anotar($dirVisitas, ['c', $propiedad ? (string)$propiedad : '']);

// Aviso por Telegram (opcional): se activa si el archivo de configuración trae 'telegram_token' y 'telegram_chat'.
$tgToken = is_array($config) ? ($config['telegram_token'] ?? '') : '';
$tgChat = is_array($config) ? ($config['telegram_chat'] ?? '') : '';
if ($tgToken !== '' && $tgChat !== '') {
  $aviso = "Nueva consulta web\n" . $tipo . "\nNombre: " . $nombre . "\nTel: " . $telefono
    . ($email ? "\nEmail: " . $email : '') . ($mensaje ? "\n\n" . $mensaje : '') . ($url ? "\n\n" . $url : '')
    . ($estado >= 200 && $estado < 300 ? '' : "\n\nOJO: no se pudo cargar en Tokko.");
  $tg = curl_init('https://api.telegram.org/bot' . $tgToken . '/sendMessage');
  curl_setopt_array($tg, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ['chat_id' => $tgChat, 'text' => $aviso, 'disable_web_page_preview' => 'true'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
  ]);
  curl_exec($tg);
  curl_close($tg);
}
salir($estado >= 200 && $estado < 300, $estado >= 200 && $estado < 300 ? 200 : 502);
