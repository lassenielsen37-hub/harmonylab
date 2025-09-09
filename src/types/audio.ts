import * as Tone from "tone";


export type Harmony = {
id: string;
semitones: number;
gain: Tone.Gain;
shifter: Tone.PitchShift;
enabled: boolean;
prevLevel: number;
};


export const HARMONY_PRESETS = [
{ id: "+3", semitones: 3 },
{ id: "+5", semitones: 7 },
{ id: "-3", semitones: -3 },
{ id: "-5", semitones: -7 },
] as const;


export const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
