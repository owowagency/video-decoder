import {resolve, dirname} from 'path';
import {existsSync} from 'fs';
import {execSync} from 'child_process';
import {argv} from 'process';

const __dirname = new URL(dirname(import.meta.url)).pathname;
const assetDir = resolve(__dirname, '..', 'src', 'assets', 'videos');
const fontFile = resolve(__dirname, 'font.ttf');

// codecs

const VP9 = {
    name: 'vp9',
    decoder: 'libvpx-vp9',
};

const VP8 = {
    name: 'vp8',
    decoder: 'libvpx',
};

const AV1 = {
    name: 'av1',
    decoder: 'libaom-av1',
};

// containers

const WEBM = {
    name: 'webm',
    ext: 'webm',
    codecs: [VP9, VP8, AV1],
};

const MKV = {
    name: 'mkv',
    ext: 'mkv',
    codecs: [VP9],
};

const MP4 = {
    name: 'mp4',
    ext: 'mp4',
    codecs: [VP9, AV1],
};

const containers = [WEBM, MKV, MP4];

// sizes

const SD = {width: 640, height: 480, fontSize: 16};
const HD = {width: 1280, height: 720, fontSize: 20};
const FHD = {width: 1920, height: 1080, fontSize: 24};
// const UHD = {width: 3840, height: 2160, fontSize: 24};

const sizes = [SD, HD, FHD];

const durations = [2, 5];
const frameRates = [30, 60];

const force = argv.includes('--force');

for (const frameRate of frameRates) {
    for (const duration of durations) {
        for (const size of sizes) {
            for (const container of containers) {
                for (const codec of container.codecs) {
                    const borderWidth = 2;
                    const totalFrames = frameRate * duration;
                    const maxFrameTextLength = String(totalFrames).length;
                    const drawTextContent = `${container.name} | ${codec.name} | ${size.width}x${size.height} | ${frameRate} fps | %{eif\\:n\\:d\\:${maxFrameTextLength}}/${totalFrames} | %{pts\\:hms}`;
                    const drawText = `drawtext=text='${drawTextContent}':fontsize=${size.fontSize}:fontcolor=white:bordercolor=black:borderw=${borderWidth}:fontfile=${fontFile}:x=25:y=25:r=${frameRate}`;
                    const testSrc = `duration=${duration}:size=${size.width}x${size.height}:rate=${frameRate}`;
                    const fileName = `video_${duration}s_${frameRate}fps_${size.width}x${size.height}_${codec.name}.${container.ext}`;
                    const output = resolve(assetDir, fileName);

                    if (existsSync(output) && !force) {
                        continue;
                    }

                    const cmd = `ffmpeg -y -f lavfi -i testsrc=${testSrc} -vf "${drawText}" -c:v ${codec.decoder} ${output}`;

                    execSync(cmd, [], {
                        stdio: 'inherit',
                        shell: false,
                    });
                }
            }
        }
    }
}