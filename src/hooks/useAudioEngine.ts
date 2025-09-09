import { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { Harmony, HARMONY_PRESETS } from "@/types/audio";


export function useAudioEngine() {
const [status, setStatus] = useState<"idle" | "ready" | "live" | "playing">("idle");
const [fileName, setFileName] = useState("");


const micRef = useRef<Tone.UserMedia | null>(null);
const playerRef = useRef<Tone.Player | null>(null);
const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
const [selectedMicId, setSelectedMicId] = useState("");


// graph
const bus = useMemo(() => new Tone.Gain(1), []);
const dryGain = useMemo(() => new Tone.Gain(0.9), []);
const analyser = useMemo(() => new Tone.Analyser("fft", 512), []);
const monitorGain = useMemo(() => new Tone.Gain(1), []);
const meter = useMemo(() => new Tone.Meter(), []);


const [harmonies, setHarmonies] = useState<Harmony[]>(() =>
HARMONY_PRESETS.map((p) => ({
id: p.id,
semitones: p.semitones,
gain: new Tone.Gain(0.7),
shifter: new Tone.PitchShift({ pitch: p.semitones, windowSize: 0.1, delayTime: 0 }),
enabled: p.id === "+3" || p.id === "+5",
prevLevel: 0.7,
}))
);


useEffect(() => {
dryGain.connect(bus);
harmonies.forEach((h) => h.gain.connect(bus));
bus.connect(monitorGain);
monitorGain.connect(Tone.getDestination());
bus.connect(analyser);
bus.connect(meter);
return () => {
try { monitorGain.disconnect(); } catch {}
try { bus.disconnect(); } catch {}
try { analyser.dispose(); } catch {}
try { meter.dispose(); } catch {}
};
}, []);


const attachNode = (node: Tone.ToneAudioNode) => {
node.connect(dryGain);
harmonies.forEach((h) => node.connect(h.shifter).connect(h.gain));
};
}
