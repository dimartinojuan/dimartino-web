<?php
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
// Funciones de estadísticas propias y del resumen diario. Las usan contacto.php (la web) y resumen.php (pedidos por Telegram).
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
      $o = ['ig' => 'instagram', 'fb' => 'facebook'][$o] ?? $o; // utm_source cortos que usan Instagram y Facebook
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
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 60]); // la planilla puede tardar en responder
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

// Resumen de varios días seguidos (por defecto, los 7 días anteriores a hoy).
function textoSemana($dir, $dias = 7) {
  $nombres = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  $t = ['personas' => 0, 'paginas' => 0, 'whatsapp' => 0, 'consultas' => 0, 'telefono' => 0, 'compartidas' => 0];
  $porDia = []; $props = []; $origenes = [];
  for ($i = $dias; $i >= 1; $i--) {
    $dia = date('Y-m-d', strtotime("-$i day")); $d = null; textoResumen($dir, $dia, $d);
    if (!is_array($d)) continue;
    foreach ($t as $k => $_) $t[$k] += (int)($d[$k] ?? 0);
    foreach (($d['origenes'] ?? []) as $o => $n) $origenes[$o] = ($origenes[$o] ?? 0) + $n;
    $ts = strtotime($dia); $porDia[] = $nombres[(int)date('w', $ts)] . ' ' . date('d', $ts) . ': ' . (int)$d['personas'];
    foreach (($d['propiedades'] ?? []) as $p) {
      $k = $p['codigo'];
      if (!isset($props[$k])) $props[$k] = ['dir' => $p['direccion'], 'vistas' => 0, 'w' => 0, 'c' => 0];
      $props[$k]['vistas'] += $p['vistas']; $props[$k]['w'] += $p['whatsapp']; $props[$k]['c'] += $p['consultas'];
    }
  }
  $desde = date('d/m', strtotime("-$dias day")); $hasta = date('d/m', strtotime('-1 day'));
  $txt = "Web Di Martino | últimos $dias días ($desde al $hasta)\n\n";
  $txt .= "Personas: {$t['personas']} · Páginas: {$t['paginas']}\n";
  $txt .= "WhatsApp: {$t['whatsapp']} · Consultas: {$t['consultas']} · Teléfono: {$t['telefono']} · Compartidas: {$t['compartidas']}\n";
  if ($origenes) { arsort($origenes); $o = []; foreach (array_slice($origenes, 0, 5, true) as $k => $n) $o[] = "$k $n"; $txt .= 'Llegan desde: ' . implode(' · ', $o) . "\n"; }
  $txt .= "\nPersonas por día: " . implode(' | ', $porDia) . "\n";
  unset($props['General']);
  uasort($props, fn($a, $b) => $b['vistas'] <=> $a['vistas']);
  if ($props) {
    $txt .= "\nMás vistas:\n"; $n = 0;
    foreach (array_slice($props, 0, 8, true) as $k => $p) { $n++;
      $txt .= "$n. $k " . $p['dir'] . ": {$p['vistas']} vistas" . ($p['w'] ? ", {$p['w']} WhatsApp" : '') . ($p['c'] ? ", {$p['c']} consultas" : '') . "\n"; }
  }
  return $txt;
}
