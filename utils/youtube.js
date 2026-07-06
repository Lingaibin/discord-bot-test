require('../polyfills');

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const { StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytSearch = require('yt-search');

const YT_DLP_BIN = process.env.YT_DLP_PATH || path.join(__dirname, '..', 'bin', 'yt-dlp');
let ytDlpWrap;

function getYtDlpAssetName() {
    if (process.env.YT_DLP_PATH) {
        return null;
    }

    switch (os.platform()) {
        case 'darwin':
            return 'yt-dlp_macos';
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

async function ensureYtDlp() {
    if (ytDlpWrap) {
        return ytDlpWrap;
    }

    if (process.env.YT_DLP_PATH) {
        if (!fs.existsSync(process.env.YT_DLP_PATH)) {
            throw new Error(`YT_DLP_PATH does not exist: ${process.env.YT_DLP_PATH}`);
        }

        ytDlpWrap = new YTDlpWrap(process.env.YT_DLP_PATH);
        return ytDlpWrap;
    }

    if (!fs.existsSync(YT_DLP_BIN)) {
        fs.mkdirSync(path.dirname(YT_DLP_BIN), { recursive: true });
        console.log('Downloading yt-dlp binary (first run only)...');
        await downloadYtDlpBinary(YT_DLP_BIN);
    }

    ytDlpWrap = new YTDlpWrap(YT_DLP_BIN);
    return ytDlpWrap;
}

async function resolveVideo(query) {
    if (isYouTubeUrl(query)) {
        const ytdl = await ensureYtDlp();
        const metadata = await ytdl.getVideoInfo(query);

        return {
            title: metadata.title,
            url: metadata.webpage_url || query,
        };
    }

    const result = await ytSearch(query);

    if (!result.videos.length) {
        throw new Error(`No results found for "${query}".`);
    }

    const video = result.videos[0];

    return {
        title: video.title,
        url: video.url,
    };
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

function createAudioStream(videoUrl) {
    const ytdlPromise = ensureYtDlp();

    return ytdlPromise.then((ytdl) => {
        const ytDlpStream = ytdl.execStream([
            videoUrl,
            '-f',
            'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            '-o',
            '-',
            '--no-playlist',
            '--no-warnings',
            '--retries',
            '10',
            '--fragment-retries',
            '10',
            '--socket-timeout',
            '30',
        ]);

        return new Promise((resolve, reject) => {
            let buffered = Buffer.alloc(0);
            let ffmpeg;
            let settled = false;

            const fail = (error) => {
                if (settled) {
                    return;
                }

                settled = true;
                ytDlpStream.destroy();
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
                    if (code != null && code !== 0) {
                        console.error('ffmpeg exited with code', code, ffmpegLog.slice(-500));
                    }
                });

                ffmpeg.stdin.on('error', () => {
                    // Ignore EPIPE when the stream ends naturally.
                });

                ytDlpStream.on('error', (error) => {
                    if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                        console.error('yt-dlp stream error:', error);
                    }
                });

                let ytDlpLog = '';
                ytDlpStream.stderr?.on('data', (data) => {
                    ytDlpLog += data.toString();
                });

                ytDlpStream.on('close', (code) => {
                    if (code != null && code !== 0) {
                        console.error('yt-dlp exited with code', code, ytDlpLog.slice(-500));
                    }
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
            ytDlpStream.on('error', fail);
            ytDlpStream.on('close', (code) => {
                if (!settled) {
                    fail(new Error(`yt-dlp closed before audio data was ready (code: ${code})`));
                }
            });
        });
    });
}

module.exports = {
    createAudioStream,
    isYouTubeUrl,
    resolveVideo,
};
