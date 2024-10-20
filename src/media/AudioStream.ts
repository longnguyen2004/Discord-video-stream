import { Writable } from "stream";
import { setImmediate } from "timers/promises";
import { MediaUdp } from "../client/voice/MediaUdp.js";
import { combineLoHi } from "./utils.js";
import type { HasPTS } from "./HasPTS.js";
import type { Packet } from "@libav.js/variant-webcodecs";

class AudioStream extends Writable implements HasPTS {
    public udp: MediaUdp;
    public count: number;
    public sleepTime: number;
    public startTime?: number;
    public syncStream: HasPTS | undefined;

    private noSleep: boolean;
    private _pts: number | undefined;

    constructor(udp: MediaUdp, noSleep = false) {
        super({ objectMode: true });
        this.udp = udp;
        this.count = 0;
        this.sleepTime = 20;
        this.noSleep = noSleep;
    }

    get pts() {
        return this._pts;
    }

    async _write(frame: Packet, _: BufferEncoding, callback: (error?: Error | null) => void) {
        this.count++;
        if (!this.startTime)
            this.startTime = performance.now();

        // We are ahead, wait for the other stream to catch up
        while (
            this.syncStream?.pts !== undefined &&
            this._pts !== undefined &&
            this.syncStream.pts < this._pts
        )
            await setImmediate();

        const { data, ptshi, pts, time_base_num, time_base_den } = frame;
        this.udp.sendAudioFrame(Buffer.from(data));
        if (ptshi !== undefined && pts !== undefined && time_base_num !== undefined && time_base_den !== undefined)
            this._pts = combineLoHi(ptshi, pts) / time_base_den * time_base_num;
        
        const next = ((this.count + 1) * this.sleepTime) - (performance.now() - this.startTime);

        if (this.noSleep)
        {
            callback();
        }
        else
        {
            setTimeout(() => {
                callback();
            }, next);
        }
    }
}

export {
    AudioStream
};
