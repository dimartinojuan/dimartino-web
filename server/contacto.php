<?php
// Recibe las consultas de la web y las carga en Tokko como contacto (aparecen en Consultas).
// La clave de Tokko NO va en este archivo: se lee de un archivo de configuración fuera de la carpeta pública,
// por ejemplo /home/USUARIO/dimartino-config.php con:  <?php return ['tokko_key' => 'CLAVE'];
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
salir($estado >= 200 && $estado < 300, $estado >= 200 && $estado < 300 ? 200 : 502);
