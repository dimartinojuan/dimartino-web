<?php
// Bot de Telegram (@DiMartinoConsultasBot): Juan le pide el resumen de la web y el bot contesta.
// Telegram llama a esta página cada vez que alguien le escribe al bot. Solo contesta al chat de 'telegram_chat'
// (dimartino-config.php, fuera de public_html). Se activa UNA vez abriendo https://www.dimartinoprop.com.ar/resumen.php?activar
// (si el bot ya estaba conectado a otro sistema, no lo pisa: avisa a dónde está conectado; para pisarlo, ?activar&forzar).
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/estadisticas.php';
$tk = is_array($cfg) ? (string)($cfg['telegram_token'] ?? '') : '';
$chat = is_array($cfg) ? (string)($cfg['telegram_chat'] ?? '') : '';
if ($tk === '' || $chat === '') { http_response_code(503); echo '{"ok":false}'; exit; }
$secreto = substr(hash('sha256', 'dm-bot|' . $tk), 0, 40);
function tg($tk, $metodo, array $p = []) {
  $h = curl_init('https://api.telegram.org/bot' . $tk . '/' . $metodo);
  curl_setopt_array($h, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($p, JSON_UNESCAPED_UNICODE), CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
  $r = curl_exec($h); curl_close($h);
  return json_decode((string)$r, true) ?: [];
}
if (isset($_GET['activar'])) {
  $url = 'https://www.dimartinoprop.com.ar/resumen.php';
  $actual = (string)(tg($tk, 'getWebhookInfo')['result']['url'] ?? '');
  if ($actual !== '' && $actual !== $url && !isset($_GET['forzar'])) { echo json_encode(['ok' => false, 'conectado_a' => parse_url($actual, PHP_URL_HOST)]); exit; }
  $r = tg($tk, 'setWebhook', ['url' => $url, 'secret_token' => $secreto, 'allowed_updates' => ['message'], 'drop_pending_updates' => true]);
  tg($tk, 'setMyCommands', ['commands' => [['command' => 'hoy', 'description' => 'Resumen de hoy hasta ahora'], ['command' => 'ayer', 'description' => 'Resumen de ayer'], ['command' => 'semana', 'description' => 'Resumen de los últimos 7 días']]]);
  echo json_encode(['ok' => !empty($r['ok'])]); exit;
}
if (!hash_equals($secreto, (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? ''))) { http_response_code(403); exit; }
$u = json_decode((string)file_get_contents('php://input'), true);
$m = is_array($u) ? ($u['message'] ?? null) : null;
echo '{"ok":true}';
if (!is_array($m) || (string)($m['chat']['id'] ?? '') !== $chat) exit;
$t = mb_strtolower(trim((string)($m['text'] ?? '')));
$teclado = ['keyboard' => [[['text' => 'Hoy'], ['text' => 'Ayer'], ['text' => 'Semana']]], 'resize_keyboard' => true, 'is_persistent' => true];
if (isset($m['voice']) || isset($m['audio'])) $resp = 'Por ahora no entiendo audios. Tocá un botón de abajo: Hoy, Ayer o Semana.';
elseif (preg_match('/\bhoy\b/u', $t)) $resp = "(Hoy hasta ahora)\n" . textoResumen($dirVisitas, date('Y-m-d'));
elseif (preg_match('/\bayer\b/u', $t)) $resp = textoResumen($dirVisitas, date('Y-m-d', strtotime('-1 day')));
elseif (preg_match('/semana/u', $t)) $resp = textoSemana($dirVisitas);
elseif (preg_match('#\b(\d{1,2})[/-](\d{1,2})\b#', $t, $f) && checkdate((int)$f[2], (int)$f[1], (int)date('Y'))) {
  $dia = sprintf('%04d-%02d-%02d', (int)date('Y'), (int)$f[2], (int)$f[1]);
  if ($dia > date('Y-m-d')) $dia = sprintf('%04d-%02d-%02d', (int)date('Y') - 1, (int)$f[2], (int)$f[1]);
  $resp = textoResumen($dirVisitas, $dia);
} else $resp = "Hola. Pedime el resumen de la web con los botones de abajo: Hoy, Ayer o Semana.\nTambién podés mandar una fecha, por ejemplo 12/11.";
tg($tk, 'sendMessage', ['chat_id' => $chat, 'text' => mb_substr($resp, 0, 4000), 'reply_markup' => $teclado, 'disable_web_page_preview' => true]);
