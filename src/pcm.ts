export function encodePCM(buffer: ArrayBuffer) {
    let binary = '';
    for (const byte of new Uint8Array(buffer))
        binary += String.fromCharCode(byte);
    return btoa(binary);
}
export function pcmPeak(buffer: ArrayBuffer) {
    const pcm = new DataView(buffer);
    let peak = 0;
    for (let i = 0; i < pcm.byteLength; i += 2)
        peak = Math.max(peak, Math.abs(pcm.getInt16(i, true) / 32768));
    return peak;
}
