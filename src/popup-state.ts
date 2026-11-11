export interface PopupState {
 active:boolean;
 message:string;
 model:string;
 receivedSeconds:number;
 sentSeconds:number;
 outputSeconds:number;
 signal:boolean;
 tokens:number;
 estimatedUsd:number;
 unknownTokens:number;
 bufferMs:number;
 queuedSeconds:number;
 skippedSeconds:number;
 underruns:number;
 audioChunks:number;
 events:number;
}
