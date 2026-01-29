<?php
$assetTimestamps = [];
$jsRoot = __DIR__ . '/js';

if (is_dir($jsRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($jsRoot, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $relativePath = 'js/' . str_replace('\\', '/', substr($file->getPathname(), strlen($jsRoot) + 1));
        $assetTimestamps[$relativePath] = $file->getMTime();
    }
}

function assetUrl(string $path, array $timestamps): string
{
    $timestamp = $timestamps[$path] ?? null;
    if ($timestamp === null) {
        $fullPath = __DIR__ . '/' . ltrim($path, '/');
        $timestamp = is_file($fullPath) ? filemtime($fullPath) : time();
    }

    return $path . '?v=' . $timestamp;
}

function musicUrl(string $filename, int $timestamp): string
{
    $encoded = rawurlencode($filename);
    return 'media/music/' . $encoded . '?v=' . $timestamp;
}

$musicTracks = [];
$musicTimes = [];
$musicFiles = [];
$musicRoot = __DIR__ . '/media/music';
if (is_dir($musicRoot)) {
    $iterator = new DirectoryIterator($musicRoot);
    foreach ($iterator as $file) {
        if ($file->isDot() || !$file->isFile()) {
            continue;
        }

        $extension = strtolower($file->getExtension());
        if (!in_array($extension, ['mp3', 'ogg'], true)) {
            continue;
        }

        $musicFiles[] = $file->getFilename();
        $musicTimes[] = $file->getMTime();
    }
}

if ($musicFiles) {
    sort($musicFiles, SORT_NATURAL | SORT_FLAG_CASE);
    foreach ($musicFiles as $filename) {
        $fullPath = $musicRoot . '/' . $filename;
        $timestamp = is_file($fullPath) ? filemtime($fullPath) : time();
        $musicTracks[] = musicUrl($filename, $timestamp);
    }
}

$latestAssetTime = $assetTimestamps ? max($assetTimestamps) : 0;
$latestMusicTime = $musicTimes ? max($musicTimes) : 0;
$lastModified = max(filemtime(__FILE__), $latestAssetTime, $latestMusicTime);

header('Cache-Control: no-cache, must-revalidate');
header('Expires: ' . gmdate('D, d M Y H:i:s', $lastModified) . ' GMT');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastModified) . ' GMT');
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Modular Canvas Game</title>
    <style>
      :root {
        color-scheme: light;
      }

      body {
        margin: 0;
        overflow: hidden;
        min-height: 100vh;
        background: #0f1115;
      }

      canvas {
        display: block;
        background: #0b0f14;
      }
    </style>
  </head>
  <body>
    <script type="application/json" id="music-tracks"><?= json_encode($musicTracks, JSON_UNESCAPED_SLASHES) ?></script>
    <script type="module" src="<?= assetUrl('js/main.js', $assetTimestamps) ?>"></script>
  </body>
</html>
