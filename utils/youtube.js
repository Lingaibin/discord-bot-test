require('../polyfills');

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const { PassThrough } = require('stream');
const { StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytSearch = require('yt-search');

const execFileAsync = promisify(execFile);
const BIN_DIR = path.join(__dirname, '..', 'bin');
const YT_DLP_BIN = process.env.YT_DLP_PATH || path.join(BIN_DIR, 'yt-dlp');

// macOS: the single-file yt-dlp unpacks itself on every run and macOS security-scans the fresh files,
// costing ~7.5 s per run. The unpacked .zip build starts in ~0.2 s but can't self-update (-U),
// so setupMacYtDlp() updates it itself.
const MAC_DIR = path.join(BIN_DIR, 'yt-dlp_macos');
const MAC_EXE = path.join(MAC_DIR, 'yt-dlp_macos');

let ytDlpReady;

function getYtDlpAssetName() {
    if (process.env.YT_DLP_PATH) {
        return null;
    }

    switch (os.platform()) {
        case 'win32':
            return 'yt-dlp.exe';
        default:
            return 'yt-dlp_linux';
    }
}

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);

        https
            .get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    file.close();
                    fs.unlinkSync(destination);
                    return resolve(downloadFile(response.headers.location, destination));
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(destination);
                    return reject(new Error(`Failed to download yt-dlp (${response.statusCode})`));
                }

                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            })
            .on('error', (error) => {
                file.close();
                if (fs.existsSync(destination)) {
                    fs.unlinkSync(destination);
                }
                reject(error);
            });
    });
}

async function downloadYtDlpBinary(destination) {
    const releases = await YTDlpWrap.getGithubReleases(1, 1);
    const version = releases[0].tag_name;
    const assetName = getYtDlpAssetName();

    if (!assetName) {
        return;
    }

    const fileUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${assetName}`;
    await downloadFile(fileUrl, destination);

    if (os.platform() !== 'win32') {
        fs.chmodSync(destination, 0o755);
    }
}

function isYouTubeUrl(input) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(input);
}

async function setupYtDlp() {
    if (process.env.YT_DLP_PATH) {
        if (!fs.existsSync(process.env.YT_DLP_PATH)) {
            throw new Error(`YT_DLP_PATH does not exist: ${process.env.YT_DLP_PATH}`);
        }

        return new YTDlpWrap(process.env.YT_DLP_PATH);
    }

    if (os.platform() === 'darwin') {
        return setupMacYtDlp();
    }

    if (!fs.existsSync(YT_DLP_BIN)) {
        fs.mkdirSync(path.dirname(YT_DLP_BIN), { recursive: true });
        console.log('Downloading yt-dlp binary (first run only)...');
        await downloadYtDlpBinary(YT_DLP_BIN);
    }

    const ytdl = new YTDlpWrap(YT_DLP_BIN);

    // YouTube breaks old yt-dlp builds (HTTP 403), so self-update the bundled binary.
    // ponytail: once per bot start; a bot left running for months needs a restart to update.
    try {
        console.log(await ytdl.execPromise(['-U']));
    } catch (error) {
        console.warn('yt-dlp self-update failed, using current version:', error.message);
    }

    return ytdl;
}

// YouTube breaks old yt-dlp builds (HTTP 403), so install the latest release whenever it differs
// from what's installed. ponytail: checked once per bot start, like the -U path on other platforms.
async function setupMacYtDlp() {
    const installed = fs.existsSync(MAC_EXE)
        ? await execFileAsync(MAC_EXE, ['--version']).then(({ stdout }) => stdout.trim(), () => null)
        : null;

    try {
        const [{ tag_name: latest }] = await YTDlpWrap.getGithubReleases(1, 1);

        if (installed === latest) {
            console.log(`yt-dlp is up to date (${installed})`);
        } else {
            console.log(installed ? `Updating yt-dlp ${installed} -> ${latest}...` : 'Downloading yt-dlp (first run only)...');

            const zip = `${MAC_DIR}.zip`;
            const tmp = `${MAC_DIR}.new`;

            // Download and unpack beside the current copy, then swap, so a failure leaves it untouched.
            fs.mkdirSync(BIN_DIR, { recursive: true });
            fs.rmSync(tmp, { recursive: true, force: true });
            await downloadFile(`https://github.com/yt-dlp/yt-dlp/releases/download/${latest}/yt-dlp_macos.zip`, zip);
            await execFileAsync('ditto', ['-x', '-k', zip, tmp]);
            fs.rmSync(MAC_DIR, { recursive: true, force: true });
            fs.renameSync(tmp, MAC_DIR);
            fs.rmSync(zip);
            console.log(`yt-dlp ${latest} installed`);
        }
    } catch (error) {
        if (!installed) {
            throw error;
        }

        console.warn('yt-dlp update check failed, using current version:', error.message);
    }

    return new YTDlpWrap(MAC_EXE);
}

// Cache the promise so concurrent first plays don't download/update the binary twice.
function ensureYtDlp() {
    ytDlpReady ??= setupYtDlp().catch((error) => {
        ytDlpReady = null;
        throw error;
    });

    return ytDlpReady;
}

// Every yt-dlp call that talks to YouTube must include this. Without a JS runtime yt-dlp falls back
// to a deprecated YouTube client that gets 403s and is missing formats.
const JS_RUNTIME_ARGS = ['--js-runtimes', `node:${process.execPath}`];

// A single video, audio only.
const YT_DLP_ARGS = [
    ...JS_RUNTIME_ARGS,
    '--no-playlist',
    '-f',
    'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
];

// ponytail: a 25-song Mix takes ~8 s to look up; raise this if you want longer playlists queued.
const PLAYLIST_LIMIT = 25;

// Returns the songs from the clicked video onward, or [] if the list can't be read (private/invalid).
async function resolvePlaylist(ytdl, query, url) {
    const videoId = url.searchParams.get('v') ?? (url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : null);
    const index = Math.max(Number.parseInt(url.searchParams.get('index'), 10) || 1, 1);

    const playlist = JSON.parse(await ytdl.execPromise([
        query,
        ...JS_RUNTIME_ARGS,
        '--flat-playlist',
        '-J',
        '-I',
        `1:${index + PLAYLIST_LIMIT - 1}`,
    ]));

    // No entries means yt-dlp could not read the list and returned the single video instead.
    const entries = playlist.entries ?? [];

    // Normal playlists keep the clicked video at index=, but YouTube Mixes move it to #1,
    // so start wherever v= actually is and only fall back to index=.
    const found = entries.findIndex((entry) => entry.id === videoId);
    const start = found >= 0 ? found : index - 1;

    return entries.slice(start, start + PLAYLIST_LIMIT).map((entry) => ({
        title: entry.title,
        url: entry.url ?? `https://www.youtube.com/watch?v=${entry.id}`,
        durationSec: entry.duration,
    }));
}

// Returns an array: one song, or the rest of a playlist when the link has list=.
async function resolveSongs(query) {
    if (isYouTubeUrl(query)) {
        const ytdl = await ensureYtDlp();
        const url = new URL(/^https?:\/\//i.test(query) ? query : `https://${query}`);

        if (url.searchParams.has('list')) {
            const songs = await resolvePlaylist(ytdl, query, url);

            if (songs.length > 0) {
                return songs;
            }
        }

        // Passing our own -f also stops yt-dlp-wrap adding "-f best", which YouTube rarely offers.
        const metadata = await ytdl.getVideoInfo([query, ...YT_DLP_ARGS]);

        return [{
            title: metadata.title,
            url: metadata.webpage_url || query,
            durationSec: metadata.duration, // undefined for live streams
        }];
    }

    const result = await ytSearch(query);

    if (!result.videos.length) {
        throw new Error(`No results found for "${query}".`);
    }

    const video = result.videos[0];

    return [{
        title: video.title,
        url: video.url,
        durationSec: video.seconds, // 0 for live streams
    }];
}

function detectFfmpegInputFormat(buffer) {
    if (
        buffer.length >= 4 &&
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
    ) {
        return 'webm';
    }

    if (buffer.length >= 8 && buffer.slice(4, 8).toString() === 'ftyp') {
        return 'mov';
    }

    return null;
}

function spawnFfmpeg(inputFormat) {
    return spawn(
        ffmpegPath,
        [
            '-loglevel',
            'error',
            '-nostdin',
            '-thread_queue_size',
            '4096',
            '-f',
            inputFormat,
            '-i',
            'pipe:0',
            '-vn',
            '-acodec',
            'libopus',
            '-ar',
            '48000',
            '-ac',
            '2',
            '-f',
            'ogg',
            'pipe:1',
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
    );
}

// yt-dlp-wrap's execStream destroys its buffered audio the moment yt-dlp exits, which cut songs off
// minutes in. Spawn yt-dlp directly and give it a big buffer so it still downloads at full speed.
// ponytail: 64 MB (~1h of audio); longer tracks make yt-dlp wait on playback instead.
const YT_DLP_BUFFER_BYTES = 64 * 1024 * 1024;

function createAudioStream(videoUrl) {
    const ytdlPromise = ensureYtDlp();

    return ytdlPromise.then((ytdl) => {
        const ytDlp = spawn(ytdl.getBinaryPath(), [
            videoUrl,
            ...YT_DLP_ARGS,
            '-o',
            '-',
            '--retries',
            '10',
            '--fragment-retries',
            '10',
            '--socket-timeout',
            '30',
        ]);
        const ytDlpStream = ytDlp.stdout.pipe(new PassThrough({ highWaterMark: YT_DLP_BUFFER_BYTES }));

        let ytDlpLog = '';
        ytDlp.stderr.on('data', (data) => {
            ytDlpLog += data.toString();
        });

        return new Promise((resolve, reject) => {
            let buffered = Buffer.alloc(0);
            let ffmpeg;
            let settled = false;

            const fail = (error) => {
                if (settled) {
                    return;
                }

                settled = true;
                ytDlp.kill('SIGKILL');
                ffmpeg?.kill('SIGKILL');
                reject(error);
            };

            const onData = (chunk) => {
                buffered = Buffer.concat([buffered, chunk]);

                if (buffered.length < 16) {
                    return;
                }

                ytDlpStream.off('data', onData);

                const inputFormat = detectFfmpegInputFormat(buffered);

                if (!inputFormat) {
                    fail(new Error('Unsupported audio format from YouTube.'));
                    return;
                }

                ffmpeg = spawnFfmpeg(inputFormat);

                let ffmpegLog = '';
                ffmpeg.stderr.on('data', (data) => {
                    ffmpegLog += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    ytDlp.kill(); // stop downloading once the song ends or is skipped

                    if (code != null && code !== 0) {
                        console.error('ffmpeg exited with code', code, ffmpegLog.slice(-500));
                    }
                });

                ffmpeg.stdin.on('error', () => {
                    // Ignore EPIPE when the stream ends naturally.
                });

                ffmpeg.stdin.write(buffered);
                ytDlpStream.pipe(ffmpeg.stdin);

                settled = true;
                resolve({
                    stream: ffmpeg.stdout,
                    type: StreamType.OggOpus,
                });
            };

            ytDlpStream.on('data', onData);
            ytDlp.on('error', fail);
            ytDlp.on('close', (code) => {
                if (!settled) {
                    fail(new Error(`yt-dlp closed before audio data was ready (code: ${code}) ${ytDlpLog.slice(-500)}`));
                } else if (code != null && code !== 0) {
                    console.error('yt-dlp exited with code', code, ytDlpLog.slice(-500));
                }
            });
        });
    });
}

module.exports = {
    createAudioStream,
    isYouTubeUrl,
    resolveSongs,
};
