"""Bounded DEX class/method inspection using AOSP instruction widths."""
import argparse
import json
from pathlib import Path
import struct
import zipfile


class Dex:
    def __init__(self, raw):
        if not raw.startswith(b'dex\n') or len(raw)<112: raise ValueError('Not a DEX file')
        self.raw=raw
        self.ns,self.os=self.u32(56),self.u32(60)
        self.nt,self.ot=self.u32(64),self.u32(68)
        self.nm,self.om=self.u32(88),self.u32(92)
        self.nf,self.of=self.u32(80),self.u32(84)
        self.nc,self.oc=self.u32(96),self.u32(100)
        self.cache={}
    def u32(self,p):return struct.unpack_from('<I',self.raw,p)[0]
    def u16(self,p):return struct.unpack_from('<H',self.raw,p)[0]
    def uleb(self,p):
        v=0
        for i in range(5):
            c=self.raw[p];p+=1;v|=(c&127)<<(7*i)
            if c<128:return v,p
        raise ValueError('Invalid ULEB128')
    def string(self,i):
        if i not in self.cache:
            p=self.u32(self.os+4*i);_,p=self.uleb(p);end=self.raw.index(0,p)
            self.cache[i]=self.raw[p:end].decode('utf-8','replace')
        return self.cache[i]
    def type(self,i):return self.string(self.u32(self.ot+4*i))
    def method(self,i):
        p=self.om+8*i
        return self.type(self.u16(p))+'->'+self.string(self.u32(p+4))
    def signature(self,i):
        p=self.om+8*i;proto=self.u32(76)+self.u16(p+2)*12;params=self.u32(proto+8)
        args=[] if not params else [self.type(self.u16(params+4+j*2)) for j in range(self.u32(params))]
        return '('+''.join(args)+')'+self.type(self.u32(proto+4))
    def field(self,i):
        p=self.of+8*i
        return self.type(self.u16(p))+'->'+self.string(self.u32(p+4))
    def methods(self, descriptor):
        for c in range(self.nc):
            off=self.oc+32*c
            if self.type(self.u32(off))!=descriptor:continue
            p=self.u32(off+24)
            if not p:return
            counts=[]
            for _ in range(4):n,p=self.uleb(p);counts.append(n)
            for _ in range(counts[0]+counts[1]):_,p=self.uleb(p);_,p=self.uleb(p)
            for count in counts[2:]:
                idx=0
                for _ in range(count):
                    delta,p=self.uleb(p);idx+=delta;flags,p=self.uleb(p);code,p=self.uleb(p)
                    yield {'index':idx,'name':self.method(idx),'flags':flags,'code':code}
    def static_values(self,descriptor):
        for i in range(self.nc):
            off=self.oc+32*i
            if self.type(self.u32(off))!=descriptor:continue
            p=self.u32(off+24);counts=[]
            for _ in range(4):n,p=self.uleb(p);counts.append(n)
            fields=[];idx=0
            for _ in range(counts[0]):delta,p=self.uleb(p);idx+=delta;_,p=self.uleb(p);fields.append(self.field(idx))
            p=self.u32(off+28)
            if not p:return
            count,p=self.uleb(p)
            for field in fields[:count]:
                start=p;head=self.raw[p];p+=1;kind=head&31;width=(head>>5)+1
                if kind in [0,2,3,4,6,16,17,23,24,25,26,27]:
                    value=int.from_bytes(self.raw[p:p+width],'little',signed=kind in [0,2,4,6]);p+=width
                elif kind==31:value=head>>5
                elif kind==30:value=None
                else:raise ValueError('Unsupported static encoded value')
                yield {'field':field,'offset':start,'kind':kind,'value':value}
    def instructions(self, code):
        if not code:return
        length=self.u32(code+12);data=self.raw[code+16:code+16+2*length];pos=0
        while pos<len(data):
            op=data[pos];width=WIDTHS.get(op)
            if op==0 and data[pos+1]:
                kind=data[pos+1];size=struct.unpack_from('<H',data,pos+2)[0]
                if kind==1:width=4+2*size
                elif kind==2:width=2+4*size
                elif kind==3:width=4+(size*struct.unpack_from('<I',data,pos+4)[0]+1)//2
                else:raise ValueError('Unknown DEX payload')
            if not width or pos+2*width>len(data):raise ValueError(f'Unknown/truncated opcode {op:02x} at {pos}')
            raw=data[pos:pos+2*width];entry={'offset':code+16+pos,'relative':pos,'opcode':op,'hex':raw.hex()}
            if op in list(range(0x6e,0x73))+list(range(0x74,0x79)):entry['invoke']=self.method(struct.unpack_from('<H',raw,2)[0])
            if op in (0x1a,0x1b):entry['string']=self.string(struct.unpack_from('<H' if op==0x1a else '<I',raw,2)[0])
            if 0x52<=op<=0x6d:entry['field']=self.field(struct.unpack_from('<H',raw,2)[0])
            yield entry;pos+=2*width


WIDTHS={}
for lo,hi,width in [(0,1,1),(2,2,2),(3,3,3),(4,4,1),(5,5,2),(6,6,3),(7,7,1),(8,8,2),(9,9,3),(10,18,1),(19,19,2),(20,20,3),(21,22,2),(23,23,3),(24,24,5),(25,26,2),(27,27,3),(28,28,2),(29,30,1),(31,32,2),(33,33,1),(34,35,2),(36,38,3),(39,40,1),(41,41,2),(42,44,3),(45,61,2),(68,109,2),(110,114,3),(116,120,3),(123,143,1),(144,175,2),(176,207,1),(208,226,2),(250,251,4),(252,253,3),(254,255,2)]:
    for op in range(lo,hi+1):WIDTHS[op]=width


def review(apk, classes):
    result=[]
    with zipfile.ZipFile(apk) as z:
        for name in z.namelist():
            if not name.endswith('.dex'):continue
            raw=z.read(name)
            selected=[c for c in classes if c.encode() in raw]
            if not selected:continue
            dex=Dex(raw)
            for c in selected:
                for m in dex.methods(c):
                    result.append({'dex':name,**m,'instructions':list(dex.instructions(m['code']))})
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('apk',type=Path);p.add_argument('--class',dest='classes',action='append',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    result=review(a.apk,a.classes);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('Reviewed methods:',len(result))
