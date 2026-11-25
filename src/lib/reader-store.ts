import { emptyReader, MAX_BACKUP_BYTES, mergeReader, parseReader, READER_KEY, type ReaderData } from "./reader-data";
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }
export interface ReaderState { data:ReaderData; ready:boolean; blocked:boolean; message:string }
const initial:ReaderState={data:emptyReader(),ready:false,blocked:false,message:"正在读取个人数据…"};
export class ReaderStore {
  private state=initial;
  private storage?:StorageLike;
  private listeners=new Set<()=>void>();
  getSnapshot=()=>this.state;
  getServerSnapshot=()=>initial;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
  private publish(state:ReaderState) { this.state=state;this.listeners.forEach((fn)=>fn()); }
  load(storage?:StorageLike) {
    this.storage=storage;
    try {
      if (!storage) throw new Error("unavailable");
      const raw=storage.getItem(READER_KEY);
      this.publish({data:raw?parseReader(raw):emptyReader(),ready:true,blocked:false,message:"已在此浏览器保存 · 可导出备份迁移到其他设备"});
    } catch {
      let data=emptyReader();let recovered=false;
      try {const raw=storage?.getItem(`${READER_KEY}.backup`);if(raw){data=parseReader(raw);recovered=true;}} catch { /* Keep corrupted originals untouched. */ }
      let blocked=false;try{blocked=!!storage?.getItem(READER_KEY);}catch{ /* unavailable storage: memory mode */ }
      if(!blocked)this.storage=undefined;
      this.publish({data,ready:true,blocked,message:blocked ? recovered ? "本地数据异常，已读取备用副本。请先导出，再确认恢复。" : "本地数据损坏，原件已保留。请导入有效备份恢复。" : "浏览器暂不能保存，操作仅保留在本页；离开前请导出备份。"});
    }
  }
  receive(raw:string|null) {
    if (!raw) {this.publish({...this.state,message:"另一页面清除了存储，本页资料仍保留；请导出备份。"});return;}
    try {this.publish({...this.state,data:mergeReader(this.state.data,parseReader(raw)),message:"已合并同一浏览器其他页面的修改"});}
    catch {this.publish({...this.state,message:"其他页面的数据无法读取；已保留本页资料。"});}
  }
  change(update:(data:ReaderData)=>ReaderData,recover=false) {
    if(!this.state.ready) throw new Error("请等待个人数据读取完成");
    if(this.state.blocked&&!recover) throw new Error("请先导入备份或确认恢复，避免覆盖损坏的原件");
    let current=this.state.data;
    if(!recover) {
      let raw:string|null=null;try{raw=this.storage?.getItem(READER_KEY)??null;}catch{this.storage=undefined;}
      if(raw) {try{current=mergeReader(current,parseReader(raw));}catch{this.publish({...this.state,blocked:true,message:"本地文件发生异常，已暂停写入。请先导出本页备份。"});throw new Error("数据异常，已停止覆盖");}}
    }
    const next=parseReader(JSON.stringify(update(current)));
    const json=JSON.stringify(next);
    if(new TextEncoder().encode(json).length>MAX_BACKUP_BYTES) throw new Error("个人资料达到 2 MB，请先导出备份");
    let message="已保存到此浏览器";
    try {
      if(!this.storage) throw new Error("unavailable");
      // Backup failure stops the write too: retain the last complete primary document.
      if(!recover)this.storage.setItem(`${READER_KEY}.backup`,JSON.stringify(current));
      this.storage.setItem(READER_KEY,json);
    }catch{message="保存失败（空间不足或隐私限制），修改仅在本页；请立即导出备份。";}
    this.publish({data:next,ready:true,blocked:false,message});
  }
  import(data:ReaderData) {this.change((current)=>mergeReader(current,data),this.state.blocked);}
  recover() {this.change((current)=>current,true);}
  export() {return JSON.stringify(this.state.data);}
}
