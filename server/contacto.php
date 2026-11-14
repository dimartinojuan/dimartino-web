<?php
// Recibe las consultas de la web y las carga en Tokko como contacto (aparecen en Consultas).
// La clave de Tokko NO va en este archivo: se lee de un archivo de configuración fuera de la carpeta pública,
// por ejemplo /home/USUARIO/dimartino-config.php con:  <?php return ['tokko_key' => 'CLAVE', 'telegram_token' => 'TOKEN_DEL_BOT', 'telegram_chat' => 'ID_DEL_CHAT'];
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
// Se guardan fuera de public_html, en /home/USUARIO/dimartino-visitas/AAAA-MM-DD.log (una línea por evento, sin IP ni datos personales:
// solo un código que cambia todos los días). Los equipos marcados como "oficina" no se cuentan. Se borran a los 90 días.
date_default_timezone_set('America/Argentina/Buenos_Aires');
$cfg = @include dirname(__DIR__) . '/dimartino-config.php';
$dirVisitas = dirname(__DIR__) . '/dimartino-visitas';
function anotar($dir, $tipo) {
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) return;
  $salFile = $dir . '/sal';
  $sal = @file_get_contents($salFile);
  if (!$sal) { $sal = bin2hex(random_bytes(16)); @file_put_contents($salFile, $sal); }
  $id = substr(hash('sha256', $sal . date('Y-m-d') . ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 12);
  @file_put_contents($dir . '/' . date('Y-m-d') . '.log', $tipo . ' ' . $id . "\n", FILE_APPEND | LOCK_EX);
}
// Manda una vez por día (con la primera visita después de las 8) el resumen de ayer.
function resumenDiario($dir, $cfg) {
  $tk = is_array($cfg) ? ($cfg['telegram_token'] ?? '') : '';
  $chat = is_array($cfg) ? ($cfg['telegram_chat'] ?? '') : '';
  if ($tk === '' || $chat === '' || (int)date('G') < 8 || !is_dir($dir)) return;
  $ayer = date('Y-m-d', strtotime('-1 day'));
  $marca = @fopen($dir . '/enviado-' . $ayer, 'x');
  if (!$marca) return; // ya se mandó
  fclose($marca);
  $personas = []; $paginas = 0; $wa = 0; $consultas = 0;
  foreach (@file($dir . '/' . $ayer . '.log', FILE_IGNORE_NEW_LINES) ?: [] as $l) {
    [$t, $id] = array_pad(explode(' ', $l, 2), 2, '');
    if ($t === 'v') { $paginas++; $personas[$id] = 1; }
    elseif ($t === 'w') $wa++;
    elseif ($t === 'c') $consultas++;
  }
  $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  $texto = 'Web de ayer (' . $dias[(int)date('w', strtotime($ayer))] . ' ' . date('d/m', strtotime($ayer)) . "), sin contar la oficina\n"
    . 'Personas: ' . count($personas) . "\nPáginas vistas: " . $paginas . "\nClics en WhatsApp: " . $wa . "\nConsultas: " . $consultas;
  $tg = curl_init('https://api.telegram.org/bot' . $tk . '/sendMessage');
  curl_setopt_array($tg, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => ['chat_id' => $chat, 'text' => $texto], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
  curl_exec($tg);
  curl_close($tg);
  foreach (glob($dir . '/*') ?: [] as $f) if (basename($f) !== 'sal' && filemtime($f) < time() - 90 * 86400) @unlink($f);
}
$esOficina = !empty($datos['oficina']);
$esRobot = (bool)preg_match('/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i', $_SERVER['HTTP_USER_AGENT'] ?? '');

// Página vista (la manda la web en cada página, salvo en los equipos de la oficina).
if (($datos['evento'] ?? '') === 'visita') {
  if (!$esOficina && !$esRobot) anotar($dirVisitas, 'v');
  resumenDiario($dirVisitas, $cfg);
  salir(true);
}

// Aviso de clic en un botón de WhatsApp: no carga nada en Tokko, solo avisa por Telegram (si está configurado).
if (($datos['evento'] ?? '') === 'whatsapp') {
  $marcaWa = sys_get_temp_dir() . '/dm_wa_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
  if (file_exists($marcaWa) && time() - filemtime($marcaWa) < 10) salir(true);
  @touch($marcaWa);
  if (!$esOficina) anotar($dirVisitas, 'w');
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
if (!$esOficina) anotar($dirVisitas, 'c');

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
