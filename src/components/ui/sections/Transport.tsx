import React from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";


export function Transport(props: {
isRec: boolean;
isStartingRec: boolean;
muteDuringRec: boolean;
setMuteDuringRec: (v: boolean) => void;
startRecord: () => Promise<void>;
stopRecord: () => Promise<void> | void;
elapsedMs: number;
downloadUrl: string | null;
audioPreviewRef: React.RefObject<HTMLAudioElement>;
formatMMSS: (ms: number) => string;
}) {
const { isRec, isStartingRec, muteDuringRec, setMuteDuringRec, startRecord, stopRecord, elapsedMs, downloadUrl, audioPreviewRef, formatMMSS } = props;
return (
<section className="space-y-4 p-4 rounded-2xl border bg-white">
<div className="flex items-center justify-between">
<h2 className="font-semibold">Afspilning & optagelse</h2>
<Toggle checked={muteDuringRec} onChange={setMuteDuringRec} label="Mute afspilning under optag" />
</div>
<p className="text-xs text-neutral-500">Når mute er slået til, sendes lyden stadig til optageren (inkl. harmonistemmer), men ikke til højttalerne.</p>


<div className="flex flex-wrap gap-3 items-center">
{!isRec ? (
<Button onClick={startRecord} disabled={isStartingRec}>⏺ Start optagelse</Button>
) : (
<Button className="bg-red-600 text-white" onClick={stopRecord}>⏹ Stop optagelse</Button>
)}
<span className="text-xs text-neutral-600 min-w-[60px]">Varighed: {isRec ? formatMMSS(elapsedMs) : "00:00"}</span>
{downloadUrl && (
<div className="flex flex-col gap-2 w-full max-w-xl">
<a href={downloadUrl} download={`harmonylab-${Date.now()}.webm`} className="text-blue-600 underline w-fit">Download optagelse</a>
<audio ref={audioPreviewRef} src={downloadUrl || undefined} controls className="w-full" />
</div>
)}
</div>
</section>
);
}
