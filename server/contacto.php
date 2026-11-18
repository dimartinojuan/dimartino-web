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
  $filas = ''; $plano = '';
  foreach ($props as $i => $p) {
    $url = $sitio . ($p['path'] ?? 'propiedades/' . $p['id'] . '/');
    $nombre = trim(($p['type']['label'] ?? 'Propiedad') . ' | ' . ($p['address'] ?? ''));
    $zona = $p['location']['name'] ?? '';
    $foto = $p['photos'][0]['image'] ?? '';
    $filas .= '<tr><td style="padding:12px 0;border-top:1px solid #e6e1d8;width:120px;vertical-align:top">'
      . ($foto ? '<a href="' . $h($url) . '"><img src="' . $h($foto) . '" width="110" height="80" alt="" style="display:block;width:110px;height:80px;object-fit:cover;border-radius:8px"></a>' : '')
      . '</td><td style="padding:12px 0 12px 12px;border-top:1px solid #e6e1d8;vertical-align:top">'
      . '<a href="' . $h($url) . '" style="color:#0B3042;font-weight:bold;font-size:15px;text-decoration:none">' . $h($nombre) . '</a>'
      . '<div style="color:#6b7280;font-size:13px;margin-top:2px">' . $h($zona) . '</div>'
      . '<div style="color:#0B3042;font-weight:bold;font-size:15px;margin-top:6px">' . $h($precio($p)) . '</div>'
      . '<a href="' . $h($url) . '" style="display:inline-block;margin-top:6px;color:#D3282F;font-size:13px;font-weight:bold">Ver ficha</a></td></tr>';
    $plano .= ($i + 1) . ') ' . $nombre . ($zona ? ', ' . $zona : '') . ' | ' . $precio($p) . "\n" . $url . "\n\n";
  }
  $wa = 'https://wa.me/5492323678107?text=' . rawurlencode("Hola, quiero consultar por estas propiedades de mi lista:\n" . trim($plano));
  $html = '<!DOCTYPE html><html><body style="margin:0;background:#f4f1ec;font-family:Arial,sans-serif">'
    . '<div style="max-width:600px;margin:0 auto;padding:20px">'
    . '<div style="background:#0B3042;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#f3b4b6">Di Martino Propiedades</div><div style="font-size:20px;font-weight:bold;margin-top:4px">Tu lista de propiedades</div></div>'
    . '<div style="background:#fff;padding:8px 22px 20px;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse">' . $filas . '</table>'
    . '<p style="margin:18px 0 0;text-align:center"><a href="' . $h($wa) . '" style="display:inline-block;background:#D3282F;color:#fff;font-weight:bold;padding:12px 22px;border-radius:999px;text-decoration:none">Consultar por WhatsApp</a></p>'
    . '<p style="color:#6b7280;font-size:12px;text-align:center;margin:16px 0 0">Lavalle 889, Luján · (02323) 426040 · <a href="' . $sitio . '" style="color:#0B3042">dimartinoprop.com.ar</a></p></div>'
    . '<p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:12px">Recibiste este mail porque lo pediste desde la web de Di Martino Propiedades.</p></div></body></html>';
  $texto = "Tu lista de propiedades | Di Martino Propiedades\n\n" . $plano . "Consultas por WhatsApp: 2323-678107\nLavalle 889, Luján · (02323) 426040\n";
  $limite = '=_dm' . bin2hex(random_bytes(8));
  $cabeceras = "From: Di Martino Propiedades <info@dimartinoprop.com.ar>\r\nReply-To: info@dimartinoprop.com.ar\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$limite\"";
  $cuerpo = "--$limite\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($texto))
    . "--$limite\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$limite--";
  $asunto = '=?UTF-8?B?' . base64_encode('Tu lista de propiedades | Di Martino') . '?=';
  if (!function_exists('mail')) salir(false, 501); // el hosting no permite mandar mails desde PHP
  $ok = @mail($mail, $asunto, $cuerpo, $cabeceras, '-finfo@dimartinoprop.com.ar');
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
