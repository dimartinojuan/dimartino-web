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

// --- Estadísticas propias y resumen diario por Telegram ---
// Se guardan fuera de public_html, en /home/USUARIO/dimartino-visitas/AAAA-MM-DD.log (una línea por evento, separada por tabs, sin IP
// ni datos personales: solo un código que cambia todos los días). Los equipos marcados como "oficina" no se cuentan. Se borran a los 90 días.
date_default_timezone_set('America/Argentina/Buenos_Aires');
$cfg = @include dirname(__DIR__) . '/dimartino-config.php';
$dirVisitas = dirname(__DIR__) . '/dimartino-visitas';
function anotar($dir, array $campos) {
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) return;
  $sal = @file_get_contents($dir . '/sal');
  if (!$sal) { $sal = bin2hex(random_bytes(16)); @file_put_contents($dir . '/sal', $sal); }
  $id = substr(hash('sha256', $sal . date('Y-m-d') . ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 12);
  $campos = array_map(fn($c) => preg_replace('/[\t\r\n]+/', ' ', mb_substr((string)$c, 0, 60)), $campos);
  array_splice($campos, 1, 0, [$id]);
  @file_put_contents($dir . '/' . date('Y-m-d') . '.log', implode("\t", $campos) . "\n", FILE_APPEND | LOCK_EX);
}
// Propiedad de la que habla un mensaje o una dirección: número de Tokko, o "c:CODIGO" si viene del enlace corto.
function propDe($texto) {
  if (preg_match('#/propiedades/(\d{1,12})/#', $texto, $m)) return $m[1];
  if (preg_match('#dimartinoprop\.com\.ar/([A-Za-z0-9-]{2,20})(?![\w/-])#', $texto, $m)) return 'c:' . strtoupper($m[1]);
  return '';
}
function mmss($seg) { $seg = (int)round($seg); return intdiv($seg, 60) . ':' . str_pad($seg % 60, 2, '0', STR_PAD_LEFT); }
// Arma el texto del resumen de un día (también sirve para probarlo).
function textoResumen($dir, $dia, &$datosDia = null) {
  $props = [];
  foreach ((json_decode(@file_get_contents(__DIR__ . '/data/properties.json'), true)['properties'] ?? []) as $p) {
    $info = ['cod' => (string)($p['reference_code'] ?? $p['id']), 'dir' => (string)($p['address'] ?? '')];
    $props[(string)$p['id']] = $info; $props['c:' . strtoupper(preg_replace('/\s+/', '-', trim($info['cod'])))] = (string)$p['id'];
  }
  $clave = function ($x) use ($props) { return (substr($x, 0, 2) === 'c:' && isset($props[$x])) ? $props[$x] : $x; };
  $personas = []; $paginas = 0; $celu = []; $origenes = []; $tiempos = []; $tot = ['w' => 0, 'c' => 0, 'x' => 0, 'tel' => 0, 'tour' => 0, 'video' => 0];
  $porProp = [];
  $p0 = fn() => ['personas' => [], 'vistas' => 0, 'seg' => [], 'fotos' => [], 'tour' => 0, 'video' => 0, 'planos' => 0, 'mapa' => 0, 'w' => 0, 'c' => 0, 'x' => 0, 'tel' => 0];
  foreach (@file($dir . '/' . $dia . '.log', FILE_IGNORE_NEW_LINES) ?: [] as $l) {
    $f = strpos($l, "\t") !== false ? explode("\t", $l) : explode(' ', $l);
    [$t, $id] = array_pad($f, 2, ''); $prop = $clave($f[2] ?? '');
    if ($prop !== '' && !isset($porProp[$prop])) $porProp[$prop] = $p0();
    if ($t === 'v') {
      $paginas++; $personas[$id] = 1; $celu[$id] = ($f[4] ?? '') === 'm';
      $o = strtolower($f[3] ?? 'directo');
      foreach (['google' => 'Google', 'instagram' => 'Instagram', 'facebook' => 'Facebook', 'whatsapp' => 'WhatsApp', 'wa.me' => 'WhatsApp', 'zonaprop' => 'Zonaprop', 'mercadolibre' => 'Mercado Libre', 'bing' => 'Bing', 'lujanprop' => 'LujanProp', 'tiktok' => 'TikTok', 'directo' => 'directo'] as $k => $nom) if (strpos($o, $k) !== false) { $o = $nom; break; }
      if ($o !== 'interna') { $origenes[$o] = ($origenes[$o] ?? 0) + 1; }
      if ($prop !== '') { $porProp[$prop]['vistas']++; $porProp[$prop]['personas'][$id] = 1; }
    } elseif ($t === 's') {
      $seg = (int)($f[3] ?? 0); if ($seg > 0) $tiempos[] = $seg;
      [$fotos, , $tour, $video, $planos, $mapa, , , $tel] = array_map('intval', array_pad(array_slice($f, 4, 10), 10, 0));
      if ($tour) $tot['tour']++; if ($video) $tot['video']++; if ($tel) $tot['tel']++;
      if ($prop !== '') { $q = &$porProp[$prop]; if ($seg > 0) $q['seg'][] = $seg; $q['fotos'][] = $fotos; $q['tour'] += $tour ? 1 : 0; $q['video'] += $video ? 1 : 0; $q['planos'] += $planos ? 1 : 0; $q['mapa'] += $mapa ? 1 : 0; $q['tel'] += $tel ? 1 : 0; unset($q); }
    } elseif (in_array($t, ['w', 'c', 'x'], true)) {
      $tot[$t]++; if ($prop !== '') $porProp[$prop][$t]++;
    }
  }
  $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; $ts = strtotime($dia);
  $n = count($personas); $nCelu = count(array_filter($celu));
  $txt = 'Web del ' . $dias[(int)date('w', $ts)] . ' ' . date('d/m', $ts) . " (sin la oficina)\n\n"
    . $n . ' personas · ' . $paginas . ' páginas vistas' . ($tiempos ? ' · ' . mmss(array_sum($tiempos) / count($tiempos)) . ' min por página' : '') . "\n"
    . ($n ? 'Celular ' . round($nCelu * 100 / $n) . '% · Compu ' . (100 - round($nCelu * 100 / $n)) . "%\n" : '');
  if ($origenes) { arsort($origenes); $txt .= 'Llegan de: ' . implode(' · ', array_map(fn($k, $v) => $k . ' ' . $v, array_keys(array_slice($origenes, 0, 5, true)), array_slice($origenes, 0, 5, true))) . "\n"; }
  $txt .= "\nWhatsApp " . $tot['w'] . ' · Consultas ' . $tot['c'] . ' · Teléfono ' . $tot['tel'] . ' · Compartidas ' . $tot['x'] . "\n"
    . 'Abrieron recorrido 360: ' . $tot['tour'] . ' · Video: ' . $tot['video'] . "\n";
  uasort($porProp, fn($a, $b) => [count($b['personas']), $b['w']] <=> [count($a['personas']), $a['w']]);
  $top = array_slice(array_filter($porProp, fn($q) => $q['vistas'] || $q['w'] || $q['c']), 0, 8, true);
  if ($top) {
    $txt .= "\nPropiedades más vistas:\n"; $i = 0;
    foreach ($top as $k => $q) {
      $info = $props[$k] ?? null; $nom = is_array($info) ? $info['cod'] . ' ' . $info['dir'] : ($k === '' ? 'General' : 'Código ' . preg_replace('/^c:/', '', $k));
      $det = [count($q['personas']) . ' pers.'];
      if ($q['seg']) $det[] = mmss(array_sum($q['seg']) / count($q['seg'])) . ' min';
      if ($q['fotos'] && max($q['fotos'])) $det[] = round(array_sum($q['fotos']) / count($q['fotos'])) . ' fotos';
      foreach (['tour' => '360', 'video' => 'video', 'planos' => 'plano', 'mapa' => 'mapa', 'w' => 'WhatsApp', 'c' => 'consulta', 'x' => 'compartida', 'tel' => 'tel.'] as $c => $nombre) if ($q[$c]) $det[] = $nombre . ' ' . $q[$c];
      $txt .= (++$i) . '. ' . $nom . "\n   " . implode(' · ', $det) . "\n";
    }
  }
  // Datos ordenados para la planilla (una fila por día y una por propiedad con movimiento).
  $filasProp = [];
  foreach ($porProp as $k => $q) {
    if (!$q['vistas'] && !$q['w'] && !$q['c'] && !$q['x']) continue;
    $info = $props[$k] ?? null;
    $filasProp[] = ['codigo' => is_array($info) ? $info['cod'] : ($k === '' ? 'General' : preg_replace('/^c:/', '', $k)), 'tokko' => is_array($info) ? (string)$k : '', 'direccion' => is_array($info) ? $info['dir'] : '',
      'personas' => count($q['personas']), 'vistas' => $q['vistas'], 'segundos' => $q['seg'] ? (int)round(array_sum($q['seg']) / count($q['seg'])) : 0,
      'fotos' => $q['fotos'] ? (int)round(array_sum($q['fotos']) / count($q['fotos'])) : 0, 'tour' => $q['tour'], 'video' => $q['video'], 'planos' => $q['planos'], 'mapa' => $q['mapa'],
      'whatsapp' => $q['w'], 'consultas' => $q['c'], 'compartidas' => $q['x'], 'telefono' => $q['tel']];
  }
  $datosDia = ['fecha' => $dia, 'personas' => $n, 'paginas' => $paginas, 'segundos' => $tiempos ? (int)round(array_sum($tiempos) / count($tiempos)) : 0,
    'celular' => $n ? round($nCelu * 100 / $n) : 0, 'origenes' => $origenes, 'whatsapp' => $tot['w'], 'consultas' => $tot['c'], 'telefono' => $tot['tel'],
    'compartidas' => $tot['x'], 'tour' => $tot['tour'], 'video' => $tot['video'], 'propiedades' => $filasProp, 'texto' => $txt];
  return $txt;
}
// Manda el resumen del día a la planilla de Google (que además lo manda por mail). Se activa con 'planilla_url' y 'planilla_clave' en el archivo de configuración.
function enviarPlanilla($cfg, array $datosDia) {
  $url = is_array($cfg) ? ($cfg['planilla_url'] ?? '') : '';
  $clave = is_array($cfg) ? ($cfg['planilla_clave'] ?? '') : '';
  if ($url === '' || $clave === '') return false;
  $h = curl_init($url);
  curl_setopt_array($h, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode(['clave' => $clave] + $datosDia, JSON_UNESCAPED_UNICODE), CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 20]);
  $r = curl_exec($h); curl_close($h);
  return is_string($r) && strpos($r, '"ok":true') !== false;
}
// Manda una vez por día (con la primera visita después de las 8) el resumen de ayer.
function resumenDiario($dir, $cfg) {
  $tk = is_array($cfg) ? ($cfg['telegram_token'] ?? '') : '';
  $chat = is_array($cfg) ? ($cfg['telegram_chat'] ?? '') : '';
  $hayPlanilla = is_array($cfg) && !empty($cfg['planilla_url']) && !empty($cfg['planilla_clave']);
  if ((($tk === '' || $chat === '') && !$hayPlanilla) || (int)date('G') < 8 || !is_dir($dir)) return;
  $ayer = date('Y-m-d', strtotime('-1 day'));
  $marca = @fopen($dir . '/enviado-' . $ayer, 'x');
  if (!$marca) return; // ya se mandó
  fclose($marca);
  $datosDia = null; $texto = textoResumen($dir, $ayer, $datosDia);
  if ($tk !== '' && $chat !== '') {
    $tg = curl_init('https://api.telegram.org/bot' . $tk . '/sendMessage');
    curl_setopt_array($tg, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => ['chat_id' => $chat, 'text' => mb_substr($texto, 0, 4000)], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
    curl_exec($tg);
    curl_close($tg);
  }
  if ($hayPlanilla) enviarPlanilla($cfg, $datosDia);
  foreach (glob($dir . '/*') ?: [] as $f) if (basename($f) !== 'sal' && filemtime($f) < time() - 90 * 86400) @unlink($f);
}
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
